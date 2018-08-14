'use strict'

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const SERVER_PORT = 10333

const main = async (argv) => {
  const serverInfo = await helpers.createPeerInfo('./peerid-server.json',
    SERVER_PORT)
  const server = new Node({peerInfo: serverInfo})
  server.start(async (err) => {
    if (err) {
      throw err
    }
    console.log('started at', serverInfo.multiaddrs.toArray())

    server.handle('/graphsync/0.1.0', (protocol, conn) => {
      console.log('handling', protocol)
    })
  })
}

main(process.argv).catch((error) => {
  console.error(error)
})
