'use strict'

const CID = require('cids')
const IpfsBlock = require('ipfs-block')
const protobuf = require('protons')
const pull = require('pull-stream')

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const blockSchema = require('./block.proto.js')
const Block = protobuf(blockSchema).Block

const CONSUMER_PORT = 10332
const SERVER_PORT = 10333
const IPFS_PATH = '/tmp/ipfsrepoclient'

const main = async (argv) => {
  if (argv.length !== 3) {
    console.log('usage: consumer.js <CID>')
    process.exit(1)
  }
  const cid = argv[2]
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
    consumer.dialProtocol(serverInfo, '/graphsync/0.1.0', (err, conn) => {
      if (err) {
        throw err
      }

      console.log('the cid trying to be pushed:', cid)
      // Push the CID to the server
      pull(
        pull.once(cid),
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
        pull.drain(console.log)
      )
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
