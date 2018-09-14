'use strict'

const promisify = require('util').promisify

const fs = require('fs-extra')
const IpfsBlockService = require('ipfs-block-service')
const IpfsRepo = require('ipfs-repo')
const Ipld = require('ipld')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')

const PeerIdCreateFromJSON = promisify(PeerId.createFromJSON)

// Create peer info from Peer ID JSON file and a port
const createPeerInfo = async (filename, port) => {
  const config = await fs.readJSON(filename)
  const id = await PeerIdCreateFromJSON(config)
  const info = new PeerInfo(id)
  info.multiaddrs.add('/ip4/0.0.0.0/tcp/' + port)
  return info
}

const initRepo = promisify((ipfsRepoPath, callback) => {
  const repo = new IpfsRepo(ipfsRepoPath)
  repo.init({}, (err) => {
    if (err) {
      callback(err)
    }
    repo.open((err) => {
      if (err) {
        callback(err)
      }
      callback(null, repo)
    })
  })
})

const initIpld = async (ipfsRepoPath) => {
  const repo = await initRepo(ipfsRepoPath)
  const blockService = new IpfsBlockService(repo)
  const ipld = new Ipld(blockService)
  return ipld
}

module.exports = {
  createPeerInfo,
  initIpld,
  initRepo
}
