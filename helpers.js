'use strict'

const promisify = require('util').promisify
const fs = require('fs-extra')
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

module.exports = {
  createPeerInfo
}
