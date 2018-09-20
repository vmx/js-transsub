'use strict'

const CID = require('cids')
const IpfsBlock = require('ipfs-block')
const protobuf = require('protons')
const pull = require('pull-stream')

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const blockSchema = require('./block.proto.js')
const Block = protobuf(blockSchema).Block
const unixfsv1Schema = require('./unixfsv1.proto.js')
const Unixfsv1 = protobuf(unixfsv1Schema).Unixfsv1

const CONSUMER_PORT = 10332
const SERVER_PORT = 10333
const IPFS_PATH = '/tmp/transsubrepoclient'

const main = async (argv) => {
  if (argv.length < 4) {
    console.log('usage: consumer.js <operation: cat, get or ls> <CID>')
    process.exit(1)
  }
  const operation = argv[2]
  const cid = argv[3]
  let length
  let offset
  if (operation === 'cat') {
    const options = argv.slice(4)
    ;[offset, length] = options
  }

  const repo = await helpers.initRepo(IPFS_PATH)
  const consumerInfo = await helpers.createPeerInfo('./peerid-consumer.json',
    CONSUMER_PORT)
  const consumer = new Node({peerInfo: consumerInfo})
  consumer.start(async (err) => {
    if (err) {
      throw err
    }
    console.log('started')
    const serverInfo = await helpers.createPeerInfo('./peerid-server.json',
      SERVER_PORT)
    console.log(serverInfo)
    consumer.dialProtocol(serverInfo, '/transsub/0.1.0', (err, conn) => {
      if (err) {
        throw err
      }

      let unixfsv1Encoded
      switch(operation) {
        case 'cat':
          unixfsv1Encoded = Unixfsv1.encode({
            operation: Unixfsv1.Operation.CAT,
            path: cid,
            length: length,
            offset: offset
          })
          break
        case 'get':
          unixfsv1Encoded = Unixfsv1.encode({
            operation: Unixfsv1.Operation.GET,
            path: cid
          })
          break
        case 'ls':
          unixfsv1Encoded = Unixfsv1.encode({
            operation: Unixfsv1.Operation.LS,
            path: cid
          })
          break
        default:
          throw Error('Unsupported files API operation')
      }

      console.log('the cid trying to be pushed:', cid)
      // Push the CID to the server
      pull(
        pull.once(unixfsv1Encoded),
        conn,
      )

      console.log('dialed in')
      pull(
        conn,
        pull.asyncMap((data, cb) => {
          const decodedBlock = Block.decode(data)
          const block = new IpfsBlock(decodedBlock.data,
            new CID(decodedBlock.cid.toString()))
          repo.blocks.put(block, (err) => {
            if (err) {
              return cb(err)
            }
            return cb(null, block)
          })
        }),
        pull.drain((data) => {
          console.log(data)
        })
      )
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
