import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,readdirSync} from 'node:fs';
import {join,extname} from 'node:path';
import {launchBrowser} from './helpers/browser.mjs';

const pages=['/','/library','/deck','/deep-cut-finder','/combos','/set-watch','/games','/community','/profile','/members','/supporters','/nominations','/reports/chainer-dementia-master','/reports/commander-mustard','/privacy'];

const PUBLIC_DIRS=new Set(['assets','games','reports','images','fonts','media','data']);
const PUBLIC_EXT=new Set(['.html','.js','.mjs','.css','.svg','.json','.webp','.png','.jpg','.jpeg','.gif','.ico','.woff','.woff2','.ttf','.avif','.webmanifest']);
const TYPES={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.avif':'image/avif','.webmanifest':'application/manifest+json'};

// Preload a finite public-only snapshot before accepting any HTTP requests.
// Never pass request paths to fs: URL normalization alone cannot block
// symlinks or satisfy the test server's path-injection security contract.
function snapshotPublicAssets(){
 const assets=new Map(),root=process.cwd();
 const walk=(dir,prefix='')=>{
  for(const entry of readdirSync(dir,{withFileTypes:true})){
   if(entry.isSymbolicLink()||entry.name.startsWith('.'))continue;
   const rel=prefix?prefix+'/'+entry.name:entry.name;
   if(entry.isDirectory()){
    if(!prefix&&!PUBLIC_DIRS.has(entry.name))continue;
    walk(join(dir,entry.name),rel);
   }else if(entry.isFile()){
    const extension=extname(entry.name).toLowerCase();
    if(!PUBLIC_EXT.has(extension)||(!prefix&&extension==='.json'))continue;
    assets.set('/'+rel,readFileSync(join(dir,entry.name)));
   }
  }
 };
 walk(root);
 // This single shared URL helper is a public browser import, but src/** as a
 // directory must never become a freely browsable test fixture.
 const publicModule='src/challenge-source-url.js';
 assets.set('/'+publicModule,readFileSync(join(root,publicModule)));
 return assets;
}
test('browser fixture serves public assets only, never internal app code or private files',()=>{
 const assets=snapshotPublicAssets();
 assert.ok(assets.has('/index.html'));
 for(const secret of ['/functions/api/decks.js','/src/member-auth.js','/.git/config','/tests/audit-navigation-browser.test.mjs','/package.json'])
  assert.equal(assets.has(secret),false,secret);
});

test('Core pages render without script errors, missing assets or mobile overflow during API outages',{timeout:90000},async t=>{
 const assets=snapshotPublicAssets();
 const server=createServer((req,res)=>{
  let pathname;
  try{pathname=new URL(req.url,'http://local').pathname}
  catch{return res.writeHead(400).end('Invalid fixture URL')}
  if(pathname==='/')pathname='/index.html';
  else if(!extname(pathname))pathname+='.html';
  const bytes=assets.get(pathname);
  if(!bytes)return res.writeHead(404).end('Missing fixture asset');
  const type=TYPES[extname(pathname).toLowerCase()]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type}).end(bytes);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 t.after(()=>new Promise(r=>server.close(r)));
 const browser=await launchBrowser();t.after(()=>browser.close());
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  try{
   // No application request can reach production or any external provider.
   await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==base)return route.abort();
    if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic service outage"}'});
    return route.continue();
   });
   for(const pathname of pages)await t.test(width+'px '+pathname,async()=>{
    const page=await context.newPage(),errors=[],missing=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',r=>{if(r.status()===404&&new URL(r.url()).origin===base)missing.push(new URL(r.url()).pathname)});
    try{
     const response=await page.goto(base+pathname,{waitUntil:'networkidle'});assert.equal(response.status(),200);
     await page.locator('h1').first().waitFor({state:'visible'});
     assert.ok(await page.locator('nav.primary-nav[aria-label]').count());
     assert.deepEqual(errors,[],pathname+' script errors');assert.deepEqual(missing,[],pathname+' missing first-party assets');
     const dimensions=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
     assert.ok(dimensions.page<=dimensions.viewport+1,pathname+' horizontal overflow: '+JSON.stringify(dimensions));
    }finally{await page.close()}
   });
  }finally{await context.close()}
 }
});
