'use strict';
import fs from 'fs'
import bencode from 'bencode'
import dgram, { Socket } from 'dgram'
import {Buffer} from 'buffer'
import url from 'url'
import crypto from 'crypto'
import {getInfoHash, getSize} from './parser.mjs'
import {getId} from './helper.mjs'
export function getPeers(torrent, callback){
    const socket = dgram.createSocket("udp4");
    const torrentURL = torrent.announce.toString('utf8');
    // const torrentURL = torrent['announce-list'][1].toString('utf8')
    //torrent url is tracker's url
    sendUdpExpBoff(socket, buildConnectMessage(), torrentURL);
    
    socket.on('message', response => {
        //takes response of tracker
        if(respType(response) == 'connect') //tracker connected send announce
        {
            const parsedResponse = parseConnectResponse(response);
            const announceRequest = buildAnnounceRequest(parsedResponse, torrent);
            sendUdpExpBoff(socket, announceRequest, torrentURL);
        }
        else if(respType(response) == 'announce')
        {
            const announceResponse = parseAnnounceResponse(response);
            callback(announceResponse.peers);
        }
    })
}

function respType(response){
    const action = response.readUInt32BE(0);
    if(action == 0) return "connect";
    if(action == 1) return "announce";
    else{//2 or 3
        console.log("Stalled")
    }
}

function sendUdp(socket, message, URL, callback=()=>{})
{
    console.log("Talking to ", URL);
    const parsedURL = url.parse(URL, true);
    socket.send(message, 0, message.length, parsedURL.port, parsedURL.hostname, callback);
}

function sendUdpExpBoff(socket,message,URL, callback=()=>{})
{
    let attempt = 0;
    const maxAttempts = 5; // Maximum number of attempts
    const baseTimeout = 15;

    console.log("Talking to ", URL, "Exponential Backoff attempt : ", attempt);
    const parsedURL = url.parse(URL, true);
    
    tryAgain(attempt);
    
    function tryAgain(attempt)
    {
        if(attempt >= maxAttempts)
        {
            console.log("Failed to send Backoff ended");
            return;
        }
        
        socket.send(message, 0, message.length, parsedURL.port, parsedURL.hostname, (err) => {
            if(err){
                console.log(" Packet Failed to reach, Backoff Attempt : ", attempt);
                const retryTime = Math.pow(2, attempt) * baseTimeout * 1000;
                console.log("Retrying in : ", retryTime);
                setTimeout(()=>{
                    tryAgain(attempt+1);
                }, retryTime);
            }
            else{
                console.log("Packet sent in : ", attempt+1, "attempt(s)");
                return;
            }
        });
    }


}

function buildConnectMessage(){
    // Offset  Size            Name            Value
    // 0       64-bit integer  protocol_id     0x41727101980 // magic constant
    // 8       32-bit integer  action          0 // connect
    // 12      32-bit integer  transaction_id
    // 16
    const connectBuffer = Buffer.alloc(16); //16 in bytes
    // connectBuffer.writeBigUInt64BE(0x41727101980,0); // ERR : cannot mix big int and other types 
    connectBuffer.writeUInt32BE(0x417,0);
    connectBuffer.writeUInt32BE(0x27101980,4);

    connectBuffer.writeUInt32BE(0,8); //now at 12

    const randomBuf = crypto.randomBytes(4); //creates a buffer to copy from.
    randomBuf.copy(connectBuffer,12); // copy from random to connect from offset 12 in connect
    return connectBuffer;
}

function parseConnectResponse( response ){
    // Offset  Size            Name            Value
    // 0       32-bit integer  action          0 // connect
    // 4       32-bit integer  transaction_id
    // 8       64-bit integer  connection_id
    // 16
    console.log("Recieved connect response");
    const obj = {
        action : response.readUInt32BE(0),
        transaction_id : response.readUInt32BE(4),
        connection_id: response.slice(8) //a buffer from 8 byte onwards everything
    };
    console.log(obj);

    return obj;
}

function buildAnnounceRequest( connectResponse, torrent, port = 6881){
    //TODO Extract the needful : connectionId
    // Offset  Size    Name    Value                           Status & offset(personal)
    // 0       64-bit integer  connection_id                    DONE 8
    // 8       32-bit integer  action          1 // announce    DONE 12
    // 12      32-bit integer  transaction_id                   DONE 16
    // 16      20-byte string  info_hash                        DONE 36
    // 36      20-byte string  peer_id => our own unq id        DONE 56
    // 56      64-bit integer  downloaded                       DONE 64
    // 64      64-bit integer  left                             DONE 72
    // 72      64-bit integer  uploaded                         DONE 80 
    // 80      32-bit integer  event           0                DONE 84                     // 0: none; 1: completed; 2: started; 3: stopped
    // 84      32-bit integer  IP address      0                DONE 88                     // default
    // 88      32-bit integer  key             ?                DONE 92                     // random
    // 92      32-bit integer  num_want        -1               DONE 96                     // default
    // 96      16-bit integer  port            ?                DONE                        // should be between 6881 and 6889
    // 98
    const connection_id = connectResponse.connection_id;
    const announceRequest = Buffer.alloc(98);
    connection_id.copy(announceRequest,0);
    announceRequest.writeUInt32BE(1,8);
    crypto.randomBytes(4).copy(announceRequest, 12);
    getInfoHash(torrent).copy(announceRequest,16);
    getId().copy(announceRequest,36);
    const downloadBuffer = Buffer.alloc(8);//alloc inits to 0 since BIGINT is weird.
    downloadBuffer.copy(announceRequest,56);
    getSize(torrent).copy(announceRequest,64);
    const uploadBuffer = Buffer.alloc(8);
    uploadBuffer.copy(announceRequest,72);
    announceRequest.writeUInt32BE(0,80); //since we are just announcing for the first time now? check once
    announceRequest.writeUInt32BE(0,84); //or include but only a few cases where useful
    crypto.randomBytes(4).copy(announceRequest, 88);
    announceRequest.writeInt32BE(-1, 92); //TODO: Change later
    announceRequest.writeUInt16BE(port, 96);
    console.log("Building...Announce Request Built");
    return announceRequest;
}

function parseAnnounceResponse( announceResponse ){
    // Offset      Size            Name            Value
    // 0           32-bit integer  action          1 // announce
    // 4           32-bit integer  transaction_id
    // 8           32-bit integer  interval
    // 12          32-bit integer  leechers
    // 16          32-bit integer  seeders
    // 20 + 6 * n  32-bit integer  IP address
    // 24 + 6 * n  16-bit integer  TCP port
    // 20 + 6 * N
    console.log("Announce response : ", announceResponse);
    function group(iterable, groupSize) {
        let groups = [];
        for (let i = 0; i < iterable.length; i += groupSize) {
          groups.push(iterable.slice(i, i + groupSize));
        }
        return groups; //groups of ip addresses of length 6 bytes
    }
    const obj = {
        action: announceResponse.readUInt32BE(0),
        transactionId: announceResponse.readUInt32BE(4),
        leechers: announceResponse.readUInt32BE(8),
        seeders: announceResponse.readUInt32BE(12),
        peers: group(announceResponse.slice(20), 6).map(address => {
          return {
            // ip: `${address.readUInt8(0)}.${address.readUInt8(1)}.${address.readUInt8(2)}.${address.readUInt8(3)}`,
            ip: address.slice(0, 4).join('.'), //TODO: Check alt out
            port: address.readUInt16BE(4)
          }
        })
    }
    return obj;
}