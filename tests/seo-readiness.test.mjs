import test from "node:test";
import "./rescue-report-feed.test.mjs";
import "./rescue-subscribe.test.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import {spawnSync} from "node:child_process";
import {onRequest as adFreeMiddleware} from "../functions/_middleware.js";

const origin="https://deep-cuts-edh.pages.dev";
const read=path=>fs.readFileSync(path,"utf8");
const sitemap=read("sitemap.xml");
const robot=read("robots.txt");
const PUB="ca-pub-1885127351876276";
const SCRIPT='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+PUB+'" crossorigin="anonymous"></script>';
const expectedPaths=["/","/games/hive-run/","/games/mana-heist/","/rescues","/games","/games/cold-case","/games/obscurity-ladder",
 "/games/arcane-cipher","/games/conspiracy-board","/games/stackbreaker","/games/stackbreaker/classic/","/case-file","/matchmaker","/deep-cut-finder","/binder-to-brew","/combos","/library",
 "/set-watch","/deck","/community","/nominations","/supporters",
 "/reports/chainer-dementia-master","/reports/alena-and-gilanra",
 "/reports/commander-mustard","/reports/ekthi-contaminator-priest","/privacy"];
const adPages=["index.html","library.html","reports/chainer-dementia-master.html",
 "reports/alena-and-gilanra.html","reports/commander-mustard.html",
 "reports/ekthi-contaminator-priest.html"];
const staticHtml=path=>path==="/"? "index.html":path==="/games/hive-run/"?"games/hive-run/index.html":path==="/games/mana-heist/"?"games/mana-heist/index.html":path==="/games/stackbreaker/classic/"?"games/stackbreaker/classic/index.html":path.slice(1)+".html";
const canonical=html=>[...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)].map(t=>t[0].match(/\bhref=["']([^"']+)/)?.[1]);
const noIndex=html=>/<meta\s+[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);

test("Sitemap passes a strict XML parser and contains no stray text or escape sequences",()=>{
 assert.equal(sitemap.includes(String.raw`\n`),false,"Literal backslash-n breaks the sitemap schema");
 const py=[
  "import sys,json,xml.etree.ElementTree as ET",
  "root=ET.fromstring(sys.stdin.read())",
  "ns='{http://www.sitemaps.org/schemas/sitemap/0.9}'",
  "assert root.tag==ns+'urlset'",
  "assert not (root.text or '').strip()",
  "rows=[]",
  "for entry in root:",
  " assert entry.tag==ns+'url'",
  " assert not (entry.text or '').strip()",
  " assert not (entry.tail or '').strip()",
  " assert [c.tag for c in entry]==[ns+'loc',ns+'lastmod']",
  " assert all(not (c.tail or '').strip() for c in entry)",
  " rows.append([entry[0].text,entry[1].text])",
  "print(json.dumps(rows))"
 ].join("\n");
 const result=spawnSync("python3",["-c",py],{input:sitemap,encoding:"utf8"});
 assert.equal(result.status,0,"Invalid XML: "+result.stderr);
 const entries=JSON.parse(result.stdout);
 assert.equal(entries.length,27);
 assert.deepEqual(entries.map(x=>new URL(x[0]).pathname),expectedPaths);
 assert.equal(new Set(entries.map(x=>x[0])).size,entries.length);
 for(const [uri,date] of entries){
  const u=new URL(uri);assert.equal(u.origin,origin);assert.equal(u.search,"");assert.equal(u.hash,"");
  assert.equal(u.href,origin+u.pathname);
  assert.match(date,/^2026-10-(?:13|14|15|16|19|20|26|27)$/);
  assert.ok(Date.parse(date+"T00:00:00Z")<=Date.now(),"Future sitemap lastmod");
  assert.ok(!/\/(?:api|admin|diagnostics|member-operations|members|profile)(?:\/|$)/.test(u.pathname));
  assert.ok(!u.pathname.endsWith(".html"));
 }
});
test("Sitemap dates reflect source-verified, substantive page changes rather than release day",()=>{
 const rows=new Map([...sitemap.matchAll(/<url>[\s\S]*?<\/url>/g)].map(x=>[x[0].match(/<loc>https:\/\/deep-cuts-edh\.pages\.dev([^<]+)<\/loc>/)?.[1],x[0].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]]));
 // See GitHub source history for launch/major content changes, not today's build time.
 const expected={
  "/":"2026-10-19", // Matchmaker discovery link and follow.it homepage signup launched
  "/games/hive-run/":"2026-10-19", // Dominion 2.0 launch
  "/games":"2026-10-27", // New verified Arcade Daily/Classic choices, game discoverability and accurate descriptors
  "/games/mana-heist/":"2026-10-26", // Owner-authorized unranked beta
  "/games/stackbreaker":"2026-10-20", // Daily board and rankings overhaul (#93)
  "/games/stackbreaker/classic/":"2026-10-27", // Owner-authorized 250-stage first-party Classic promotion
  "/binder-to-brew":"2026-10-16", // Specialist deckbuilding resource changes
  "/deep-cut-finder":"2026-10-19", // Matchmaker discovery link integrated
  "/combos":"2026-10-16", // Specialist handoffs
  "/library":"2026-10-15", // Artist search and distinct art options
  "/deck":"2026-10-16", // Broken external deck-tutor destination removed
  "/community":"2026-10-16", // Rescue Challenge submissions
  "/nominations":"2026-10-15", // Rescue Board findings and nomination display
  "/privacy":"2026-10-19" // follow.it newsletter data disclosures
 };
 for(const [path,date] of Object.entries(expected)){
  assert.equal(rows.get(path),date,"Unverified or stale material lastmod: "+path);
 }
});
test("Discovery sitemap excludes noindex, owner and verification endpoints",()=>{
 for(const path of ["/subscribe","/profile","/members","/member-operations","/diagnostics","/404",
   "/api/","/google7b284a3c34baa4aa","/google9a5fa26d2f63a39b"]){
  assert.ok(!sitemap.includes("<loc>"+origin+path),path+" should not be a sitemap result");
 }
 assert.match(read("games/stackbreaker.html"),/<link rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/games\/stackbreaker">/);
 assert.match(read("binder-to-brew.html"),/<link rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/binder-to-brew">/);
 assert.match(robot,/Disallow: \/api\//);
});
test("Each sitemap page has a real public HTML asset, one exact self-canonical, one H1 and no noindex",()=>{
 for(const path of expectedPaths){
  const filename=staticHtml(path);assert.ok(fs.existsSync(filename),filename+" missing");
  const html=read(filename);
  assert.match(html,/<!doctype html>/i);
  assert.equal(canonical(html).length,1,filename+" should have one canonical");
  assert.equal(canonical(html)[0],origin+path,filename+" canonical mismatch");
  assert.equal(noIndex(html),false,filename+" accidentally set noindex");
  assert.equal((html.match(/<h1\b/gi)||[]).length,1,filename+" has incorrect H1 count");
  assert.match(html,/<meta\s+name="viewport"/i,filename+" not mobile readable");
 }
});
test("Every sitemap URL resolves without authentication in local clean-URL static preview",async()=>{
 const server=http.createServer((req,res)=>{
  const path=new URL(req.url,"http://localhost").pathname;
  if(!expectedPaths.includes(path)){res.writeHead(404).end();return}
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}).end(read(staticHtml(path)));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  for(const path of expectedPaths){
   const res=await fetch("http://127.0.0.1:"+server.address().port+path);
   assert.equal(res.status,200,path+" local preview fails");
   assert.match(res.headers.get("content-type"),/text\/html/i);
  }
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test("Robots allows indexing public pages, references exactly this sitemap and excludes private tools",()=>{
 assert.match(robot,/^User-agent:\s*\*$/m);
 assert.match(robot,/^Allow:\s*\/$/m);
 assert.match(robot,new RegExp("^Sitemap: "+origin.replaceAll(".","\\.")+"/sitemap\\.xml$","m"));
 for(const path of ["/api/","/diagnostics","/member-operations","/members"])
  assert.ok(robot.includes("Disallow: "+path),"Missing robots restriction "+path);
 assert.equal(noIndex(read("profile.html")),true);
 assert.equal(noIndex(read("diagnostics.html")),true);
 assert.equal(noIndex(read("member-operations.html")),true);
 assert.equal(sitemap.includes(origin+"/profile"),false);
});
test("Legacy Arcade /games/index.html has a permanent redirect to /games, not a sitemap entry",()=>{
 const redirects=read("_redirects");
 assert.match(redirects,/^\/games\/index\.html\s+\/games\s+301$/m);
 assert.ok(!sitemap.includes("/games/index.html"));
 assert.ok(!sitemap.includes("/games/</loc>"));
});
test("Cloudflare global middleware permanently redirects Arcade legacy index before static lookup",async()=>{
 for(const method of ["GET","HEAD"]){
  let nextCalled=false;
  const res=await adFreeMiddleware({
   request:new Request(origin+"/games/index.html?from=old",{method}),env:{},
   next:async()=>{nextCalled=true;return new Response("wrong",{"status":200})}
  });
  assert.equal(res.status,301);
  assert.equal(res.headers.get("location"),origin+"/games");
  assert.equal(nextCalled,false);
 }
});
test("AdSense verified publisher record and exactly six intentional ad-enabled HTML pages",()=>{
 const ads=read("ads.txt").trim();
 assert.equal(ads,"google.com, pub-1885127351876276, DIRECT, f08c47fec0942fa0");
 const files=["index.html","library.html","games.html","privacy.html","community.html",
  "deck.html","profile.html","members.html","member-operations.html","diagnostics.html",
  "nominations.html","supporters.html","set-watch.html","deep-cut-finder.html","binder-to-brew.html","combos.html",
  "games/hive-run/index.html",...fs.readdirSync("games").filter(p=>p.endsWith(".html")).map(p=>"games/"+p),
  ...fs.readdirSync("reports").filter(p=>p.endsWith(".html")).map(p=>"reports/"+p)];
 for(const file of files){
  const html=read(file),adsCount=html.split(SCRIPT).length-1;
  const pubMeta=(html.match(/<meta\s+name="google-adsense-account"\s+content="ca-pub-1885127351876276">/g)||[]).length;
  const expected=adPages.includes(file)?1:0;
  assert.equal(adsCount,expected,file+": unexpected AdSense tag count");
  assert.equal(pubMeta,expected,file+": unexpected AdSense publisher meta count");
  assert.ok(!/class=["']adsbygoogle["']|adsbygoogle\.push\s*\(/i.test(html),file+": unexpected manual ad slot");
 }
 const privacy=read("privacy.html");
 for(const term of ["Advertising and cookies","Google AdSense","personalized Google ads","Privacy"])
  assert.ok(privacy.includes(term),"Privacy policy missing "+term);
});
test("Ko-fi ad-free middleware recognizes clean canonical paths, their HTML aliases, and leaves games ad-free",async()=>{
 const cookie="__Host-dc_device=dcdevice1_"+"a".repeat(64);
 for(const file of adPages){
  const path=file==="index.html"?"/":"/"+file.slice(0,-5);
  for(const candidate of new Set([path,path==="/"?"/index.html":path+".html"])){
   const response=await adFreeMiddleware({
    request:new Request(origin+candidate,{headers:{Cookie:cookie}}),
    env:{},
    next:async()=>new Response("<html>"+SCRIPT+"</html>",{headers:{"Content-Type":"text/html"}})
   });
   assert.equal(response.headers.get("X-DeepCuts-Ad-Free"),"member",candidate);
   assert.equal((await response.text()).includes(SCRIPT),false,"Ad tag survived member middleware on "+candidate);
  }
  const noCookie=await adFreeMiddleware({
   request:new Request(origin+path),env:{},
   next:async()=>new Response("<html>"+SCRIPT+"</html>",{headers:{"Content-Type":"text/html"}})
  });
  assert.equal((await noCookie.text()).includes(SCRIPT),true,"Guest ad eligibility incorrectly stripped on "+path);
 }
 for(const path of ["/games","/games/cold-case","/profile","/members"]){
  const response=await adFreeMiddleware({
   request:new Request(origin+path,{headers:{Cookie:cookie}}),env:{},
   next:async()=>new Response("unchanged",{"status":200})
  });
  assert.equal(await response.text(),"unchanged","Non-ad page unexpectedly intercepted: "+path);
 }
});
test("Factual structured data passes JSON parsing and never claims ratings or review counts",()=>{
 for(const file of ["index.html","games.html","games/hive-run/index.html"]){
  const html=read(file),blocks=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(blocks.length>=1,file+" lacks factual metadata");
  for(const [,raw] of blocks){
   const data=JSON.parse(raw);
   assert.equal(data["@context"],"https://schema.org");
   assert.ok(data["@type"]);
   assert.ok(!/aggregateRating|reviewCount|ratingValue/.test(raw),"Invented SEO review metrics");
  }
 }
});
