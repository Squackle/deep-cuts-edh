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
 assert.ok(renderRescueReportFeed(malicious).includes('<title>&lt;script&gt;bad()&lt;/script&gt; — Rescue Report | Deep Cuts EDH</title>'));
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

test('metadata rejects raw nested, repeated and malformed markup instead of deleting substrings',()=>{
 for(const content of ['<em>Commander</em>','<scr<script>ipt>bad','<<img src=x>>','<!-- comment -->Commander','Commander <broken','Commander > broken']){
  for(const tag of ['strong','small']){
   const input=html.replace(tag==='strong'?'<strong>Commander Mustard</strong>':'<small>Boros Soldiers</small>', '<'+tag+'>'+content+'</'+tag+'>');
   assert.throws(()=>renderRescueReportFeed(input),/Invalid published metadata markup/,content);
  }
 }
});
test('RSS description survives XML decoding as safe HTML text, without recursive entity decoding',()=>{
 const input=html.replace('Boros Soldiers','&lt;img src=x onerror=bad()&gt; &amp;&amp; &#60;&#x3e; &amp;lt; &#34;&#39; &nbsp; text');
 const report=extractPublishedRescueReports(input)[0];
 assert.equal(report.excerpt, '<img src=x onerror=bad()> && <> &lt; "\' text');
 const rss=renderRescueReportFeed(input);
 const expected='&amp;lt;img src=x onerror=bad()&amp;gt; &amp;amp;&amp;amp; &amp;lt;&amp;gt; &amp;amp;lt; &amp;quot;&amp;apos; text. Read the published Deep Cuts EDH Commander Rescue Report.';
 assert.ok(rss.includes('<description>'+expected+'</description>'));
 // The XML parser removes exactly one entity layer. HTML readers then see
 // only text entities, not executable markup or a second decode operation.
 const parsed=expected.replace(/&(amp|lt|gt|quot|apos);/g,(_,name)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name]);
 assert.equal(parsed,'&lt;img src=x onerror=bad()&gt; &amp;&amp; &lt;&gt; &amp;lt; &quot;&apos; text. Read the published Deep Cuts EDH Commander Rescue Report.');
 assert.ok(rss.includes('<description>Gruul partners. Read the published Deep Cuts EDH Commander Rescue Report.</description>'));
});
test('invalid XML characters fail closed and valid Unicode survives',async()=>{
 for(const bad of ['\u0000','\u0001','\ud800','\ufffe','&#65535;']){
  assert.throws(()=>renderRescueReportFeed(html.replace('Boros Soldiers','Boros'+bad+'Soldiers')),/Invalid XML character/);
 }
 assert.ok(renderRescueReportFeed(html.replace('Boros Soldiers','Boros &#x1f600;')).includes('Boros 😀'));
 const response=await onRequestGet({request:new Request(origin+'/feed.xml'),env:{ASSETS:{fetch:async()=>new Response(html.replace('Boros Soldiers','<em>bad</em>'))}}});
 assert.equal(response.status,503);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
