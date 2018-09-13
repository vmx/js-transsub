'use strict'

/**
 * Protobuf interface for a block (CID + data)
 */
module.exports = `
  syntax = "proto2";

  message Block {
    required bytes cid = 1;
    required bytes data = 2;
  }
`
