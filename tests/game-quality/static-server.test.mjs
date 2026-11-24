import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAssetServer} from '../../scripts/game-quality/static-server.mjs';
test('local asset server denies traversal, symlinks, private files and writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'game-assets-')),publicDir=join(dir,'public');
 mkdirSync(publicDir);writeFileSync(join(publicDir,'index.html'),'SAFE');
 writeFileSync(join(dir,'secret.html'),'PRIVATE');
 writeFileSync(join(publicDir,'.secret.html'),'PRIVATE');
 writeFileSync(join(publicDir,'secret.env'),'PRIVATE');
 const deniedPaths=['/secret.html','/.secret.html','/secret.env','/escape/secret.html','/%2e%2e/secret.html','/..%2fsecret.html'];
 // Windows junctions exercise directory-link exclusion without symlink privileges.
 symlinkSync(dir,join(publicDir,'escape'),process.platform==='win32'?'junction':'dir');
 if(process.platform!=='win32'){
  symlinkSync(join(dir,'secret.html'),join(publicDir,'linked.html'),'file');
  deniedPaths.push('/linked.html');
 }
 const server=createAssetServer([{directory:publicDir}]);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal(await(await fetch(origin+'/')).text(),'SAFE');
  for(const path of deniedPaths)assert.equal((await fetch(origin+path)).status,404,path);
  assert.equal((await fetch(origin+'/',{method:'POST',body:'bad'})).status,405);
  // Files introduced after the server starts are outside the approved snapshot.
  writeFileSync(join(publicDir,'late.html'),'PRIVATE');
  assert.equal((await fetch(origin+'/late.html')).status,404);
 }finally{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});}
});

