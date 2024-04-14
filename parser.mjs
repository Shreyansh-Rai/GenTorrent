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
export const BLOCK_LENGTH = Math.pow(2,14); //fixed

export function pieceLength(torrent, index){
    const totalsize = bignum.fromBuffer(getSize(torrent)).toNumber();
    const pieceLen = torrent.info['piece length'];
    const lastPiece = totalsize%pieceLen;
    const lastind = Math.floor(totalsize/pieceLen);
    if(index === lastind) return lastPiece;
    return pieceLen;
}

export function numBlocks(torrent, index){
    const pieceLen = pieceLength(torrent, index);
    return  Math.ceil(pieceLen/BLOCK_LENGTH);
}

//Last Block is of different size so making an abstraction.
export function blockLength(torrent, pindex, bindex){
    const pieceLen = pieceLength(torrent,pindex);
    const lastBlockLength = pieceLen%BLOCK_LENGTH;
    const lastBlockIndex = Math.floor(pieceLen/BLOCK_LENGTH);
    if(lastBlockIndex === bindex) return lastBlockLength;
    return BLOCK_LENGTH;
}