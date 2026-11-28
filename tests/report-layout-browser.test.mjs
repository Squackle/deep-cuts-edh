import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {launchBrowser} from './helpers/browser.mjs';

const origin='https://report.test';
const card='<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="#345846"/></svg>';
const types={'.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg'};
const paths=['commander-mustard','alena-and-gilanra','chainer-dementia-master','ekthi-contaminator-priest'];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function measure(browser,slug,width,fail,baseline=false){
 const page=await browser.newPage({viewport:{width,height:950},reducedMotion:'reduce'});
 let release;const gate=new Promise(resolve=>{release=resolve});
 try{
  await page.addInitScript(()=>{
   window.artShifts=[];
   new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.artShifts.push(e.value)}).observe({type:'layout-shift',buffered:true});
  });
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='api.scryfall.com'&&u.pathname==='/cards/named'){
    await gate;
    return fail?route.abort():route.fulfill({contentType:'image/svg+xml',body:card});
   }
   if(u.origin!==origin||route.request().resourceType()==='script')return route.abort();
   const name=u.pathname.replace(/^\//,'');
   const path=resolve(process.cwd(),name.endsWith('.html')||extname(name)?name:name+'.html');
   if(!path.startsWith(process.cwd()+'/'))return route.abort();
   try{
    let body=readFileSync(path);
    if(baseline&&path.endsWith('/reports/guide.css'))body=body.toString().split('/* Reserve the same card geometry')[0];
    if(baseline&&path.endsWith('.html'))body=body.toString().replaceAll(' width="488" height="680"','');
    return route.fulfill({contentType:types[extname(path)]||'application/octet-stream',body});
   }catch{return route.fulfill({status:404,body:'Not found'})}
  });
  await page.goto(origin+'/reports/'+slug,{waitUntil:'domcontentloaded'});
  await settle(page);
  const snapshot=()=>page.evaluate(()=>({facts:document.querySelector('.report-facts').getBoundingClientRect().top,
   hero:document.querySelector('.report-hero').getBoundingClientRect().height,
   media:document.querySelector('.report-hero-media').getBoundingClientRect().height,
   shift:window.artShifts.reduce((a,b)=>a+b,0),overflow:document.documentElement.scrollWidth>innerWidth+1}));
  const before=await snapshot();
  release();
  await page.waitForFunction(()=>[...document.querySelectorAll('.report-hero-media img')].every(i=>i.complete));
  if(fail)await page.waitForFunction(()=>[...document.querySelectorAll('.report-hero-media img')].every(i=>i.parentElement.hasAttribute('data-failed')));
  await settle(page);
  const after=await snapshot();
  return {delta:Math.max(Math.abs(after.facts-before.facts),Math.abs(after.hero-before.hero),Math.abs(after.media-before.media)),
   shift:Math.max(0,after.shift-before.shift),overflow:after.overflow};
 }finally{release();await page.close()}
}
test('report artwork retains layout during delayed success and failure at desktop and mobile sizes',{timeout:90000},async()=>{
 const browser=await launchBrowser();
 try{
  for(const width of [390,1280])for(const fail of [false,true]){
   const old=await measure(browser,'commander-mustard',width,fail,true);
   const now=await measure(browser,'commander-mustard',width,fail);
   console.log('Mustard isolated artwork shift',JSON.stringify({width,fail,baseline:old,candidate:now}));
   assert.ok(now.delta<=2,'Artwork geometry moved '+now.delta+'px at '+width);
   assert.ok(now.shift<0.1,'Isolated artwork shift exceeds 0.1');
   assert.equal(now.overflow,false);
  }
  for(const slug of paths.slice(1))for(const fail of [false,true]){
   const now=await measure(browser,slug,390,fail);
   console.log('Report artwork shift',slug,JSON.stringify({fail,...now}));
   assert.ok(now.delta<=2,slug+' artwork geometry moved '+now.delta+'px');
   assert.ok(now.shift<0.1);assert.equal(now.overflow,false);
  }
 }finally{await browser.close()}
});
