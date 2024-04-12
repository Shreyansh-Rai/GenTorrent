'use strict';
import crypto from 'crypto';
import {Buffer} from 'buffer'
let clientId = null;
export function getId(){
    if(!clientId){
        clientId = crypto.randomBytes(20);
        //Client encoding pattern given in BEP : -AZ2060-.
        Buffer.from('-NG0001-').copy(clientId, 0);
    }
    return clientId;
}