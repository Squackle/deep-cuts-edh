import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {extractPublishedRescueReports,renderRescueReportFeed} from '../src/rescue-report-feed.js';
import {onRequestGet} from '../functions/feed.xml.js';
const origin='https://deep-cuts-edh.pages.dev';
const html='<!doctype html><nav aria-label="Published Commander rescue reports"><a class="hub-case-link" href="/reports/commander-mustard"><strong>Commander Mustard</strong><small>Boros Soldiers</small></a><a class="hub-case-link" href="/reports/alena-and-gilanra"><strong>Alena &amp; Gilanra</strong><small>Gruul partners</small></a></nav>';
test('published archive produces stable safe RSS links',()=>{
 const cases=extractPublishedRescueReports(html);
 assert.deepEqual(cases.map(x=>x.title),['Commander Mustard','Alena & Gilanra']);
 const rss=renderRescueReportFeed(html);
 assert.equal((rss.match(/<item>/g)||[]).length,2);
 assert.match(rss,/<title>Alena &amp; Gilanra/);
 assert.match(rss,/guid isPermaLink="true">https:\/\/deep-cuts-edh.pages.dev\/reports\/commander-mustard/);
 assert.doesNotMatch(rss,/<pubDate>/);
});
test('new published report updates feed without changing old GUIDs',()=>{
 const newHtml=html.replace('</nav>','<a class="hub-case-link" href="/reports/new-commander"><strong>New Commander</strong><small>Published</small></a></nav>');
 assert.equal(extractPublishedRescueReports(newHtml).length,3);
 assert.match(renderRescueReportFeed(newHtml),/\/reports\/new-commander/);
 const outside=html+'<a class="hub-case-link" href="/reports/unpublished"><strong>Draft</strong></a>';
 assert.equal(renderRescueReportFeed(outside),renderRescueReportFeed(html));
});
test('rejects malformed archives, duplicate reports, and external links',()=>{
 assert.throws(()=>renderRescueReportFeed(''),/archive/);
 assert.throws(()=>renderRescueReportFeed(html.replace('alena-and-gilanra','commander-mustard')),/Duplicate/);
 assert.throws(()=>renderRescueReportFeed(html.replace('/reports/alena-and-gilanra','https://evil.example/path')),/Invalid published/);
 const malicious=html.replace('<strong>Commander Mustard</strong>','<strong>&lt;script&gt;bad()&lt;/script&gt;</strong>');
 assert.doesNotMatch(renderRescueReportFeed(malicious),/<script>/);
 assert.match(renderRescueReportFeed(malicious),/&lt;script&gt;/);
});
test('Cloudflare Pages endpoint serves public feed and fails closed on missing asset',async()=>{
 const good=await onRequestGet({request:new Request(origin+'/feed.xml'),env:{ASSETS:{fetch:async req=>{
  assert.equal(new URL(req.url).pathname,'/index.html');return new Response(html);
 }}}});
 assert.equal(good.status,200);
 assert.match(good.headers.get('content-type'),/application\/rss\+xml/);
 assert.match(await good.text(),/<rss version="2.0">/);
 const bad=await onRequestGet({request:new Request(origin+'/feed.xml'),env:{ASSETS:{fetch:async()=>new Response('',{status:404})}}});
 assert.equal(bad.status,503);
 assert.equal(bad.headers.get('cache-control'),'no-store');
});

test('published entries come from actual public report assets',()=>{
 const publicHomepage=readFileSync('index.html','utf8');
 const entries=extractPublishedRescueReports(publicHomepage);
 assert.ok(entries.length>=4);
 for(const entry of entries)assert.ok(existsSync('.'+entry.path+'.html'),entry.path+' is not a public report asset');
});
