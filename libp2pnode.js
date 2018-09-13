'use strict'

// Creating a bundle that adds:
//   transport: websockets + tcp
//   stream-muxing: spdy & mplex
//   crypto-channel: secio
//   discovery: multicast-dns

const libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')
const SPDY = require('libp2p-spdy')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')
const MulticastDNS = require('libp2p-mdns')
const DHT = require('libp2p-kad-dht')
const defaultsDeep = require('@nodeutils/defaults-deep')
const Protector = require('libp2p-pnet')

class Node extends libp2p {
  // constructor (_peerInfo, _peerBook, _options) {
  constructor (_options) {
    const defaults = {
      // peerInfo: _peerInfo,            // The Identity of your Peer
      // peerBook: _peerBook,            // Where peers get tracked, if undefined libp2p will create one instance

      // The libp2p modules for this libp2p bundle
      modules: {
        transport: [
          TCP,
          new WS()                    // It can take instances too!
        ],
        streamMuxer: [
          MPLEX,
          SPDY
        ],
        connEncryption: [
          SECIO
        ],
        // connProtector: new Protector(#<{(|protector specific opts|)}>#),
        peerDiscovery: [
          MulticastDNS
        ],
        // peerRouting: {},              // Currently both peerRouting and contentRouting are patched through the DHT,
        // contentRouting: {},           // this will change once we factor that into two modules, for now do the following line:
        dht: DHT                      // DHT enables PeerRouting, ContentRouting and DHT itself components
      },

      // libp2p config options (typically found on a config.json)
      config: {                       // The config object is the part of the config that can go into a file, config.json.
        peerDiscovery: {
          mdns: {                     // mdns options
            interval: 1000,           // ms
            enabled: true
          },
          webrtcStar: {               // webrtc-star options
            interval: 1000,           // ms
            enabled: false
          }
          // .. other discovery module options.
        },
        // peerRouting: {},
        // contentRouting: {},
        relay: {                      // Circuit Relay options
          enabled: false,
          hop: {
            enabled: false,
            active: false
          }
        },
        dht: {
          kBucketSize: 20
        },
        // Enable/Disable Experimental features
        EXPERIMENTAL: {               // Experimental features ("behind a flag")
          pubsub: false,
          dht: false
        }
      }
    }

    // overload any defaults of your bundle using https://github.com/nodeutils/defaults-deep
    super(defaultsDeep(_options, defaults))
  }
}

module.exports = Node
