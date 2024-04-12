'use strict';
import {getPeers} from './tracker.mjs'
import { open } from './parser.mjs';

const torrent = open('kali.torrent');
console.log(torrent);
console.log("tracker's url :", torrent.announce.toString('utf8'));

getPeers(torrent,(peers)=>{
    console.log("List of peers :", peers);
})