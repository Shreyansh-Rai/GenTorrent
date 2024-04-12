'use strict';
import { open } from './parser.mjs';
import { download } from './download.mjs';

const torrent = open(process.argv[2]);

download(torrent);
