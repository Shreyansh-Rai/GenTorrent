import {getPeers} from './tracker.mjs'
import net from 'net';
import {Buffer} from 'buffer';
import { PieceManager } from './piecemanager.mjs';
import { buildInterested,buildHandshake, parseMsg, buildRequest} from './peer_wire_comm.mjs';
import { Queue } from './JobQueue.mjs';
import fs from 'fs'
export function download(torrent, path){
    console.log(torrent);
    const file = fs.openSync(path, 'w');
    console.log("tracker's url :", torrent.announce.toString('utf8'));
    //Manages Requested and Recieved pieces. Requested pc not requested again until 
    //ALL pcs are requested and SOME pcs are not recvd. 
    const pieceManager = new PieceManager(torrent);//1 pc=20B
    getPeers(torrent,(peers)=>{
        console.log("List of peers :", peers);  
        peers.forEach(peer => {
            downloadOne(peer, torrent, pieceManager,file)
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
function downloadOne(peer, torrent, pieceManager, file)
{
    //TODO:
    const socket = new net.Socket();
    const queue = new Queue(torrent, peer);
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        socket.write(buildHandshake(torrent)); //initiate handshake as client
    });
    onWholeMsg(socket, wholeMsg => msgHandler(wholeMsg, socket, pieceManager, queue, torrent, file));
}

function msgHandler(wholeMsg, socket, pieceManager, queue, torrent, file){
    if(isHandshake(wholeMsg)){
        console.log("message recieved, Handshake complete : ", wholeMsg);
        socket.write(buildInterested());
    }
    else{
        const parsed = parseMsg(wholeMsg);

        if (parsed.id === 0) chokeHandler(socket);
        if (parsed.id === 1) unchokeHandler(socket,pieceManager,queue);
        if (parsed.id === 4) haveHandler(parsed.payload, socket, pieceManager, queue);
        if (parsed.id === 5) bitfieldHandler(parsed.payload, socket, pieceManager, queue);
        if (parsed.id === 7) pieceHandler(parsed.payload, socket, pieceManager, queue, torrent, file);
    }
}
function isHandshake(msg) {
    const btprotocol = msg.toString('utf8', 1).substring(0,19);
    if(msg.length === undefined || msg === undefined || msg === null) return false;
    return msg.length === msg.readUInt8(0) + 49 &&
           btprotocol === 'BitTorrent protocol';
}


function chokeHandler() { 

}

function unchokeHandler(socket,pieceManager,queue) { 
    queue.choked = false;
    console.log(queue.peer, " has UNCHOKED while", queue.queue);
    requestPiece(socket,pieceManager,queue);
}

function haveHandler(payload, socket, pieceManager, queue) { 
    console.log("HAVE RESPONSE PAYLOAD : ", payload)
    const pieceIndex = payload.readUInt32BE(0);
    const isEmpty = queue.size(); //only first have requests then we request when we 
    //get back a block 
    queue.enqueue(pieceIndex); 
    console.log("Peer : ", queue.peer, " has Appended Piece Index: ", pieceIndex, " To BLOCK queue of length : ", queue.size());
    if(isEmpty === 0){
        requestPiece(socket,pieceManager, queue);
    }
}

function requestPiece(socket, pieceManager, queue) {
    if(queue.choked) return null;
    //request one item to one peer and then allow them to come back to you.
    //this way faster peers will come back more often
    while(queue.size())
    {
        const block = queue.dequeue();
        if(pieceManager.shouldRequest(block))
        {   
            console.log("BLOCK REQUESTED : ", block);
            socket.write(buildRequest(block)); //FIXME: Make it a payload. index, begin, length
            pieceManager.requested(block);
            break;
        }
    }
}

function bitfieldHandler(payload, socket, pieceManager, queue) { 
    /*
        suppose byte is 00000101 = > 0x05 in big endian i want to get 00000101 out
        since this is the actual value of have or not have that index piece
        then byte%2 = 1 that is the 7th index 
        and Similar to have request we only REQUEST once per bitfield and then only
        when we get a piece do we add another item to 
        also payload is a slice or a buffer
    */
    const isEmpty = queue.size() === 0;

    payload.map((byte, index) => {
        for(let i = 7; i>=0; i--)
        {
            const hasPiece = byte%2;
            if(hasPiece === 1)
            {
                queue.enqueue(index*8 + i);
            }
            byte = Math.floor(byte/2);
        }
    })
    if(isEmpty)
    {
        requestPiece(socket,pieceManager,queue);
    }
   
}

function pieceHandler(payload, socket, pieceManager, queue, torrent, file) { 
    /*
    Here the payload is the actual response of the peer containing 
    piece: <len=0009+X><id=7><index><begin><block>
    The piece message is variable length, where X is the length of the block. The payload contains the following information:
    {
        index: integer specifying the zero-based piece index
        begin: integer specifying the zero-based byte offset within the piece
        block: block of data, which is a subset of the piece specified by index.
    }
    So we could still just call it a block for the pieceManager it just cares about the 
    index and begin values.
    */

    pieceManager.recieved(payload);

    //TODO: file write
    const pieceOffset = (payload.index * torrent.info['piece length']);
    const blockOffset = payload.begin;
    const netOffset = pieceOffset + blockOffset;
    //                     offset in buffer             offset in the file
    fs.write(file, payload.block, 0, payload.block.length, netOffset, () => {});
    if(pieceManager.isDone())
    {
        socket.end();
        console.log("Download Complete");
    }
    else
    {
        requestPiece(socket,pieceManager,queue);
    }

}

/*
TODO: SOME THEORY-
A note on Job queues in download.mjs,  the requested list keeps track of the global 
or total number of requested blocks from our peers. now the idea is that we want the
faster peers to get more requests. This is why we create a new queue for each peer 
think of it this way, lets say there is nothing requested = [] and there are 2 peers 
a and b for both of which there is a queue qa = [] and qb = [] both empty. post handshake 
they tell us if they have a certain block or not. let us say a is very fast, and tells us
that he has block 1, 2, 3 so we add the blocks to the queue qa = [1, 2, 3] and then 
request the first block so requested = [ 1 ] and qa = [ 2, 3] at this point qb tells us
that he has qb = [1, 2, 3, 4 ] we check requested for a '1' if it has that, we remove 
1 from qb and continue by requesting 2 as qb = [3 , 4] and requested = [1, 2]. as A wraps 
up with giving us 1 we will ask it to send the next item in qa that is not already requested.
*/