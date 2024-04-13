import {getPeers} from './tracker.mjs'
import net from 'net';
import {Buffer} from 'buffer';
import bencode from 'bencode'
import { buildInterested,buildHandshake, parseMsg, buildRequest} from './peer_wire_comm.mjs';
export function download(torrent){
    console.log(torrent);
    console.log("tracker's url :", torrent.announce.toString('utf8'));
    const requested = [] //this is the list of all blocks requested.
    getPeers(torrent,(peers)=>{
        console.log("List of peers :", peers);  
        peers.forEach(peer => {
            downloadOne(peer, torrent, requested)
        });
    })

}
/*
TODO: Handy dandy explanation
When the TCP protocol sends some data as a stream of bytes. check peer_wire_comm.mjs 
it sends the length of the message that is followed by correct order of bytes in stream
socket.on will get passed the bytes as they come which is not what we want. we want the 
bytes all in ONE message so we implement a buffer on our end to recv. in UDP this was ez
cuz we need only recv the datagram and each one is treated as a seperate msg!
*/
function onWholeMsg (socket, callback)
{
    //For seeing why this is msglen go to peer_wire and look over the formats.
    //check the incoming databuffer first 4bytes in non handshake and 1st byte in handshake
    //to figure out what the data length will be. now remember the first data that 
    //peers send is going to be length of the message so taht will be at the start of
    //incoming buffer (possible FIXME:)
    let savedBuf = Buffer.alloc(0);
    let handshake = true;

    socket.on('data', recvBuf => {
        // msgLen calculates the length of a whole message
        // const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
        let msgLen = 0;

        savedBuf = Buffer.concat([savedBuf, recvBuf]);

        if(handshake && savedBuf.length>=1) msgLen = savedBuf.readUInt8(0) + 49;
        else if(!handshake && savedBuf.length >=4 ) msgLen = savedBuf.readInt32BE(0) + 4;

        while (savedBuf.length >= 4 && savedBuf.length >= msgLen && msgLen != 0) {
        callback(savedBuf.slice(0, msgLen));
        savedBuf = savedBuf.slice(msgLen);
        handshake = false;
        }
    });
}
function downloadOne(peer, torrent, requested)
{
    //TODO:
    const socket = new net.Socket();
    const queue = [] //create a new queue
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        socket.write(buildHandshake(torrent)); //initiate handshake as client
    });
    onWholeMsg(socket, wholeMsg => msgHandler(wholeMsg, socket, requested, queue));
}
function msgHandler(wholeMsg, socket, requested, queue){
    if(isHandshake(wholeMsg)){
        console.log("message recieved, Handshake complete : ", wholeMsg);
        socket.write(buildInterested());
    }
    else{
        const parsed = parseMsg(wholeMsg);
        if (parsed.id === 0) chokeHandler();
        if (parsed.id === 1) unchokeHandler();
        if (parsed.id === 4) haveHandler(parsed.payload, socket, requested, queue);
        if (parsed.id === 5) bitfieldHandler(parsed.payload);
        if (parsed.id === 7) pieceHandler(parsed.payload, socket, requested, queue);
    }
}
function isHandshake(msg) {
    const btprotocol = msg.toString('utf8', 1).substring(0,19);
    return msg.length === msg.readUInt8(0) + 49 &&
           btprotocol === 'BitTorrent protocol';
}


function chokeHandler() { 

}

function unchokeHandler() { 

}

function haveHandler(payload, socket, requested, queue) { 
    const pieceIndex = payload.readUInt32BE(0);
    queue.push(pieceIndex); 
    if(queue.length === 1){
        requestPiece(socket,requested, queue);
    }
}

function requestPiece(socket, requested, queue) {
    if (requested[queue[0]]) {
      queue.shift();
    } else {
      // this is pseudo-code, as buildRequest actually takes slightly more
      // complex arguments
      socket.write(message.buildRequest(pieceIndex));
    }
  }

function bitfieldHandler(payload) { 

}

function pieceHandler(payload, socket, requested, queue) { 
   
}