import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {
 catalogDestination,bulkDownloadUrl,writeCatalogSnapshot,
 readLimitedJson,validateOracleCollection,MAX_ORACLE_CARDS
} from '../tools/catalog-output.mjs';

const DOWNLOAD='https://data.scryfall.io/oracle-cards/oracle-cards-20261026.json';
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
test('malformed Oracle records and unbounded collections cannot reach classification',()=>{
 const basic={oracle_id:'12345678-abcd-4abc-9abc-123456789abc',name:'Example',
  type_line:'Artifact',oracle_text:'Add {C}.',card_faces:[{name:'Example',type_line:'Artifact',oracle_text:'Add {C}.'}],
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
