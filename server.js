'use strict'

const promisify = require('util').promisify

const async = require('async')
const CID = require('cids')
const protobuf = require('protons')
const pull = require('pull-stream')
const pushable = require('pull-pushable')

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const blockSchema = require('./block.proto.js')
const Block = protobuf(blockSchema).Block

const SERVER_PORT = 10333
const IPFS_PATH = '/tmp/transsubreposerver'

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

const processQuery = (path, ipld, pp) => {
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
  const ipld = await helpers.initIpld(IPFS_PATH)
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

      // Get a CID from the Consumer
      pull(
        conn,
        pull.drain((data) => {
          processQuery(data.toString('utf-8'), ipld, pp)
        })
      )
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
