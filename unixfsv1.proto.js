'use strict'

/**
 * Protobuf interface for sending a UnixFS v1 request to the Serer
 */
module.exports = `
  syntax = "proto2";

  message Unixfsv1 {
    required bytes cid = 1;
    optional uint64 length = 2;
  }
`
