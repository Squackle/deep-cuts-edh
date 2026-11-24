import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {launchBrowser} from './helpers/browser.mjs';
const origin='http://network.test';
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.svg':'image/svg+xml','.png':'image/png'};
const profile=handle=>({profile:{id:handle,handle,avatar:'Commander Mustard',bio:'Profile fixture'},counts:{comments:0,tests:0,followers:0},badges:[],decks:[]});
test('Field Network ignores superseded lookups and clears failed profiles',{timeout:45000},async()=>{
 const browser=await launchBrowser();
 let releaseAlice,aliceStarted,aliceFinished;
 const held=new Promise(r=>releaseAlice=r),started=new Promise(r=>aliceStarted=r),finished=new Promise(r=>aliceFinished=r);
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.origin!==origin)return route.abort();
   if(u.pathname.startsWith('/api/')){
    const action=u.searchParams.get('action');
    if(action==='me')return route.fulfill({status:401,json:{error:'Not signed in'}});
    if(action==='home')return route.fulfill({json:{counts:{profiles:0,decks:0,comments:0,tests:0,findings:0},cases:[]}});
    if(u.pathname==='/api/community'&&action==='profile'){
     const handle=u.searchParams.get('handle');
     if(handle==='Alice'){aliceStarted();await held;await route.fulfill({json:profile(handle)});aliceFinished();return}
     if(handle==='Bob')return route.fulfill({json:profile(handle)});
     return route.fulfill({status:404,json:{error:'Not found'}});
    }
    return route.fulfill({status:503,json:{error:'Fixture service unavailable'}});
   }
   const name=u.pathname.slice(1),file=resolve(process.cwd(),extname(name)?name:name+'.html');
   if(!file.startsWith(process.cwd()+'/'))return route.abort();
   try{return route.fulfill({contentType:types[extname(file)]||'application/octet-stream',body:readFileSync(file)})}
   catch{return route.fulfill({status:404,body:'Not found'})}
  });
  await page.goto(origin+'/community#network');
  await page.locator('#findProfile').waitFor();
  await page.locator('#profileSearch').fill('Alice');
  await page.locator('#findProfile').click();
  await started;
  await page.locator('#profileSearch').fill('Bob');
  await page.locator('#findProfile').click();
  await page.locator('#publicProfile .cm-profile-handle').filter({hasText:'@Bob'}).waitFor();
  releaseAlice();await finished;
  await page.waitForTimeout(150);
  assert.match(page.url(),/profile=Bob$/);
  assert.match(await page.locator('#publicProfile').textContent(),/@Bob/);
  assert.doesNotMatch(await page.locator('#publicProfile').textContent(),/@Alice/);
  await page.locator('#profileSearch').fill('Missing');
  await page.locator('#findProfile').click();
  await page.waitForFunction(()=>document.querySelector('#publicProfile').textContent.includes('Could not load'));
  assert.doesNotMatch(await page.locator('#publicProfile').textContent(),/@Bob/);
  assert.equal(await page.locator('#publicProfile').getAttribute('aria-busy'),null);
  assert.match(page.url(),/#network$/);
  await page.locator('#profileSearch').fill('!');
  await page.locator('#findProfile').click();
  assert.match(await page.locator('#publicProfile').textContent(),/valid investigator handle/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }finally{releaseAlice();await browser.close()}
});
