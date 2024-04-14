import { BLOCK_LENGTH, numBlocks } from "./parser.mjs";


export class PieceManager{
    constructor(torrent){
        function init() {
            const size = torrent.info.pieces.length / 20;
            const arr = new Array(size).fill(null);
            return arr.map((_, index) => new Array(numBlocks(torrent,index)).fill(false));
        }
        //map each null to a list of size = num Blocks corresp to that piece
        this.req = init()
        this.rec = init()

        function totalinit(rec){
            let counter = 0;
            for(let i = 0; i < rec.length; i++)
            {
                for(let j = 0; j < rec[i].length; j++)
                {
                    counter += 1;
                }
            }
            return counter;
        }

        this.total = totalinit(this.rec);
        this.progress = 0;
    }

    requested(block){ //block.index = piece index.
        if(block.index >= this.rec.length) return;
        this.req[block.index][block.begin/BLOCK_LENGTH] = true;
    }

    recieved(block){
        if(block.index >= this.rec.length) return;

        this.rec[block.index][block.begin/BLOCK_LENGTH] = true;
        this.progress+=1;
    }
    
    shouldRequest(block){
        let allReq = true;
        const prog = (1.0*this.progress/this.total) * 100;
        console.log("CURRENT PROGRESS :::::::::::::::::::::::::: ", prog);
        for(let i = 0; i < this.req.length; i++)
        {
            for(let j = 0; j < this.req[i].length; j++){
                if(this.req[i][j] === false){
                    allReq = false;
                    break;
                }
            }
            if(allReq === false) break
        }

        if(allReq)
        {
            //if all have been requested BUT some has not been RECVd then :
            this.req = this.rec.map((blockArr => {
                blockArr.slice();
            })) //copy rec to req. so unrecieved can be reqd again
        }

        return !this.req[block.index][block.begin/BLOCK_LENGTH];
    }

    isDone(){
        for(let i = 0; i < this.rec.length; i++){
            for( let j = 0; j < this.rec[i].length;j++)
            {
                if(this.rec[i][j] === false) return false;
            }
        }
        return true;
    }
}