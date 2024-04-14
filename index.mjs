'use strict';
import { open } from './parser.mjs';
import { download } from './download.mjs';
import path from 'path'

const torrent = open(process.argv[2]);
const torrentName = torrent.info.name;
download(torrent, torrentName);
