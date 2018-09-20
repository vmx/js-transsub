'use strict'

const promisify = require('util').promisify

const async = require('async')
const CID = require('cids')
const exporter = require('ipfs-unixfs-engine').exporter
// NOTE vmx 2018-09-19: This is a really ugly hack
const IpfsFilesApi = require('ipfs/src/core/components/files.js')
const IpfsBlockService = require('ipfs-block-service')
const Ipld = require('ipld')
const protobuf = require('protons')
const pull = require('pull-stream')
const pushable = require('pull-pushable')

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const blockSchema = require('./block.proto.js')
const Block = protobuf(blockSchema).Block
const unixfsv1Schema = require('./unixfsv1.proto.js')
const Unixfsv1 = protobuf(unixfsv1Schema).Unixfsv1

const SERVER_PORT = 10333
const IPFS_PATH = '/tmp/transsubreposerver'

// TranssubIpld works the same way as the normal IPLD, the only difference is
// that it pushes each node that is visited into a user-supplied stream
class TranssubIpld extends Ipld {
  // Takes a pushable stream to send the blocks back to the requester
  constructor(blockService, pushableStream) {
    super(blockService)
    this.pushableStream = pushableStream
  }

  get(cid, path, options, callback) {
    if (typeof path === 'function') {
      callback = path
      path = undefined
    }

    if (typeof options === 'function') {
      callback = options
      options = {}
    }

    super.get(cid, path, options, (err, result) => {
      if (err === null) {
        const dagNode = result.value
        const cid = new CID(dagNode.multihash).toBaseEncodedString()
        const encodedBlock = Block.encode({
          cid,
          data: dagNode.data
        })
        console.log('pushing:', cid, encodedBlock.length)
        this.pushableStream.push(encodedBlock)

      }
      callback(err, result)
    })
  }
}


const initBlockService = async (ipfsRepoPath) => {
  const repo = await helpers.initRepo(ipfsRepoPath)
  const blockService = new IpfsBlockService(repo)
  return blockService
}

const pullData = (pullFrom) => {
  return new Promise((resolve, reject) => {
    pull(
      pullFrom,
      pull.collect((err, data) => {
        if (err) {
          return reject(err)
        }
        return resolve(data)
      })
    )
  })
}

// Fake IPFS instance for files API. It only contains what's needed to
// make cat, get and ls calls
class FakeIpfs {
  constructor (ipld) {
    this._ipld = ipld
  }
}

const processUnixfsv1Query = async (selector, blockService, pushableStream) => {
  const ipld = new TranssubIpld(blockService, pushableStream)
  const path = selector.path
  const ipfs = new FakeIpfs(ipld)
  const filesApi = IpfsFilesApi(ipfs)
  switch(selector.operation) {
    case Unixfsv1.Operation.CAT:
      const options = {
        preload: false,
        length: selector.length === 0 ? undefined : selector.length,
        offset: selector.offset
      }
      filesApi.cat(path, options, function (err, file) {
        if (err !== null) {
          throw err
        }
        pushableStream.end()
      })
      break
    case Unixfsv1.Operation.GET:
      filesApi.get(path, {preload: false}, function (err, file) {
        if (err !== null) {
          throw err
        }
      })
      break
    case Unixfsv1.Operation.LS:
      filesApi.lsImmutable(path, {preload: false}, function (err, files) {
        if (err !== null) {
          throw err
        }
      })
      break
    default:
      throw Error('Unsupported files API operation')
  }
}

const select = (selector, ipld, cb) => {
  // Store nodes temporarily for easy traversal
  let nodes = []
  // NOTE vmx 2018-04-27: For now, just return the leaf nodes and not
  // the full subtree. If the subtree is returned decision need to be
  // made if it should be depth or breadth first.
  // NOTE vmx 2018-05-10: Change in plans, return them as unixfs is doing it
  // and return all nodes breadth first.
  const output = []
  // Paths always start with a CID
  // TODO vmx 2018-02-28: Is that actually true?
  const pathArray = selector.path.split('/')
  let cid = pathArray.shift()
  const path = pathArray.join('/')

  nodes.push(cid)

  // XXX 2018-04-17: GO ON HERE and don't serialize the node, but access the links directlt through the given path
  // Then traverse those
  async.whilst(
    function() {
      console.log('whole condition:', nodes.length)
      return nodes.length > 0
    },
    function(callback) {
      ipld.get(new CID(nodes[0]), path, (err, result) => {
        // Remove the node we just have processed
        cid = nodes.shift()
        console.log('within loop: nodes.length:', nodes.length)
        console.log('within loop: output.length:', output.length)

        if (err) {
          console.log('error1:', err)
          return err
        }
        console.log('result1:', result)

        // Path got completely resolved
        if (result.remainderPath === '') {
          output.push(cid)
        }
        // This should become a loop
        else {
          ipld.get(result.remainderPath, new CID(result.value._json.multihash), (err2, result2) => {
            //ipld.get(result.remainderPath, new CID(result.value.multihash), (err2, result2) => {
            if (err2) {
              console.log('error2:', err2)
              return err
            }
            console.log('result2:', result2)
            nodes.push(result2.value)
          })
        }


        // Now we are at the end of the path, return the subtree if requested
        if (selector.follow) {
          // The previous nodes are no longer needed for the traversal
          // nodes = []

          console.log('result30: value: json:', result.value.toJSON())
          if (Array.isArray(selector.follow)) {
            // TODO vmx 2018-04-27: Support an arbitrary number of array elements,
            // not just two
            // TODO vmx 2018-05-15: Optimize that you don't do another `get()` on the same
            // `CID` as before, just to get links of it
            ipld.get(new CID(result.value.multihash), selector.follow[0], (err3, result3) => {
              if (err3) {
                console.log('error3:', err3)
                return err
              }
              // console.log('result3:', result3)

              for (const link of result3.value) {
                console.log('pushing node with cid:', link[selector.follow[1]])
                nodes.push(link[selector.follow[1]])
              }

              callback(null)
            })
          } else {
            //XXX vmx 2018-02-15: GO ON HERE
          }
        }

      })
    },
    function (err, n) {
      cb(output)
    }
  )
}


const processQuery = (selector, ipld, pp) => {
  const path = selector.cid.toString('utf-8')
  select({
    // The path to some value
    path: path,
    // If you want get a whole subtree, you can specifu which path to
    // follow.
    // If `follow` is an array, it expects all elements, except for the
    // last one to be arrays. It will then loop through all elements of such
    // an array and traverse them
    follow: ['Links', 'multihash'],
    maxDepth: 10000
  },
  ipld,
  (cids) => {
    console.log('output:', cids)
    cids.forEach((cid) => {
      // TODO vmx 2018-09-13: Make access to BlockService a public API
      const blockService = ipld.bs
      blockService.get(new CID(cid), (err, block) => {
        if (err) {
          throw err
        }
        const encodedBlock = Block.encode({
          cid,
          data: block.data
        })
        console.log('pushing:', cid, encodedBlock.length)
        pp.push(encodedBlock)
      })
    })
  })
}

const main = async (argv) => {
  const blockService = await initBlockService(IPFS_PATH)
  const serverInfo = await helpers.createPeerInfo('./peerid-server.json',
    SERVER_PORT)
  const server = new Node({peerInfo: serverInfo})
  server.start(async (err) => {
    if (err) {
      throw err
    }
    console.log('started at', serverInfo.multiaddrs.toArray())

    server.handle('/transsub/0.1.0', (protocol, conn) => {
      // This enables us to push data to the Consumer
      const pp = pushable()
      pull(
        pp,
        conn
      )

      // Get the Selector from the Consumer
      pull(
        conn,
        pull.drain((data) => {
          // TODO vmx 2018-09-17: Don't hardcode to UnixFS v1
          const selector = Unixfsv1.decode(data)
          processUnixfsv1Query(selector, blockService, pp)
        })
      )
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
