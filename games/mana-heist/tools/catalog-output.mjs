// Offline research data only: never overwrite a source file or prior snapshot.
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export function catalogDestination(name='mana-oracle-candidates.json'){
 if(typeof name!=='string'||name.length>120||!/^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/.test(name))throw new Error('Output must be a simple .json filename inside the game data directory');
 return new URL('../data/'+name,import.meta.url);
}
export function bulkDownloadUrl(metadata){
 if(metadata?.type!=='oracle_cards'||typeof metadata.download_uri!=='string')throw new Error('Unexpected bulk export metadata');
 const url=new URL(metadata.download_uri);
 if(url.origin!=='https://data.scryfall.io'||url.username||url.password||url.hash||!url.pathname.endsWith('.json'))throw new Error('Unexpected Scryfall bulk download URL');
 return url.href;
}
export async function writeCatalogSnapshot(destination,snapshot){
 // JSON encoding prevents remote card text from becoming executable source/HTML.
 const json=JSON.stringify(snapshot,null,2);
 await mkdir(dirname(fileURLToPath(destination)),{recursive:true});
 // Exclusive create also rejects existing symlinks; reruns require a new name.
 await writeFile(destination,json,{encoding:'utf8',flag:'wx'});
}
