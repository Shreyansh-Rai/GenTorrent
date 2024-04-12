import {getPeers} from './tracker.mjs'
export function download(torrent){
    console.log(torrent);
    console.log("tracker's url :", torrent.announce.toString('utf8'));

    getPeers(torrent,(peers)=>{
        console.log("List of peers :", peers);  
        peers.forEach(peer => {
            downloadOne(peer)
        });
    })

}
function downloadOne(peer)
{
    //TODO:
}