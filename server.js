'use strict'

const IpfsBlockService = require('ipfs-block-service')
const IpfsRepo = require('ipfs-repo')
const Ipld = require('ipld')
const promisify = require('util').promisify

const helpers = require('./helpers.js')
const Node = require('./libp2pnode.js')

const SERVER_PORT = 10333

const initIpld = promisify((ipfsRepoPath, callback) => {
  const repo = new IpfsRepo(ipfsRepoPath)
  repo.init({}, (err) => {
    if (err) {
      callback(err)
    }
    repo.open((err) => {
      if (err) {
        callback(err)
      }
      const blockService = new IpfsBlockService(repo)
      const ipld = new Ipld(blockService)
      callback(null, ipld)
    })
  })
})

const main = async (argv) => {
  const ipld = await initIpld('/tmp/ipfsrepo')
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
