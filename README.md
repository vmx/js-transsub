Transsub
========

> Transfer whole sub-DAGs from some peers to a local one.


Installation
------------

    npm install


Usage
-----

First create a 1MB file:

    head -c 1m /dev/zero|openssl enc -aes-128-cbc -pass pass: -nosalt > /tmp/1mb.bin

Load this file into a JS-IPFS peer:

    IPFS_PATH=/tmp/transsubreposerver jsipfs init --empty-repo
    IPFS_PATH=/tmp/transsubreposerver jsipfs add /tmp/1mb.bin
    added QmTaxZi1CXzyntZzXx8na6HV3LiZ4y2xNLpdkKwt99FkMz 1mb.bin

Start the Server:

    node server.js

On another terminal, run the Consumer and request the data that was inserted with its CID:

    node consumer.js QmTaxZi1CXzyntZzXx8na6HV3LiZ4y2xNLpdkKwt99FkMz

You can abort the Consumer and run the client:

    node client.js QmTaxZi1CXzyntZzXx8na6HV3LiZ4y2xNLpdkKwt99FkMz

It will print out the size of the file and write it to disk as `/tmp/out.bin`.

You can confirm that it’s the correct file via:

    sha256sum /tmp/out.bin /tmp/1mb.bin
    02a4ed10b5a54c2537a630a98cd2675bd79e2f557947f419e9b055fad4f17698  /tmp/out.bin
    02a4ed10b5a54c2537a630a98cd2675bd79e2f557947f419e9b055fad4f17698  /tmp/1mb.bin


License
-------

[MIT] Copyright © 2018 Protocol Labs, Inc.


[MIT]: LICENSE
