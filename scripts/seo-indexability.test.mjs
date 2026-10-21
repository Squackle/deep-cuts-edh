/* Search indexing guardrails for the public Cloudflare Pages static site.
 * This validates discovery/canonical consistency, NOT Google's actual index.
 * Search Console's Page indexing and URL Inspection reports are the ground truth.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ORIGIN='https://deep-cuts-edh.pages.dev';
const read=relative=>readFileSync(path.join(ROOT,relative),'utf8');
const attr=(tag,name)=>{
 const match=tag.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(["\\x27])([\\s\\S]*?)\\1','i'));
 return match?match[2]:'';
};
const findTag=(html,tag,needle,value)=>{
 const tags=html.match(new RegExp('<'+tag+'\\b[^>]*>','gi'))||[];
 return tags.find(t=>attr(t,needle).toLowerCase()===value.toLowerCase())||'';
};
const canonicalFor=html=>attr(findTag(html,'link','rel','canonical'),'href');
const descriptionFor=html=>attr(findTag(html,'meta','name','description'),'content');
const robotsFor=html=>attr(findTag(html,'meta','name','robots'),'content');
const titleFor=html=>((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').trim();
const entries=[...read('sitemap.xml').matchAll(/<url>\s*<loc>(.*?)<\/loc>(?:\s*<lastmod>(.*?)<\/lastmod>)?\s*<\/url>/g)]
 .map(m=>({url:m[1].replace(/&amp;/g,'&'),lastmod:m[2]||''}));
const routeFile=pathname=>{
 if(pathname==='/')return 'index.html';
 if(pathname.endsWith('/'))return pathname.slice(1)+'index.html';
 return pathname.slice(1)+'.html';
};
const isPrivate=html=>/\bnoindex\b/i.test(robotsFor(html));
const allHtml=()=>{
 const results=[];
 for(const dir of ['.','games','reports']){
  const full=path.join(ROOT,dir);
  if(!existsSync(full))continue;
  for(const item of readdirSync(full,{withFileTypes:true})){
   if(item.isFile()&&item.name.endsWith('.html')){
    results.push(path.posix.join(dir,item.name).replace(/^\.\//,''));
   }
  }
 }
 return results;
};
test('public sitemap is well-formed, distinct, canonical and has only public HTTPS URLs',()=>{
 assert.match(read('sitemap.xml'),/<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
 assert.ok(entries.length>=24,'Do not accidentally drop existing public landing pages');
 assert.equal((read('sitemap.xml').match(/<loc>/g)||[]).length,entries.length,'Each URL needs a proper <url> block');
 const urls=new Set();
 for(const entry of entries){
  const url=new URL(entry.url);
  assert.equal(url.origin,ORIGIN,'Wrong site in sitemap: '+entry.url);
  assert.equal(url.search,'','Do not index search/filter query variants: '+entry.url);
  assert.equal(url.hash,'','No fragments in sitemap: '+entry.url);
  assert.ok(!urls.has(url.pathname),'Duplicate sitemap path: '+url.pathname);
  urls.add(url.pathname);
  assert.ok(!entry.lastmod||/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod),'Invalid lastmod: '+entry.url);
  assert.ok(!entry.lastmod||entry.lastmod<='2026-10-21','Future-dated lastmod: '+entry.url);
 }
});
test('all sitemap URLs have an actual HTML page, unique title, description, H1 and self-canonical',()=>{
 const titles=new Map();
 for(const {url} of entries){
  const pathname=new URL(url).pathname,file=routeFile(pathname);
  assert.ok(existsSync(path.join(ROOT,file)),'Missing static page for '+url+' expected '+file);
  const html=read(file);
  const title=titleFor(html),desc=descriptionFor(html),canonical=canonicalFor(html);
  assert.ok(title.length>=12&&title.length<=110,'Invalid title in '+file+' ('+title+')');
  assert.ok(!titles.has(title),'Duplicate page titles: '+file+' and '+titles.get(title));
  titles.set(title,file);
  assert.ok(desc.length>=45&&desc.length<=250,'Missing/thin meta description in '+file);
  assert.equal((html.match(/<h1(?:\s|>)/gi)||[]).length,1,'Every public page needs one semantic H1: '+file);
  assert.equal(canonical,url,'Canonical and sitemap URL differ for '+file);
  assert.ok(!isPrivate(html),'An excluded/noindex page must not be listed: '+file);
 }
});
test('robots explicitly advertises sitemap and does not disallow public canonical routes',()=>{
 const robots=read('robots.txt');
 assert.match(robots,/User-agent:\s*\*/i);
 assert.ok(robots.includes('Sitemap: '+ORIGIN+'/sitemap.xml'));
 const disallowed=[...robots.matchAll(/^Disallow:\s*(\/\S*)/gmi)].map(m=>m[1]);
 for(const {url} of entries){
  const pathname=new URL(url).pathname;
  assert.ok(!disallowed.some(prefix=>pathname.startsWith(prefix)),
   'Public sitemap URL is disallowed by robots.txt: '+url);
 }
});
test('sitemap also covers every self-canonical public HTML page in root/game/report routes',()=>{
 const available=new Set(entries.map(e=>e.url));
 const missing=[];
 for(const file of allHtml()){
  const html=read(file),canonical=canonicalFor(html);
  if(!canonical||isPrivate(html))continue;
  let url;try{url=new URL(canonical)}catch{continue}
  if(url.origin!==ORIGIN)continue;
  if(!available.has(url.href))missing.push(file+' -> '+url.href);
 }
 assert.deepEqual(missing,[],'Add any newly published public canonical HTML page to sitemap.xml');
});
test('account/owner pages remain outside the public sitemap',()=>{
 const listed=new Set(entries.map(e=>new URL(e.url).pathname));
 for(const route of ['/profile','/members','/member-operations','/diagnostics']){
  assert.ok(!listed.has(route),'Never submit account or internal URL: '+route);
 }
 for(const file of ['profile.html','members.html','member-operations.html']){
  if(!existsSync(path.join(ROOT,file)))continue;
  assert.match(robotsFor(read(file)),/\bnoindex\b/i,'Account/owner HTML must be noindex: '+file);
 }
});
