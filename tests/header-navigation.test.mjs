import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const js=fs.readFileSync("header-profile.js","utf8"),css=fs.readFileSync("header-profile.css","utf8");
test("Desktop navigation is a progressive enhancement, not a replacement for failed JS",()=>{
 assert.match(js,/site-desktop-ready/);
 assert.match(css,/site-desktop-ready>\.primary-nav\{display:none\}/);
 assert.match(css,/\.site-desktop-navigation\{display:none\}/);
 assert.match(js,/root\.insertBefore\(desktop,nav\)/);
});
test("Four concise desktop destinations and 3 grouped dropdowns",()=>{
 for(const group of ['section("DISCOVER"','section("RESOURCES"','section("CONNECT"'])
  assert.ok(js.includes(group),"Missing grouped destination "+group);
 assert.match(js,/site-desktop-arcade/);
 assert.match(js,/node\("details","site-desktop-group"\)/);
 assert.match(js,/node\("summary","site-desktop-trigger"\)/);
});
test("Core site pages and the two new Commander tools remain reachable",()=>{
 for(const label of ["RESCUE REPORT","COMMANDERS","CARD LIBRARY","SET WATCH","DEEP CUT FINDER",
   "TOOLS & RESOURCES","COMBO FINDER","ARCADE","NOMINATIONS","COMMUNITY","MEMBERS' LOUNGE"]){
  assert.ok(js.includes('"'+label+'"'),"Lost navigation link "+label);
 }
 assert.ok(js.includes('"/deep-cut-finder"'));
 assert.ok(js.includes('"/combos"'));
 assert.ok(js.includes('"/set-watch"'));
 assert.ok(js.includes('"/games"'));
});
test("Mobile menu structure and quick links are preserved",()=>{
 for(const marker of ['site-menu-toggle','site-mobile-shortcuts','site-mobile-games',
   'site-mobile-watch','site-nav-heading','site-nav-group','site-nav-open']){
  assert.ok(js.includes(marker),"Missing mobile UI "+marker);
 }
 assert.match(js,/const mobileGroups=/);
 assert.match(js,/items\.get\(name\)/);
 assert.doesNotMatch(js,/links\.find\(a=>a\.getAttribute\("href"\)===url\)/);
});
test("Dropdowns support keyboard, focus, Escape and outside-click dismissal",()=>{
 assert.match(js,/details\.addEventListener\("toggle"/);
 assert.match(js,/document\.addEventListener\("pointerdown"/);
 assert.match(js,/e\.key!=="Escape"/);
 assert.match(js,/opened\.querySelector\("summary"\)\?\.focus\(\)/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/prefers-reduced-motion/);
});
test("Desktop and mobile breakpoints keep separate navigation systems",()=>{
 assert.match(css,/@media\(min-width:1181px\)/);
 assert.match(css,/@media\(max-width:1180px\)/);
 assert.match(js,/max-width: 1180px/);
});
// These static fallback labels are intentionally plain text. Never reconstruct
// apparently valid labels by stripping nested or malformed markup.
function fallbackLabels(nav){
 const labels=[];
 const anchor=/<a(?=\s)((?:\s+(?:href|class|aria-current)="[^"<>]*")+)\s*>([^<>]+)<\/a>/y;
 let cursor=0;
 while(cursor<nav.length){
  const space=/\s*/y;space.lastIndex=cursor;space.exec(nav);cursor=space.lastIndex;
  if(cursor===nav.length)break;
  anchor.lastIndex=cursor;
  const match=anchor.exec(nav);
  assert.ok(match,"Fallback nav must contain complete anchors with plain text labels");
  const attrs=new Map();
  for(const [,name,value] of match[1].matchAll(/\s+(href|class|aria-current)="([^"<>]*)"/g)){
   assert.ok(!attrs.has(name),"Duplicate fallback attribute");
   attrs.set(name,value);
  }
  assert.ok(attrs.has("href")&&attrs.get("href").length>0,"Fallback anchor must have a destination");
  labels.push(match[2].trim());cursor=anchor.lastIndex;
 }
 return labels;
}
test("Fallback labels reject nested and reconstructed markup",()=>{
 assert.deepEqual(fallbackLabels('<a href="/deck">TOOLS & RESOURCES</a>'),["TOOLS & RESOURCES"]);
 for(const markup of ['<a href="/deck">TOOLS & RESOURCES','<a-extra href="/deck">TOOLS & RESOURCES</a>','<a href="/bad" href="/deck">TOOLS & RESOURCES</a>','<!-- <a href="/deck">TOOLS & RESOURCES</a> -->','<a href="/deck">TOOLS & RESOURCES</a><broken>'])assert.throws(()=>fallbackLabels(markup),{code:"ERR_ASSERTION"});
 for(const value of ['COMM<b></b>UNITY','COMM<scr<script>ipt>UNITY','COMMUNITY<!--hidden-->','COMMUNITY<img src=x onerror=alert(1)>']){
  assert.throws(()=>fallbackLabels('<a href="/community">'+value+'</a>'),/plain text/);
 }
});
test("All public pages retain the same eight fallback links",()=>{
 const pages=["index.html","games.html","community.html","deck.html","library.html","nominations.html",
 "set-watch.html","supporters.html","deep-cut-finder.html","binder-to-brew.html",
 "games/arcane-cipher.html","games/conspiracy-board.html"];
 const expected=["RESCUE REPORT","COMMANDERS","CARD LIBRARY","TOOLS & RESOURCES","ARCADE","NOMINATIONS","COMMUNITY","MEMBERS' LOUNGE"];
 for(const file of pages){
  const html=fs.readFileSync(file,"utf8");
  const match=html.match(/<nav\b[^>]*class="primary-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(match,file+" has no primary links");
  const labels=fallbackLabels(match[1]);
  assert.deepEqual(labels,expected,file+" fallback nav labels differ");
 }
});

test("Community, Members' Lounge, and Connect labels are clear and consistent",()=>{
 const pages=["index.html","community.html","members.html","supporters.html","deck.html","games.html","library.html","nominations.html","set-watch.html","privacy.html","deep-cut-finder.html","binder-to-brew.html","404.html",
 "games/cold-case.html","games/obscurity-ladder.html","games/arcane-cipher.html","games/conspiracy-board.html",
 "reports/chainer-dementia-master.html","reports/alena-and-gilanra.html","reports/commander-mustard.html","reports/ekthi-contaminator-priest.html"];
 for(const file of pages){
  const html=fs.readFileSync(file,"utf8");
  assert.ok(html.includes(">COMMUNITY</a>"),file+" Community link missing");
  assert.ok(html.includes(">MEMBERS' LOUNGE</a>"),file+" Members' Lounge link missing");
  assert.doesNotMatch(html,/>FIELD NETWORK<\/a>|>FIELD OFFICE<\/a>/,file+" legacy menu remains");
  assert.match(html,/href="\/community(?:\.html)?"/,file+" must preserve community URL");
  assert.match(html,/href="\/members(?:\.html)?"/,file+" must preserve membership URL");
 }
 assert.match(js,/section\("CONNECT",\["NOMINATIONS","COMMUNITY","MEMBERS' LOUNGE"\]\)/);
 assert.match(js,/\["CONNECT",\["NOMINATIONS","COMMUNITY","MEMBERS' LOUNGE"\]\]/);
 assert.match(fs.readFileSync("community.html","utf8"),/<h1>THE <em>COMMUNITY\.<\/em><\/h1>/);
 assert.match(fs.readFileSync("members.html","utf8"),/<h1>Members' <em>Lounge\.<\/em><\/h1>/);
 assert.match(fs.readFileSync("index.html","utf8"),/<strong>Community<\/strong>/);
});
