import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {launchBrowser} from './helpers/browser.mjs';

const pages=['/','/library','/deck','/deep-cut-finder','/combos','/set-watch','/games','/community','/profile','/members','/supporters','/nominations','/reports/chainer-dementia-master','/reports/commander-mustard','/privacy'];
test('Core pages render without script errors, missing assets or mobile overflow during API outages',{timeout:90000},async t=>{
 const root=process.cwd();
 const server=createServer((req,res)=>{
  let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(pathname==='/')pathname='/index.html';else if(!extname(pathname))pathname+='.html';
  const filename=resolve(root,'.'+pathname);
  if(!filename.startsWith(root+sep))return res.writeHead(403).end();
  try{
   if(!statSync(filename).isFile())throw Error('Not a file');
   const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.webp':'image/webp','.png':'image/png'}[extname(filename)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type}).end(readFileSync(filename));
  }catch{res.writeHead(404).end('Missing fixture asset')}
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
