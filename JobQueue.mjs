import { BLOCK_LENGTH, blockLength, numBlocks } from "./parser.mjs";

export class Queue{
    constructor(torrent, peer=''){
        this.queue = [];
        this.choked = true;
        this.torrent = torrent;
        this.peer = peer
    }
    setChoked(state) {
        this.choked = state;
    }
    getChoked(state) {
        return this.choked;
    }
    enqueue(index){
        //piece index = index 
        const numblocks = numBlocks(this.torrent, index);
        for(let i = 0; i < numblocks; i++)
        {
            //what we pass to build request.
            const block = {
                index : index,
                begin : i*BLOCK_LENGTH,
                length: blockLength(this.torrent, index, i)
            };
            this.queue.push(block);
        }
    }
    dequeue(){
        return this.queue.shift();
    }
    get(ind){
        return this.queue[ind];
    }
    size(){
        return this.queue.length;
    }
}