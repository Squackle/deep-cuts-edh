import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weeklySitemap,serveWeeklySitemap,onRequestGet,onRequestHead} from '../functions/sitemap-weekly.xml.js';
import {EDITORIAL_EDITIONS} from '../src/weekly-rescue-editions.js';
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
