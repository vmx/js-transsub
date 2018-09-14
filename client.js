'use strict'

const promisify = require('util').promisify

const CID = require('cids')
const fs = require('fs-extra')
const IpfsBlock = require('ipfs-block')
const pull = require('pull-stream')
const exporter = require('ipfs-unixfs-engine').exporter

const helpers = require('./helpers.js')

const IPFS_PATH = '/tmp/ipfsrepoclient'


const readFile = (file) => {
  return new Promise((resolve, reject) => {
    pull(
      file.content,
      pull.collect((err, data) => {
        if (err) {
          return reject(err)
        }
        return resolve(Buffer.concat(data))
      })
    )
  })
}

const main = async (argv) => {
  const ipld = await helpers.initIpld(IPFS_PATH)
  pull(
    exporter('QmTaxZi1CXzyntZzXx8na6HV3LiZ4y2xNLpdkKwt99FkMz', ipld),
    pull.collect(async (err, files) => {
      if (err) {
        throw err
      }
      const result = await readFile(files[0])
      await fs.outputFile('/tmp/out', result)
      console.log(result.length)
    })
  )
}

main(process.argv).catch((error) => {
  console.error(error)
})
