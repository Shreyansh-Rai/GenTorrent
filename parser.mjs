import bencode from 'bencode'
import fs from 'fs'
import crypto from 'crypto'
import bignum from 'bignum';
export function getInfoHash(torrent) 
{
    //TODO
    const info = bencode.encode(torrent.info);
    return crypto.createHash('sha1').update(info).digest(); //must return only sha1 hash of info bencode
}
export function getSize(torrent)
{
    //TODO
    //if multiple then reduce ie get sum else return info.length
    const size = torrent.info.files ?
    torrent.info.files.map(file => file.length).reduce((a, b) => a + b) :
    torrent.info.length;

    return bignum.toBuffer(size, {size: 8});
}
export function open(file)
{
    const torrent = bencode.decode(fs.readFileSync(file));
    return torrent;
}