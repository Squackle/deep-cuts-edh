import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {launchBrowser} from './helpers/browser.mjs';
const origin='http://tools.test';
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.svg':'image/svg+xml','.png':'image/png'};
const card=(name,type_line='Creature — Soldier')=>({name,type_line,color_identity:['W','R'],legalities:{commander:'legal'},oracle_text:'Soldier',prices:{usd:'1.00'}});
const commander=card('Commander Mustard','Legendary Creature — Human Soldier');
async function fixture(page,handle){
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(await handle(route,u))return;
  if(u.origin!==origin)return route.abort();
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:{}});
  const name=u.pathname.slice(1),file=resolve(process.cwd(),extname(name)?name:name+'.html');
  if(!file.startsWith(process.cwd()+'/'))return route.abort();
  try{return route.fulfill({contentType:types[extname(file)]||'application/octet-stream',body:readFileSync(file)})}
  catch{return route.fulfill({status:404,body:'Not found'})}
 });
}
test('Finder preserves either editorial or exploratory cards during a partial outage and clears obsolete results',{timeout:45000},async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  let mode='editorial-down';
  await fixture(page,async(route,u)=>{
   if(u.hostname==='api.scryfall.com'&&u.pathname==='/cards/named'){await route.fulfill({json:commander});return true}
   if(u.hostname==='api.scryfall.com'&&u.pathname==='/cards/autocomplete'){await route.fulfill({json:{data:[]}});return true}
   if(u.hostname==='api.scryfall.com'&&u.pathname==='/cards/search'){
    await route.fulfill(mode==='editorial-down'?{json:{data:[null,card('Exploratory Soldier')]}}:{status:503,json:{error:'Unavailable'}});return true;
   }
   if(u.pathname==='/api/tool-cards'){
    await route.fulfill(mode==='editorial-down'?{status:503,json:{error:'Unavailable'}}:{json:{cards:[card('Raise the Alarm','Instant')]}});return true;
   }
   return false;
  });
  await page.goto(origin+'/deep-cut-finder?commander=Commander%20Mustard',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Exploratory Soldier'}).waitFor();
  assert.match(await page.locator('#finderStatus').textContent(),/Editorial card lookup is temporarily unavailable/);
  assert.equal(await page.locator('#finderResults .dt-card').count(),1);
  mode='search-down';
  await page.locator('#finderCommander').fill('Commander Mustard ');
  assert.equal(await page.locator('#finderIdentity').isVisible(),false);
  assert.equal(await page.locator('#finderResults .dt-card').count(),0);
  await page.locator('#finderForm button').click();
  await page.getByRole('heading',{name:'Raise the Alarm'}).waitFor();
  assert.match(await page.locator('#finderStatus').textContent(),/Automated rule-text candidates are temporarily unavailable/);
  assert.equal(await page.locator('#finderResults .dt-card').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }finally{await browser.close()}
});
test('Combo Finder distinguishes unavailable results from confirmed empty results and removes old results when the list changes',{timeout:45000},async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  let mode='partial';
  await fixture(page,async(route,u)=>{
   if(u.pathname==='/api/external'){
    await route.fulfill(mode==='partial'?{json:{ok:true,combo:null,bracket:{gameChangerCards:[]},warnings:['Combo lookups unavailable.']}}:
     {json:{ok:true,combo:{included:[],almostIncluded:[]},bracket:{gameChangerCards:[]},warnings:[]}});return true;
   }
   return false;
  });
  await page.goto(origin+'/combos',{waitUntil:'domcontentloaded'});
  await page.locator('#comboCommander').fill('Commander Mustard');
  await page.locator('#comboInput').fill('1 Sol Ring');
  await page.locator('#checkCombos').click();
  await page.waitForFunction(()=>document.querySelector('#spellbookStatus').textContent.includes('Partial lookup'));
  assert.match(await page.locator('#combosIncluded').textContent(),/unavailable/);
  assert.match(await page.locator('#combosMissing').textContent(),/unavailable/);
  assert.doesNotMatch(await page.locator('#combosIncluded').textContent(),/No confirmed/);
  mode='empty';
  await page.locator('#checkCombos').click();
  await page.waitForFunction(()=>document.querySelector('#spellbookStatus').textContent.includes('Lookup complete'));
  assert.match(await page.locator('#combosIncluded').textContent(),/No confirmed complete combos/);
  await page.locator('#comboInput').fill('1 Arcane Signet');
  assert.equal(await page.locator('#combosIncluded').textContent(),'');
  assert.match(await page.locator('#spellbookStatus').textContent(),/Paste a list/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }finally{await browser.close()}
});
