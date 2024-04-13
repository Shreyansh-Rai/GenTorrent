'use strict';
import exp from 'constants';
import { getId } from './helper.mjs';
import {getInfoHash,  getSize} from './parser.mjs'
import {Buffer} from 'buffer'
/*
TODO: just drawing your attention here
Messages
All of the remaining messages in the protocol take the form of
 <length prefix><message ID><payload>. 
 The length prefix is a four byte big-endian value. 
 The message ID is a single decimal byte. The payload is message dependent.
*/
export function buildHandshake(torrent)
{
    // handshake: <pstrlen><pstr><reserved><info_hash><peer_id>
    // The handshake is a required message and must be the first message transmitted 
    // by the client. It is (49+len(pstr)) bytes long.
    // pstrlen: string length of <pstr>, as a single raw byte
    // pstr: string identifier of the protocol
    // reserved: eight (8) reserved bytes. All current implementations use all zeroes.
    // peer_id: 20-byte string used as a unique ID for the client.

    // In version 1.0 of the BitTorrent protocol, pstrlen = 19, and pstr = "BitTorrent protocol".
    const handshake = Buffer.alloc(68);
    handshake.writeUInt8(19,0); //pstrlen
    handshake.write('BitTorrent protocol', 1);
    handshake.writeUInt32BE(0, 20); //reserved 
    handshake.writeUInt32BE(0, 24); //reserved
    getInfoHash(torrent).copy(handshake,28);
    getId().copy(handshake, 48);
    return handshake;
}

export function buildKeepAlive()
{
    return Buffer.alloc(4); //all 0s
}

export function buildChoke()
{
    // <len=0001><id=0>
    const choke = Buffer.alloc(5);

    choke.writeUInt32BE(1, 0);

    choke.writeUInt8(0, 4);
    return choke;
}

export function buildUnchoke()
{
    // <len=0001><id=1>
    const unchoke = Buffer.alloc(5);

    unchoke.writeUInt32BE(1, 0);

    unchoke.writeUInt8(1, 4);
    return unchoke;
}

export function buildInterested()
{
    // <len=0001><id=2>
    const interested = Buffer.alloc(5);

    interested.writeUInt32BE(1, 0);

    interested.writeUInt8(2, 4);
    return interested;
}

export function buildUninterested()
{
    // <len=0001><id=3>
    const uninterested = Buffer.alloc(5);

    uninterested.writeUInt32BE(1, 0);

    uninterested.writeUInt8(3, 4);
    return uninterested;
}

export function buildHave(payload){
    // have: <len=0005><id=4><piece index>
    const have = Buffer.alloc(9)
    have.writeUInt32BE(5, 0);
    have.writeUInt8(4, 4);
    have.writeUInt32BE(payload, 5);

    return have;
}

export function buildBitfield(bitfield){
    //bitfield: <len=0001+X><id=5><bitfield> bitfield is just each piece have or not
    //if ith bit is set then ith piece client has. else not.
    const buf = Buffer.alloc(bitfield.length + 1 + 4);
    //FIXME:
    buf.writeUInt32BE(bitfield.length + 1, 0);
    // id
    buf.writeUInt8(5, 4);
    // bitfield
    bitfield.copy(buf, 5);
    return buf;
}

export function buildRequest(payload){ //client asks
    // request: <len=0013><id=6><index><begin><length>
    const req = Buffer.alloc(17); //4 + 1 + 4 + 4 + 4(ints)
    req.writeUInt32BE(13,0);
    req.writeUInt8(6,4);
    req.writeUInt32BE(payload.index,5);
    req.writeUInt32BE(payload.begin,9);
    req.writeUInt32BE(payload.length,13);
}

export function buildPiece(payload){ //client serves
    // piece: <len=0009+X><id=7><index><begin><block>
    const piece = Buffer.alloc(4+1+4+4+payload.block.length);
    piece.writeUInt32BE(9+payload.block.length, 0);
    piece.writeUInt8(7,4);
    piece.writeUInt32BE(payload.index,5);
    piece.writeUInt32BE(payload.begin,9);
    payload.block.copy(piece, 13);
    return piece;
}

export function buildCancel(payload){
    // <len=0013><id=8><index><begin><length>
    const buf = Buffer.alloc(17);
    // length
    buf.writeUInt32BE(13, 0);
    // id
    buf.writeUInt8(8, 4);
    // piece index
    buf.writeUInt32BE(payload.index, 5);
    // begin
    buf.writeUInt32BE(payload.begin, 9);
    // length
    buf.writeUInt32BE(payload.length, 13);
  return buf;
}

export function buildPort(payload){
    // port: <len=0003><id=9><listen-port>

    const buf = Buffer.alloc(7); //FIXME: len is 3 so 3 bytes + len itself(4) = 7.
    // length
    buf.writeUInt32BE(3, 0);
    // id
    buf.writeUInt8(9, 4);
    // listen-port TODO: Verify if a 32 bit int works over here (it should)
    //SPOILER Does work ONLY if length changes but len is specified as 3 in spec.
    buf.writeUInt16BE(payload, 5);
    return buf;
}

export function parseMsg(msg){
    //based on patterns above
    const id = msg.length > 4 ? msg.readInt8(4) : null; //eg keep alive does not have id
    let payload = msg.length > 5 ? msg.slice(5) : null; 
    // request: <len=0013><id=6><index><begin><length>
    // piece: <len=0009+X><id=7><index><begin><block>
    // cancel: <len=0013><id=8><index><begin><length>
    if (id === 6 || id === 7 || id === 8) {
        //payload contains <index><begin><length/block> Skip 8 bytes more for index and begin
        const rest = payload.slice(8);
        payload = {
        index: payload.readInt32BE(0),
        begin: payload.readInt32BE(4)
        };
        payload[id === 7 ? 'block' : 'length'] = rest;
    }

    return {
        size : msg.readInt32BE(0), //first 4 bytes always length
        id : id,
        payload : payload
    }
}