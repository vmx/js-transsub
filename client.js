'use strict'

const CID = require('cids')
const fs = require('fs-extra')
const IpfsBlock = require('ipfs-block')
const pull = require('pull-stream')
const exporter = require('ipfs-unixfs-engine').exporter

const helpers = require('./helpers.js')

const IPFS_PATH = '/tmp/ipfsrepoclient'

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

const readFile = async (file) => {
  const data = await pullData(file.content)
  return Buffer.concat(data)
}

const pullFiles = async (cid, ipld) => {
  const files = await pullData(exporter(cid, ipld))
  const result = await readFile(files[0])
  await fs.outputFile('/tmp/out', result)
  console.log(result.length)
}

const main = async (argv) => {
  if (argv.length !== 3) {
    console.log('usage: client.js <CID>')
    process.exit(1)
  }
  const cid = argv[2]
  const ipld = await helpers.initIpld(IPFS_PATH)
  await pullFiles(cid, ipld)
}

main(process.argv).catch((error) => {
  console.error(error)
})
