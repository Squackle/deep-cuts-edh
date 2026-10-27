import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';

function chrome(){
 for(const name of ['google-chrome','chromium','chromium-browser','google-chrome-stable']){
  try{return execFileSync('which',[name],{encoding:'utf8'}).trim()}catch{}
 }
 throw Error('No Chromium binary available');
}
async function serve(){
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  let pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/games')pathname='/games.html';
  if(pathname.endsWith('/'))pathname+='index.html';
  else if(!path.extname(pathname))pathname+='.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const data=fs.readFileSync(file),ext=path.extname(file);
   const type=ext==='.html'?'text/html':ext==='.css'?'text/css':ext==='.js'?'application/javascript':ext==='.svg'?'image/svg+xml':'application/octet-stream';
   const inner=pathname==='/games/stackbreaker/classic/play.html';
   res.writeHead(200,{'Content-Type':type,'X-Frame-Options':inner?'SAMEORIGIN':'DENY','Content-Security-Policy':inner?"frame-ancestors 'self'; base-uri 'self'; object-src 'none'":"frame-ancestors 'none'; base-uri 'self'; object-src 'none'"}).end(data);
  }catch{res.writeHead(404).end('Not found')}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 return {server,origin:'http://127.0.0.1:'+server.address().port};
}
test('Classic is playable on the main route: map, stages, mana, stack controls and local saves',{timeout:120000},async()=>{
 const {server,origin}=await serve();
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:850}});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(String(error)));
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(origin+'/games/stackbreaker/classic/',{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('header.site-header').count(),1);
    assert.equal(await page.locator('footer.site-footer').count(),1);
    assert.ok((await page.locator('nav.primary-nav a').count())>=8,'shared navigation and additional profile/supporter links');
    const inner=page.frameLocator('#classicGame');
    await inner.locator('#scenarioSelect option').nth(249).waitFor({state:'attached',timeout:25000});
    assert.equal(await inner.locator('#scenarioSelect option').count(),250,'complete campaign');
    assert.equal(await inner.locator('header.mast').count(),0,'no second Lab navigation');
    assert.equal(await inner.locator('#galaxyTabs').count(),1);
    assert.ok((await inner.locator('#hand [data-drag-card]').count())>=7);
    await inner.locator('#mapButton').click();
    assert.ok(await inner.locator('#worldMap').isVisible(),'campaign map opens');
    assert.equal(await inner.locator('#galaxyTabs [data-galaxy-index]').count(),5);
    await inner.locator('#closeMapButton').click();
    assert.ok(!(await inner.locator('#worldMap').isVisible()),'map closes');
    await inner.locator('#scenarioSelect').selectOption({index:1});
    const frame=page.frames().find(f=>f.url().includes('/games/stackbreaker/classic/play.html'));
    assert.ok(frame,'game served from the main site, not external Game Lab');
    assert.equal(await frame.evaluate(()=>localStorage.getItem('dc-stackbreaker-last-level')),'1');
    assert.ok((await inner.locator('#lands [data-land]').count())>=3,'mana sources rendered');
    const land=inner.locator('#lands [data-land]:not([disabled])').first();
    await land.click();
    assert.equal(await inner.locator('#lands [data-land].tapped').count(),1,'tapping land updates mana state');
    await inner.locator('#undoButton').click();
    assert.equal(await inner.locator('#lands [data-land].tapped').count(),0,'undo restores mana');
    await inner.locator('#lands [data-land]:not([disabled])').first().click();
    await inner.locator('#restartButton').click();
    assert.equal(await inner.locator('#lands [data-land].tapped').count(),0,'restart fully resets level');
    for(let i=0;i<3;i++)await inner.locator('#lands [data-land]:not([disabled])').first().click();
    const counter=inner.locator('#hand [data-drag-card][aria-label^="Counterspell"]');
    assert.equal(await counter.count(),1,'physical Counterspell card available');
    await counter.focus();await counter.press('Enter');
    await inner.locator('#stackDrop').focus();await inner.locator('#stackDrop').press('Enter');
    if(await inner.locator('[data-choose-target]').count()){
     await inner.locator('[data-choose-target]').first().click();
    }
    assert.match(await inner.locator('#stack').innerText(),/Counterspell/,'legal cast enters stack');
    for(let i=0;i<3;i++){
     if((await frame.evaluate(()=>JSON.parse(localStorage.getItem('dc-stackbreaker-progress-v3')||'{}')['sb-02']))>0)break;
     await inner.locator('#passButton').click();
    }
    const stars=await frame.evaluate(()=>JSON.parse(localStorage.getItem('dc-stackbreaker-progress-v3')||'{}')['sb-02']||0);
    assert.ok(stars>=1,'won scenario saves stars locally');
    await page.reload({waitUntil:'domcontentloaded'});
    await inner.locator('#scenarioSelect option').nth(249).waitFor({state:'attached'});
    assert.match(await inner.locator('#completed').innerText(),/[1-9]\d* \/ 250 SOLVED/,'progress survives reload');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'outer page has no horizontal overflow at '+width);
    assert.equal(errors.length,0,'no uncaught runtime errors: '+errors.join(', '));
   }finally{await context.close()}
  }
 }finally{await browser?.close();await new Promise(ok=>server.close(ok))}
});
