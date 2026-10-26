import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {catalogDestination,bulkDownloadUrl,writeCatalogSnapshot} from '../tools/catalog-output.mjs';
test('offline catalog accepts only JSON basenames inside its data directory',()=>{
 assert.ok(catalogDestination().pathname.endsWith('/data/mana-oracle-candidates.json'));
 assert.ok(catalogDestination('research-20261026.json').pathname.endsWith('/data/research-20261026.json'));
 for(const name of ['../main.js','/tmp/evil.json','sub/file.json','sub\\file.json','page.html','x.json.js','.json','x?y.json','a'.repeat(121)+'.json'])assert.throws(()=>catalogDestination(name));
});
test('bulk URL requires exact HTTPS Scryfall data origin and JSON export',()=>{
 const metadata={type:'oracle_cards',download_uri:'https://data.scryfall.io/oracle-cards/oracle-cards-20261026.json'};
 assert.equal(bulkDownloadUrl(metadata),metadata.download_uri);
 for(const download_uri of ['http://data.scryfall.io/a.json','https://data.scryfall.io.evil.test/a.json','https://evil.test/data.scryfall.io/a.json','https://user:pass@data.scryfall.io/a.json','https://data.scryfall.io/a.js','https://data.scryfall.io/a.json#fragment'])assert.throws(()=>bulkDownloadUrl({...metadata,download_uri}));
 assert.throws(()=>bulkDownloadUrl({...metadata,type:'other'}));
});
test('catalog writes JSON data and refuses overwrites or symlinks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mana-catalog-'));
 try{
  const path=join(dir,'snapshot.json'),url=pathToFileURL(path),snapshot={cards:[{name:'Example',oracle_text:'";process.exit();<script>unsafe()</script>'}]};
  await writeCatalogSnapshot(url,snapshot);
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')),snapshot);
  await assert.rejects(writeCatalogSnapshot(url,{cards:[]}),{code:'EEXIST'});
  const target=join(dir,'source.js'),link=join(dir,'link.json');
  await writeFile(target,'unchanged');await symlink(target,link);
  await assert.rejects(writeCatalogSnapshot(pathToFileURL(link),snapshot),{code:'EEXIST'});
  assert.equal(await readFile(target,'utf8'),'unchanged');
 }finally{await rm(dir,{recursive:true,force:true});}
});
