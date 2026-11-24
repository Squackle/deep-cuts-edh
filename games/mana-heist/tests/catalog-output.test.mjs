import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {
 catalogDestination,bulkDownloadUrl,writeCatalogSnapshot,
 readLimitedJson,readOracleCards,validateBulkMetadata,validateOracleCollection,MAX_ORACLE_CARDS,MAX_COMPRESSED_BYTES
} from '../tools/catalog-output.mjs';

const DOWNLOAD='https://data.scryfall.io/oracle-cards/oracle-cards-20261026.json';
const GZIP_DOWNLOAD='https://data.scryfall.io/oracle-cards/oracle-cards-20261026.jsonl.gz';
function fixture(){
 return {
  source:{provider:'Scryfall',bulk_type:'oracle_cards',updated_at:'2026-10-26T12:00:00Z',
   downloaded_file:DOWNLOAD,oracle_cards_checked:12,compiled_at:'2026-10-26T12:01:00Z'},
  scope:'Offline Oracle discovery, not a game import',
  caveat:'Candidates require human verification',
  count:1,counts_by_type:{Artifact:1,Instant:0,Sorcery:0},
  cards:[{oracle_id:'12345678-abcd-4abc-9abc-123456789abc',name:'Example Artifact',
   types:['Artifact'],mana_cost:'{2}',oracle_text:'Add {C}.',
   commander_legality:'legal',color_identity:[],tags:['add'],
   scryfall_uri:'https://scryfall.com/card/abc/1/example',
   review:'candidate-unverified'}]
 };
}
function uniqueName(){
 return 'security-test-'+process.pid+'-'+randomBytes(8).toString('hex')+'.json';
}
test('offline catalog accepts only plain JSON basenames in the fixed game data directory',()=>{
 assert.ok(catalogDestination().pathname.endsWith('/data/mana-oracle-candidates.json'));
 assert.ok(catalogDestination('research-20261026.json').pathname.endsWith('/data/research-20261026.json'));
 for(const name of ['../main.js','/tmp/evil.json','sub/file.json','sub\\file.json',
  'page.html','x.json.js','.json','x?y.json','a'.repeat(121)+'.json','x.json\n',
  'x.json\r','x.json ','x.json?x=y','%2Fetc.json',null,{}])
  assert.throws(()=>catalogDestination(name),String(name));
});
test('bulk URL accepts only the exact HTTPS Scryfall oracle-cards data directory',()=>{
 assert.equal(bulkDownloadUrl({type:'oracle_cards',download_uri:DOWNLOAD}),DOWNLOAD);
 assert.equal(bulkDownloadUrl({type:'oracle_cards',jsonl_download_uri:GZIP_DOWNLOAD}),GZIP_DOWNLOAD);
 for(const url of ['http://data.scryfall.io/oracle-cards/a.json',
  'https://data.scryfall.io.evil.test/oracle-cards/a.json',
  'https://evil.test/data.scryfall.io/oracle-cards/a.json',
  'https://user:pass@data.scryfall.io/oracle-cards/a.json',
  'https://data.scryfall.io/a.json','https://data.scryfall.io/oracle-cards/a.js',
  'https://data.scryfall.io/oracle-cards/a.json#fragment',
  'https://data.scryfall.io/oracle-cards/a.json?next=https://evil.test',
  'https://data.scryfall.io/oracle-cards/../other.json'])
  assert.throws(()=>bulkDownloadUrl({type:'oracle_cards',download_uri:url}),url);
 assert.throws(()=>bulkDownloadUrl({type:'other',download_uri:DOWNLOAD}));
});
test('bounded network JSON checks response type, byte budget and JSON syntax',async()=>{
 const value=[{name:'safe'}],json=JSON.stringify(value);
 assert.deepEqual(await readLimitedJson(new Response(json,{headers:{'content-type':'application/json; charset=utf-8'}}),100,'bulk'),value);
 await assert.rejects(readLimitedJson(new Response(json,{headers:{'content-type':'text/html'}}),100,'bulk'),/content type/);
 await assert.rejects(readLimitedJson(new Response(json,{headers:{'content-type':'application/json','content-length':'9999'}}),100,'bulk'),/byte limit/);
 await assert.rejects(readLimitedJson(new Response(json,{headers:{'content-type':'application/json'}}),5,'bulk'),/stream limit/);
 await assert.rejects(readLimitedJson(new Response('{bad json',{headers:{'content-type':'application/json'}}),100,'bulk'),/Invalid bulk JSON/);
 await assert.rejects(readLimitedJson(new Response('',{headers:{'content-type':'application/json'}}),100,'bulk'),/Empty/);
});
test('current gzip JSONL and legacy JSON bulk cards both validate with explicit stream limits',async()=>{
 const card={oracle_id:'12345678-abcd-4abc-9abc-123456789abc',
  name:'Example',type_line:'Artifact',oracle_text:'{T}: Add {C}.',color_identity:[]};
 const zipped=gzipSync(Buffer.from(JSON.stringify(card)+'\n'));
 const gz=()=>new Response(zipped,{headers:{'content-type':'application/gzip'}});
 assert.deepEqual(await readOracleCards(gz(),GZIP_DOWNLOAD),[card]);
 assert.deepEqual(await readOracleCards(new Response(JSON.stringify([card]),
  {headers:{'content-type':'application/json'}}),DOWNLOAD),[card]);
 await assert.rejects(readOracleCards(new Response(zipped,{headers:{'content-type':'text/html'}}),GZIP_DOWNLOAD),/content type/);
 await assert.rejects(readOracleCards(new Response(zipped,{headers:{
  'content-type':'application/gzip','content-length':String(MAX_COMPRESSED_BYTES+1)}}),GZIP_DOWNLOAD),/byte limit/);
 await assert.rejects(readOracleCards(new Response(gzipSync(Buffer.from('{invalid json}\n')),
  {headers:{'content-type':'application/gzip'}}),GZIP_DOWNLOAD),/JSONL/);
});
test('malformed Oracle records and unbounded collections cannot reach classification',()=>{
 const basic={oracle_id:'12345678-abcd-4abc-9abc-123456789abc',name:'Example',
  type_line:'Artifact',oracle_text:'Add {C}.\nSpend this mana only for spells.',card_faces:[{name:'Example',type_line:'Artifact',oracle_text:'Add {C}.\nSpend this mana only for spells.'}],
  color_identity:['U'],legalities:{commander:'legal'},scryfall_uri:'https://scryfall.com/card/abc/1/example'};
 assert.deepEqual(validateOracleCollection([basic]),[basic]);
 for(const mutation of [
  {...basic,name:'x'.repeat(513)},
  {...basic,oracle_id:'not-a-uuid'},
  {...basic,card_faces:'arbitrary string'},
  {...basic,card_faces:[{name:'x',oracle_text:'y'.repeat(16001)}]},
  {...basic,color_identity:['INVALID']},
  {...basic,legalities:{commander:{unsafe:true}}},
  {...basic,scryfall_uri:'https://evil.test/card/1'}
 ])assert.throws(()=>validateOracleCollection([mutation]));
 assert.throws(()=>validateOracleCollection(new Array(MAX_ORACLE_CARDS+1).fill(basic)),/size/);
 assert.throws(()=>validateOracleCollection({cards:[basic]}));
});
test('catalog writes only validated inert JSON within fixed directory and never overwrites files or symlinks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mana-catalog-test-'));
 const dest=catalogDestination(uniqueName()),file=fileURLToPath(dest);
 const link=catalogDestination(uniqueName()),linkPath=fileURLToPath(link);
 const outside=pathToFileURL(join(dir,'outside.json'));
 const source=join(dir,'important.js');
 const data=fixture();
 data.cards[0].oracle_text='";process.exit();<script>unsafe()</script>&';
 try{
  await mkdir(dirname(file),{recursive:true});
  await writeFile(source,'important code');
  await assert.rejects(writeCatalogSnapshot(outside,data),/game data directory/);
  await writeCatalogSnapshot(dest,data);
  const raw=await readFile(file,'utf8');
  assert.ok(!raw.includes('<script>'),'HTML delimiter must be escaped in serialized output');
  assert.deepEqual(JSON.parse(raw),data,'JSON value remains unchanged');
  await assert.rejects(writeCatalogSnapshot(dest,data),{code:'EEXIST'});
  await symlink(source,linkPath);
  await assert.rejects(writeCatalogSnapshot(link,data),{code:'EEXIST'});
  assert.equal(await readFile(source,'utf8'),'important code');
  for(const invalid of [
   {...data,count:2},
   {...data,counts_by_type:{Artifact:0,Instant:0,Sorcery:0}},
   {...data,cards:[{...data.cards[0],review:'verified'}]},
   {...data,cards:[{...data.cards[0],unexpected:'network-injected'}]},
   {...data,cards:[{...data.cards[0],oracle_text:'x'.repeat(16001)}]},
   {...data,source:{...data.source,downloaded_file:'https://attacker.test/out.json'}}
  ]){
   await assert.rejects(writeCatalogSnapshot(catalogDestination(uniqueName()),invalid));
  }
 }finally{
  await rm(file,{force:true});await rm(linkPath,{force:true});
  await rm(dir,{recursive:true,force:true});
 }
});

test('offline catalog generator accepts a valid synthetic Scryfall export end to end',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'mana-generator-fixture-'));
 const name=uniqueName(),dest=catalogDestination(name),output=fileURLToPath(dest);
 const preload=join(temp,'fixture-fetch.mjs');
 const metadata={type:'oracle_cards',jsonl_download_uri:GZIP_DOWNLOAD,updated_at:'2026-10-26T12:00:00Z'};
 const cards=[{oracle_id:'12345678-abcd-4abc-9abc-123456789abc',
  name:'Example Artifact',type_line:'Artifact',oracle_text:'{T}: Add {C}.',
  mana_cost:'{2}',layout:'normal',legalities:{commander:'legal'},color_identity:[],
  scryfall_uri:'https://scryfall.com/card/abc/1/example'}];
 // Preload replaces only this test child process's fetch: no live API, network or production data.
 const code='import {gzipSync} from "node:zlib";\n'+
  'const expected='+JSON.stringify(GZIP_DOWNLOAD)+';\n'+
  'const metadata='+JSON.stringify(metadata)+';\n'+
  'const cards='+JSON.stringify(cards)+';\n'+
  'globalThis.fetch=async(url)=>url===expected'+
  '?new Response(gzipSync(Buffer.from(cards.map(c=>JSON.stringify(c)).join("\\n"))),'+
  '{headers:{"content-type":"application/gzip"}})'+
  ':new Response(JSON.stringify(metadata),{headers:{"content-type":"application/json"}});\n';
 try{
  await writeFile(preload,code);
  const tool=fileURLToPath(new URL('../tools/build-mana-catalog.mjs',import.meta.url));
  const run=spawnSync(process.execPath,['--import',preload,tool,name],
   {encoding:'utf8',timeout:25000,env:{...process.env,NODE_NO_WARNINGS:'1'}});
  assert.equal(run.status,0,run.stderr||run.error?.message||run.stdout);
  const json=JSON.parse(await readFile(output,'utf8'));
  assert.equal(json.count,1);
  assert.equal(json.source.provider,'Scryfall');
  assert.equal(json.source.downloaded_file,GZIP_DOWNLOAD);
  assert.equal(json.cards[0].name,'Example Artifact');
  assert.equal(json.cards[0].review,'candidate-unverified');
 }finally{
  await rm(output,{force:true});
  await rm(temp,{recursive:true,force:true});
 }
});

test('metadata is validated before downloading and invalid UTF-8 fails closed',async()=>{
 assert.equal(validateBulkMetadata({type:'oracle_cards',jsonl_download_uri:GZIP_DOWNLOAD,updated_at:'2026-10-26T12:00:00Z'}),GZIP_DOWNLOAD);
 assert.throws(()=>validateBulkMetadata({type:'oracle_cards',download_uri:DOWNLOAD,updated_at:'invalid'}),/updated_at/);
 await assert.rejects(readLimitedJson(new Response(Uint8Array.from([34,255,34]),{headers:{'content-type':'application/json'}}),100,'bulk'),/Invalid bulk JSON/);
});
test('actual compressed and decompressed stream limits and catalog uniqueness fail closed',async()=>{
 const card={oracle_id:'12345678-abcd-4abc-9abc-123456789abc',name:'Example',type_line:'Artifact',oracle_text:'Add {C}.'};
 const line=JSON.stringify(card)+'\n';
 const zipped=gzipSync(Buffer.from(line));
 const gz=bytes=>new Response(bytes,{headers:{'content-type':'application/gzip'}});
 assert.deepEqual(await readOracleCards(gz(zipped),GZIP_DOWNLOAD,{compressedLimit:zipped.length,decompressedLimit:Buffer.byteLength(line)}),[card]);
 await assert.rejects(readOracleCards(gz(zipped),GZIP_DOWNLOAD,{compressedLimit:zipped.length-1}),/stream limit/);
 await assert.rejects(readOracleCards(gz(zipped),GZIP_DOWNLOAD,{decompressedLimit:Buffer.byteLength(line)-1}),/decompressed byte limit/);
 await assert.rejects(readOracleCards(gz(zipped.subarray(0,zipped.length-4)),GZIP_DOWNLOAD));
 await assert.rejects(readOracleCards(gz(gzipSync(Buffer.from(line+line))),GZIP_DOWNLOAD),/Duplicate Oracle ID/);
 await assert.rejects(readOracleCards(gz(gzipSync(Buffer.from('\n'))),GZIP_DOWNLOAD),/collection size/);
 assert.throws(()=>validateOracleCollection([]),/collection size/);
 assert.throws(()=>validateOracleCollection([card,{...card,oracle_id:card.oracle_id.toUpperCase()}]),/Duplicate Oracle ID/);
 const data=fixture();
 data.cards.push({...data.cards[0]});data.count=2;data.counts_by_type.Artifact=2;
 await assert.rejects(writeCatalogSnapshot(catalogDestination(uniqueName()),data),/Duplicate candidate/);
});
