import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weeklySitemap,serveWeeklySitemap,onRequestGet,onRequestHead} from '../functions/sitemap-weekly.xml.js';
import {EDITORIAL_EDITIONS} from '../src/weekly-rescue-editions.js';
import publisher from '../workers/weekly-rescue-publisher.js';
import {onRequestGet as archiveRoute} from '../functions/rescues/index.js';
import {onRequestGet as reportRoute} from '../functions/rescues/[week].js';
import {onRequestGet as homeRoute} from '../functions/index.js';
import {onRequestGet as legacyFeedRoute} from '../functions/feed.xml.js';
const root='https://deep-cuts-edh.pages.dev';
const row=(date,extra={})=>({date,commander:'A real commander',theme:'A real theme',...extra});
const urls=xml=>[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
test('weekly sitemap contains unique valid canonical dated public routes, not untrusted content or fake lastmod',()=>{
 const xml=weeklySitemap([row('2026-11-20'),row('2026-10-30'),row('2026-11-20'),row('2026-02-30'),row('2026-11-31'),row('2026-10-30"><evil>'),row('2026-11-27',{commander:null}),row('2026-11-28',{theme:' '}),row('2028-02-29')]);
 assert.deepEqual(urls(xml),['2026-10-30','2026-11-20','2028-02-29'].map(d=>root+'/rescues/'+d));
 assert.match(xml,/xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
 assert.doesNotMatch(xml,/lastmod|evil|<api>/);
});
test('remote published index and repository editions merge automatically; HEAD matches GET',async()=>{
 const calls=[];const fetchJson=async path=>{calls.push(path);return {reports:[row('2026-10-30'),row(EDITORIAL_EDITIONS[0].date)]}};
 const get=await serveWeeklySitemap(fetchJson),head=await serveWeeklySitemap(fetchJson,{head:true});
 assert.equal(get.status,200);
 assert.match(get.headers.get('content-type'),/^application\/xml/);
 assert.deepEqual(urls(await get.text()),[...new Set(['2026-10-30',...EDITORIAL_EDITIONS.map(x=>x.date)])].sort().map(d=>root+'/rescues/'+d));
 assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.equal(head.headers.get('cache-control'),get.headers.get('cache-control'));
 assert.deepEqual(calls,['/v1/index','/v1/index']);
});
test('an unreachable or malformed remote index returns a retryable noncacheable 503, not a misleading partial sitemap',async()=>{
 for(const fetchJson of [async()=>{throw Error('offline')},async()=>({}),async()=>({reports:null})]){
  const res=await serveWeeklySitemap(fetchJson);assert.equal(res.status,503);
  assert.equal(res.headers.get('retry-after'),'300');assert.equal(res.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(await res.text(),/<loc>/);
 }
});
test('robots advertises both sitemap routes while the static inventory remains static',()=>{
 const robots=readFileSync(new URL('../robots.txt',import.meta.url),'utf8');
 assert.ok(robots.includes('Sitemap: '+root+'/sitemap.xml'));
 assert.ok(robots.includes('Sitemap: '+root+'/sitemap-weekly.xml'));
 const xml=readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8');
 assert.ok(!urls(xml).some(u=>/\/rescues\/20\d\d-/.test(u)));
 assert.equal(typeof onRequestGet,'function');assert.equal(typeof onRequestHead,'function');
});

test('a partially malformed upstream index cannot advertise an incomplete successful sitemap',async()=>{
 for(const invalid of [null,row('2026-11-31'),row('2026-11-27',{commander:''}),row('2026-11-27',{theme:42})]){
  const upstream=async()=>({reports:[row('2026-10-30'),invalid]});
  const get=await serveWeeklySitemap(upstream),head=await serveWeeklySitemap(upstream,{head:true});
  assert.equal(get.status,503);assert.equal(head.status,503);
  assert.equal(get.headers.get('cache-control'),'no-store');
  assert.equal(head.headers.get('retry-after'),'300');
  assert.equal(await head.text(),'');assert.doesNotMatch(await get.text(),/<loc>/);
 }
});

test('publisher, homepage, dated archive, canonical reports, sitemap and existing subscriber feed agree on their intended inventories',async()=>{
 const editorialDates=EDITORIAL_EDITIONS.map(edition=>edition.date).sort();
 const latestEditorial=editorialDates.at(-1);
 const latestDate=new Date(latestEditorial+'T00:00:00Z');
 const fixtureDate=days=>new Date(latestDate.getTime()+days*86_400_000).toISOString().slice(0,10);
 const date=fixtureDate(7);
 const edition=EDITORIAL_EDITIONS.find(edition=>edition.date===latestEditorial);
 const remote={...edition,date,theme:'Synthetic future test angle'};
 const remoteRow={date,commander:remote.commander.name,theme:remote.theme,headline:remote.sections.headline,imageUrl:remote.commander.imageUrl};
 const store=new Map([['index',JSON.stringify([remoteRow])],['article:'+date,JSON.stringify(remote)]]);
 let writes=0,down=false;
 const publisherEnv={REPORTS:{async get(k,mode){const v=store.get(k)??null;return mode==='json'&&v!==null?JSON.parse(v):v},async put(){writes++;throw Error('Public read path cannot write')}}};
 const original=globalThis.fetch;
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const html=body=>new Response(body,{headers:{'content-type':'text/html; charset=utf-8'}});
 const assets={fetch:async req=>{
  const path=new URL(req.url).pathname;
  if(path==='/rescues')return html(read('rescues.html'));
  if(path==='/index.html')return html(read('index.html'));
  throw Error('Unexpected static asset '+path);
 }};
 globalThis.fetch=async (url,options)=>{
  const request=new Request(url,options),target=new URL(request.url);
  assert.equal(target.hostname,'deep-cuts-weekly-publisher.logan-ottfamily.workers.dev');
  if(down)return new Response('offline',{status:503});
  return publisher.fetch(request,publisherEnv);
 };
 const ctx={request:new Request(root+'/rescues'),env:{ASSETS:assets}};
 const home=()=>homeRoute({next:async()=>html(read('index.html'))});
 try{
  const dates=[...editorialDates,date];
  const archive=await archiveRoute(ctx);assert.equal(archive.status,200);
  const archiveBody=await archive.text();
  const linked=[...archiveBody.matchAll(/class="weekly-index-card" href="\/rescues\/(20\d\d-\d\d-\d\d)"/g)].map(m=>m[1]);
  assert.deepEqual(linked,dates.slice().reverse());
  const sitemap=await onRequestGet();assert.equal(sitemap.status,200);
  assert.deepEqual(urls(await sitemap.text()),dates.map(d=>root+'/rescues/'+d));
  const homepage=await home();assert.equal(homepage.status,200);
  assert.ok((await homepage.text()).includes('id="homeWeeklyFeature" data-weekly-date="'+date+'" href="/rescues/'+date+'"'));
  for(const week of dates){
   const report=await reportRoute({params:{week}});assert.equal(report.status,200,week);
   assert.ok((await report.text()).includes('rel="canonical" href="'+root+'/rescues/'+week+'"'),week);
  }
  assert.equal((await reportRoute({params:{week:fixtureDate(14)}})).status,404);
  const feed=await legacyFeedRoute(ctx);assert.equal(feed.status,200);
  const xml=await feed.text(),guid=[...xml.matchAll(/<guid isPermaLink="true">([^<]+)<\/guid>/g)].map(m=>m[1]);
  assert.equal(guid.length,4);assert.equal(new Set(guid).size,4);
  assert.ok(guid.every(url=>url.startsWith(root+'/reports/')));
  assert.doesNotMatch(xml,/\/rescues\/20\d\d-/,'Do not silently add dated articles to the consent-gated subscriber feed');
  down=true;
  assert.equal((await onRequestGet()).status,503);
  const fallback=await archiveRoute(ctx);assert.equal(fallback.status,200);
  const fallbackBody=await fallback.text();assert.ok(fallbackBody.includes('href="/rescues/'+latestEditorial+'"'));
  assert.ok(!fallbackBody.includes('class="weekly-index-card" href="/rescues/'+date+'"'));
  assert.equal((await reportRoute({params:{week:latestEditorial}})).status,200);
  assert.equal((await reportRoute({params:{week:date}})).status,503);
  assert.ok((await (await home()).text()).includes('id="homeWeeklyFeature" data-weekly-date="'+latestEditorial+'" href="/rescues/'+latestEditorial+'"'));
  assert.equal((await legacyFeedRoute(ctx)).status,200);
  assert.equal(writes,0);
 }finally{globalThis.fetch=original}
});
