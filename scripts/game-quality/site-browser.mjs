// Read-only local UI inspection of the public Arcade. Every API is isolated.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright-core';
import {onRequestGet as dailyGet,onRequestPost as dailyPost} from '../../functions/api/daily-games.js';
import {onRequestGet as arcaneGet,onRequestPost as arcanePost} from '../../functions/api/arcane-games.js';
const root=resolve('.'),out=resolve(process.argv[2]||'game-quality-screens');mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{
 let f=resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(!f.startsWith(root+'/'))return res.writeHead(403).end();
 try{if(statSync(f).isDirectory())f+='/index.html';
 res.writeHead(200,{'Content-Type':{'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[extname(f)]||'application/octet-stream'}).end(readFileSync(f));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const width of [390,1280])for(const game of ['cold-case','obscurity-ladder','arcane-cipher','conspiracy-board','hive-run/']){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[],writes=[];
  const env={TURNSTILE_SECRET:'fixture',DB:{prepare(sql){return {
   bind(){return this},
   async first(){return sql.includes('INSERT INTO community_limits')?{attempts:1}:null},
   async all(){return {results:[]}},
   async run(){writes.push(sql);return {meta:{changes:1}}}
  }}}};
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==origin)return route.abort();
   const handler=url.pathname==='/api/daily-games'?(req.method()==='POST'?dailyPost:dailyGet):url.pathname==='/api/arcane-games'?(req.method()==='POST'?arcanePost:arcaneGet):null;
   if(handler){const response=await handler({env,request:new Request(req.url(),{method:req.method(),headers:{...req.headers(),origin,'cf-connecting-ip':'198.51.100.29'},...(req.method()==='POST'?{body:req.postData()}:{})})});return route.fulfill({status:response.status,body:await response.text(),contentType:'application/json'});}
   if(url.pathname.startsWith('/api/')||url.pathname.includes('/api/'))return route.fulfill({status:503,body:'{"error":"Offline local test"}',contentType:'application/json'});
   return route.continue();
  });
  p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(origin+'/games/'+game+(game.endsWith('/')?'':'.html?practice=475319'),{waitUntil:'networkidle'});
   if(game==='hive-run/')await p.locator('#primaryButton').waitFor();
   else await p.locator('#practiceNote, #arcanePracticeNote').first().waitFor({timeout:5000});
   assert.deepEqual(errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),game+' horizontal overflow');
   assert.ok(!writes.some(sql=>/INSERT INTO.*(?:score|achievement|daily_result)/i.test(sql)));
   await p.screenshot({path:resolve(out,game.replace('/','')+'-'+width+'.png'),fullPage:true});
   console.log('PASS '+game+' '+width+' render, console and horizontal fit');
  }finally{await ctx.close();}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
