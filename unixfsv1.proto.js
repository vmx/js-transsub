'use strict'

/**
 * Protobuf interface for sending a UnixFS v1 request to the Serer
 */
module.exports = `
  syntax = "proto2";

  message Unixfsv1 {
    enum Operation {
      CAT = 0;
      GET = 1;
      LS = 2;
    }
    required Operation operation = 4;
    required string path = 1;
    optional uint64 length = 2;
    optional uint64 offset = 3;
  }
`
