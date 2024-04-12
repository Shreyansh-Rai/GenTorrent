'use strict';
import fs from 'fs'
import bencode from 'bencode'
import dgram, { Socket } from 'dgram'
import {Buffer} from 'buffer'
import url from 'url'
import crypto from 'crypto'

export function getPeers(torrent, callback){
    const socket = dgram.createSocket("udp4");
    const torrentURL = torrent.announce.toString('utf8');
    // const torrentURL = torrent['announce-list'][1].toString('utf8')
    //torrent url is tracker's url
    sendUdp(socket, buildConnectMessage(), torrentURL);
    
    socket.on('message', response => {
        //takes response of tracker
        if(respType(response) == 'connect') //tracker connected send announce
        {
            const parsedResponse = parseConnectResponse(response);
            const announceRequest = buildAnnounceRequest(parsedResponse);
            sendUdp(socket, announceRequest, torrentURL);
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
}

function sendUdp(socket, message, URL, callback=()=>{})
{
    console.log("Talking to ", URL);
    const parsedURL = url.parse(URL, true);
    socket.send(message, 0, message.length, parsedURL.port, parsedURL.hostname, callback);
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
        connection_id: response.slice(8)
    };
    console.log(obj);

    return obj;
}

function buildAnnounceRequest( connectResponse ){
    //TODO Extract the needful : connectionId

}

function parseAnnounceResponse( announceResponse ){
    //TODO Parse and return 
}