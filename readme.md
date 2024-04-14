## Just an torrent

### unofficial torrent specs : https://wiki.theory.org/BitTorrentSpecification
### BEP : https://www.bittorrent.org/beps/bep_0015.html

### node index.js Torrent_Name.torrent
#### A note on Job queues in download.mjs,  the requested list keeps track of the global or total number of requested blocks from our peers. now the idea is that we want the faster peers to get more requests. This is why we create a new queue for each peer think of it this way, lets say there is nothing requested = [] and there are 2 peers a and b for both of which there is a queue qa = [] and qb = [] both empty. post handshake they tell us if they have a certain block or not. let us say a is very fast, and tells us that he has block 1, 2, 3 so we add the blocks to the queue qa = [1, 2, 3] and then request the first block so requested = [ 1 ] and qa = [ 2, 3] at this point qb tells us that he has qb = [1, 2, 3, 4 ] we check requested for a '1' if it has that, we remove 1 from qb and continue by requesting 2 as qb = [3 , 4] and requested = [1, 2]. as A wraps up with giving us 1 we will ask it to send the next item in qa that is not already requested.

### Future Scope
##### Add a graphic user interface
##### Optimize for better download speeds and more efficient cpu usage. For example some clients calculate which pieces are the rarest and download those first.
##### look for more peers periodically.
##### pausing and resuming downloads.
##### support uploading since currently our client only downloads.