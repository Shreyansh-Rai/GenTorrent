'use strict';
import fs from 'fs'
import bencode from 'bencode'
import dgram, { Socket } from 'dgram'
import {Buffer} from 'buffer'
import url from 'url'
import {getPeers} from './tracker.mjs'
const torrent = bencode.decode(fs.readFileSync('deb.torrent'));

console.log(torrent);
console.log("tracker's url :", torrent.announce.toString('utf8'));

getPeers(torrent,(peers)=>{
    console.log("List of peers :", peers);
})