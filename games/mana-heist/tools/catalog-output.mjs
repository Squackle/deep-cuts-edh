// Offline research data only. Never overwrite gameplay code, other paths, or existing snapshots.
import {mkdir,lstat,realpath,open,rm} from 'node:fs/promises';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable,Transform} from 'node:stream';
import {createGunzip} from 'node:zlib';

export const MAX_METADATA_BYTES=128*1024;
export const MAX_BULK_BYTES=384*1024*1024;
export const MAX_COMPRESSED_BYTES=96*1024*1024;
export const MAX_ORACLE_CARDS=100000;
export const MAX_CANDIDATES=50000;
export const MAX_SNAPSHOT_BYTES=64*1024*1024;
const DATA_DIR=resolve(fileURLToPath(new URL('../data/',import.meta.url)));
const GAME_DIR=fileURLToPath(new URL('../',import.meta.url));
const OUTPUT_NAME=/^[A-Za-z0-9][A-Za-z0-9_-]*\.json$/;
const TYPES=['Artifact','Instant','Sorcery'];
const TAGS=['add','treasure','untap','modify','cost'];
const LEGALITY=['legal','not_legal','banned','restricted','unknown'];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function plainObject(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
}
function bounded(value,label,max,{optional=false}={}){
 if(optional&&(value===null||value===undefined))return;
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)||
    (!label.includes('text')&&/[\t\r\n]/.test(value)))throw new Error('Invalid '+label);
}
function isoDate(value,label){
 bounded(value,label,40);
 if(!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Invalid '+label);
}
function uri(value,label){
 if(value===null||value===undefined)return;
 bounded(value,label,2048);
 let parsed;
 try{parsed=new URL(value)}catch{throw new Error('Invalid '+label)}
 if(parsed.origin!=='https://scryfall.com'||parsed.username||parsed.password||parsed.hash||!parsed.pathname.startsWith('/card/'))throw new Error('Invalid '+label);
}
export function catalogDestination(name='mana-oracle-candidates.json'){
 if(typeof name!=='string'||name.length>120||!name.endsWith('.json')||!OUTPUT_NAME.test(name))
  throw new Error('Output must be a simple .json filename inside the game data directory');
 return new URL('../data/'+name,import.meta.url);
}
export function bulkDownloadUrl(metadata){
 if(!plainObject(metadata)||metadata.type!=='oracle_cards')throw new Error('Unexpected bulk export metadata');
 // Scryfall now also offers compressed JSON Lines; retain the legacy JSON-array fallback.
 const download=metadata.jsonl_download_uri||metadata.download_uri;
 bounded(download,'bulk download URL',2048);
 let url;
 try{url=new URL(download)}catch{throw new Error('Unexpected Scryfall bulk download URL')}
 if(url.origin!=='https://data.scryfall.io'||url.username||url.password||url.hash||url.search||
    !/^\/oracle-cards\/[A-Za-z0-9._-]+\.(?:json|jsonl\.gz)$/.test(url.pathname))
  throw new Error('Unexpected Scryfall bulk download URL');
 return url.href;
}
// Read bounded JSON in memory: no untrusted bulk data is ever persisted to disk.
export async function readLimitedJson(response,byteLimit,label){
 if(!response?.ok||!Number.isSafeInteger(byteLimit)||byteLimit<1||!response.body?.getReader)
  throw new Error('Invalid '+label+' response');
 const type=response.headers?.get('content-type')||'';
 if(!/^application\/(?:json|octet-stream)(?:\s*;|$)/i.test(type))
  throw new Error('Unexpected '+label+' content type');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>byteLimit))
  throw new Error(label+' exceeds byte limit');
 const reader=response.body.getReader(),parts=[];
 let bytes=0,chunks=0;
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   if(!(value instanceof Uint8Array))throw new Error('Invalid '+label+' stream');
   bytes+=value.byteLength;
   if(bytes>byteLimit||++chunks>1000000)throw new Error(label+' exceeds stream limit');
   parts.push(value);
  }
 }catch(error){
  await reader.cancel().catch(()=>{});
  throw error;
 }finally{reader.releaseLock()}
 if(bytes===0)throw new Error('Empty '+label+' response');
 try{return JSON.parse(Buffer.concat(parts,bytes).toString('utf8'))}
 catch{throw new Error('Invalid '+label+' JSON')}
}
function validateSourceCard(card){
 if(!plainObject(card))throw new Error('Invalid Oracle card');
 bounded(card.oracle_id,'Oracle ID',60);
 if(!UUID.test(card.oracle_id))throw new Error('Invalid Oracle ID');
 bounded(card.name,'card name',512);
 if(!card.name)throw new Error('Missing card name');
 for(const key of ['type_line','oracle_text'])bounded(card[key],key,16000,{optional:true});
 for(const key of ['mana_cost','layout'])bounded(card[key],key,200,{optional:true});
 uri(card.scryfall_uri,'Scryfall card URL');
 if(card.color_identity!==undefined&&(!Array.isArray(card.color_identity)||card.color_identity.length>5||
     card.color_identity.some(c=>!['W','U','B','R','G'].includes(c))))
  throw new Error('Invalid color identity');
 if(card.legalities!==undefined&&(!plainObject(card.legalities)||
     (card.legalities.commander!==undefined&&!LEGALITY.includes(card.legalities.commander))))
  throw new Error('Invalid legalities');
 if(card.card_faces!==undefined){
  if(!Array.isArray(card.card_faces)||card.card_faces.length>8)throw new Error('Invalid card faces');
  for(const face of card.card_faces){
   if(!plainObject(face))throw new Error('Invalid card face');
   for(const key of ['name','type_line','oracle_text','mana_cost'])
    bounded(face[key],'face '+key,key==='oracle_text'?16000:512,{optional:true});
  }
 }
}
// Fail rather than generate a partial or unverifiable candidate set.
export function validateOracleCollection(cards){
 if(!Array.isArray(cards)||cards.length>MAX_ORACLE_CARDS)throw new Error('Unexpected Oracle card collection size');
 for(const card of cards)validateSourceCard(card);
 return cards;
}

export async function readOracleCards(response,downloadUrl){
 const url=bulkDownloadUrl({type:'oracle_cards',download_uri:downloadUrl});
 if(url.endsWith('.json'))return validateOracleCollection(await readLimitedJson(response,MAX_BULK_BYTES,'Oracle cards'));
 if(!response?.ok||!response.body)throw new Error('Invalid compressed Oracle response');
 const type=response.headers?.get('content-type')||'';
 if(!/^(?:application\/(?:gzip|x-gzip|octet-stream)|binary\/octet-stream)(?:\s*;|$)/i.test(type))
  throw new Error('Unexpected compressed Oracle content type');
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_COMPRESSED_BYTES))
  throw new Error('Compressed Oracle export exceeds byte limit');

 let compressed=0,uncompressed=0,pending='',count=0;
 const cards=[],decoder=new TextDecoder('utf-8',{fatal:true});
 const MAX_LINE_CHARS=256*1024;
 const input=Readable.fromWeb(response.body);
 const guard=new Transform({transform(chunk,encoding,callback){
  compressed+=chunk.byteLength;
  callback(compressed>MAX_COMPRESSED_BYTES?new Error('Compressed Oracle export exceeds stream limit'):null,chunk);
 }});
 const unzip=createGunzip();
 // Node streams do not forward every upstream error through pipe automatically.
 input.on('error',error=>unzip.destroy(error));
 guard.on('error',error=>unzip.destroy(error));
 input.pipe(guard).pipe(unzip);
 const pushLine=line=>{
  if(!line.trim())return;
  if(line.length>MAX_LINE_CHARS||++count>MAX_ORACLE_CARDS)throw new Error('Oracle JSONL record limit exceeded');
  let card;
  try{card=JSON.parse(line)}catch{throw new Error('Invalid Oracle JSONL card')}
  validateSourceCard(card);
  cards.push(card);
 };
 try{
  for await(const chunk of unzip){
   uncompressed+=chunk.byteLength;
   if(uncompressed>MAX_BULK_BYTES)throw new Error('Oracle export exceeds decompressed byte limit');
   pending+=decoder.decode(chunk,{stream:true});
   let end;
   while((end=pending.indexOf('\n'))>=0){
    pushLine(pending.slice(0,end).trimEnd());
    pending=pending.slice(end+1);
   }
   if(pending.length>MAX_LINE_CHARS)throw new Error('Oversized Oracle JSONL line');
  }
  pending+=decoder.decode();
  if(pending)pushLine(pending.trimEnd());
  return cards;
 }finally{
  input.destroy();
  guard.destroy();
  unzip.destroy();
 }
}
function validateCandidate(card){
 if(!plainObject(card))throw new Error('Invalid candidate');
 const allowed=['oracle_id','name','types','mana_cost','oracle_text','faces','commander_legality','color_identity','tags','scryfall_uri','review'];
 if(Object.keys(card).some(key=>!allowed.includes(key)))throw new Error('Unexpected candidate field');
 validateSourceCard(card);
 if(!Array.isArray(card.types)||!card.types.length||card.types.length>3||card.types.some(t=>!TYPES.includes(t)))
  throw new Error('Invalid candidate types');
 if(!Array.isArray(card.tags)||!card.tags.length||card.tags.length>5||card.tags.some(t=>!TAGS.includes(t)))
  throw new Error('Invalid candidate tags');
 if(!LEGALITY.includes(card.commander_legality)||card.review!=='candidate-unverified')
  throw new Error('Invalid candidate verification status');
 if(card.faces!==undefined){
  if(!Array.isArray(card.faces)||card.faces.length>8)throw new Error('Invalid candidate faces');
  for(const face of card.faces){
   if(!plainObject(face)||Object.keys(face).some(k=>!['name','type_line','oracle_text','mana_cost'].includes(k)))
    throw new Error('Invalid candidate face');
   for(const key of ['name','type_line','oracle_text','mana_cost'])
    bounded(face[key],'candidate face '+key,key==='oracle_text'?16000:512,{optional:true});
  }
 }
}
function validateSnapshot(snapshot){
 if(!plainObject(snapshot)||!plainObject(snapshot.source)||!Array.isArray(snapshot.cards)||
    snapshot.cards.length>MAX_CANDIDATES||snapshot.count!==snapshot.cards.length)
  throw new Error('Invalid catalog snapshot');
 const source=snapshot.source;
 if(source.provider!=='Scryfall'||source.bulk_type!=='oracle_cards')throw new Error('Invalid catalog source');
 bulkDownloadUrl({type:source.bulk_type,download_uri:source.downloaded_file});
 isoDate(source.updated_at,'source updated_at');
 isoDate(source.compiled_at,'compiled_at');
 if(!Number.isSafeInteger(source.oracle_cards_checked)||source.oracle_cards_checked<snapshot.count||
    source.oracle_cards_checked>MAX_ORACLE_CARDS)throw new Error('Invalid source card count');
 bounded(snapshot.scope,'catalog scope',1000);
 bounded(snapshot.caveat,'catalog caveat',1000);
 if(!plainObject(snapshot.counts_by_type))throw new Error('Invalid type counts');
 for(const card of snapshot.cards)validateCandidate(card);
 for(const type of TYPES){
  const count=snapshot.cards.filter(c=>c.types.includes(type)).length;
  if(snapshot.counts_by_type[type]!==count)throw new Error('Mismatched catalog type count: '+type);
 }
 if(Object.keys(snapshot.counts_by_type).some(k=>!TYPES.includes(k)))
  throw new Error('Unexpected type count');
}
export async function writeCatalogSnapshot(destination,snapshot){
 if(!(destination instanceof URL)||destination.protocol!=='file:'||destination.host||
    destination.search||destination.hash)throw new Error('Invalid snapshot destination');
 const path=fileURLToPath(destination);
 if(dirname(path)!==DATA_DIR||!basename(path).endsWith('.json')||
    !OUTPUT_NAME.test(basename(path))||basename(path).length>120)
  throw new Error('Snapshot must stay within the game data directory');
 validateSnapshot(snapshot);
 // JSON-only output; escape HTML delimiters as defense in depth if data is viewed in HTML.
 const json=JSON.stringify(snapshot,null,2).replace(/[<>&\u2028\u2029]/g,ch=>({
  '<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'
 }[ch]));
 if(Buffer.byteLength(json,'utf8')>MAX_SNAPSHOT_BYTES)throw new Error('Catalog snapshot exceeds byte limit');
 await mkdir(DATA_DIR,{recursive:true});
 const stat=await lstat(DATA_DIR);
 if(!stat.isDirectory()||stat.isSymbolicLink()||
    await realpath(DATA_DIR)!==resolve(await realpath(GAME_DIR),'data'))
  throw new Error('Unsafe game data directory');
 // wx prevents clobbering existing files and symlink targets; 0600 is private by default.
 const handle=await open(path,'wx',0o600);
 try{await handle.writeFile(json,{encoding:'utf8'})}
 catch(error){await handle.close();await rm(path,{force:true});throw error}
 await handle.close();
}
