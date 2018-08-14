'use strict'

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

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
      console.log('dialed in', conn)
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
