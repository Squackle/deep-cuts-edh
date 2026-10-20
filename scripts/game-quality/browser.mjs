// Local-only UI regression. No production accounts, scores or network APIs.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright-core';
const [manaRoot,stackRoot,output='game-quality-screens']=process.argv.slice(2);
if(!manaRoot||!stackRoot)throw Error('Usage: node scripts/game-quality/browser.mjs <mana-lab-root> <stack-lab-root> [screens-dir]');
const roots={'mana-heist':resolve(manaRoot),'stackbreaker':resolve(stackRoot)};
mkdirSync(output,{recursive:true});
const server=createServer((req,res)=>{
 const p=new URL(req.url,'http://local').pathname,root=roots[p.split('/')[1]]||roots['mana-heist'];
 let f=resolve(root,'.'+p);
 if(!f.startsWith(root+'/'))return res.writeHead(403).end();
 try{
  if(statSync(f).isDirectory())f+='/index.html';
  res.writeHead(200,{'Content-Type':{'.js':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'}[extname(f)]||'application/octet-stream'}).end(readFileSync(f));
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
let browser;
const overlap=(a,b)=>!!a&&!!b&&Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [width,height]of [[320,568],[390,844],[1280,900]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  // Cached metadata may outlive a broken image CDN. The live error handler
  // must replace that image too, not only handle a missing catalog.
  await context.addInitScript(()=>localStorage.setItem('dc-stackbreaker-scryfall-cards-v1',JSON.stringify({at:Date.now(),cards:{'Selfless Spirit':{images:{normal:'https://cards.scryfall.io/test-offline.png'}}}})));
  await context.route('**/*',r=>{
   const u=new URL(r.request().url());
   if(u.origin!==base)return r.abort();
   if(u.pathname.startsWith('/api/'))return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Offline local test"}'});
   return r.continue();
  });
  for(const game of ['mana-heist','stackbreaker']){
   const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.goto(base+'/'+game+'/',{waitUntil:'domcontentloaded'});
    if(game==='mana-heist'){
     await p.locator('[data-mode="heist"]').click();await p.locator('[data-level="0"]').click();
     await p.screenshot({path:resolve(output,game+'-'+width+'.png'),fullPage:true});
     const title=await p.locator('#heist .vault-card>h2').boundingBox();
     for(const id of ['endTurn','undo','reset','skip'])assert.equal(overlap(title,await p.locator('#'+id).boundingBox()),false,'Title overlaps '+id+' at '+width);
     for(const label of await p.locator('#heist .stats>div:nth-child(-n+2) small').all())assert.equal(await label.isVisible(),true,'Status labels must remain visible');
     await p.screenshot({path:resolve(output,game+'-'+width+'.png'),fullPage:true});
     await p.locator('#battlefield [data-cardid]').first().click();
     await p.waitForFunction(()=>!document.querySelector('#castButton').disabled);
     await p.locator('#castButton').click();
     await p.locator('#winStats').waitFor({state:'visible'});
     const save=await p.evaluate(()=>JSON.parse(localStorage.getItem('dc-mana-heist-landfall-v2')));
     assert.ok(Object.keys(save.bests).length,'Win must persist locally');
     await p.reload({waitUntil:'domcontentloaded'});
     assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('dc-mana-heist-landfall-v2')).bests),save.bests);
    }else{
     await p.locator('[data-unit="spirit"] .card-fallback strong').waitFor();
     assert.equal(await p.locator('[data-unit="spirit"] .card-fallback strong').textContent(),'Selfless Spirit');
     assert.ok((await p.locator('[data-land]').first().boundingBox()).height>=40,'Fallback lands need a visible touch target');
     await p.screenshot({path:resolve(output,game+'-'+width+'.png'),fullPage:true});
     await p.locator('[data-unit="spirit"]').click();
     for(let i=0;i<6&&!(await p.locator('#passButton').isDisabled());i++)await p.locator('#passButton').click();
     assert.match(await p.locator('body').innerText(),/SOLVED|CASE CLOSED|VICTORY|Case solved/i);
     await p.locator('#restartButton').click();
     assert.equal(await p.locator('[data-unit="spirit"]').count(),1);
    }
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
    assert.deepEqual(errors,[],game+' runtime errors');
    console.log('PASS '+game+' '+width+'x'+height+' — offline art, render, solve, local state');
   }finally{await p.close();}
  }
  await context.close();
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
