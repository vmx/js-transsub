'use strict'

const CID = require('cids')
const protobuf = require('protons')
const pull = require('pull-stream')

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const blockSchema = require('./block.proto.js')
const Block = protobuf(blockSchema).Block

const CONSUMER_PORT = 10332
const SERVER_PORT = 10333

const main = async (argv) => {
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
      // console.log('dialed in', conn)
      console.log('dialed in')
      pull(
        conn,
        pull.map((data) => {
          const block = Block.decode(data)
          return {
            cid: block.cid.toString(),
            data: block.data
          }
        }),
        pull.drain(console.log)
      )
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
