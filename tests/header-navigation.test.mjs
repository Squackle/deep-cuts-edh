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
 for(const group of ['section("DISCOVER"','section("BUILD"','section("COMMUNITY"'])
  assert.ok(js.includes(group),"Missing grouped destination "+group);
 assert.match(js,/site-desktop-arcade/);
 assert.match(js,/node\("details","site-desktop-group"\)/);
 assert.match(js,/node\("summary","site-desktop-trigger"\)/);
});
test("Core site pages and the two new Commander tools remain reachable",()=>{
 for(const label of ["RESCUE REPORT","COMMANDERS","CARD LIBRARY","SET WATCH","DEEP CUT FINDER",
   "DECK WORKSHOP","BINDER TO BREW","ARCADE","NOMINATIONS","FIELD NETWORK","FIELD OFFICE"]){
  assert.ok(js.includes('"'+label+'"'),"Lost navigation link "+label);
 }
 assert.ok(js.includes('"/deep-cut-finder"'));
 assert.ok(js.includes('"/binder-to-brew"'));
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
test("All public pages retain the same eight fallback links",()=>{
 const pages=["index.html","games.html","community.html","deck.html","library.html","nominations.html",
 "set-watch.html","supporters.html","deep-cut-finder.html","binder-to-brew.html",
 "games/arcane-cipher.html","games/conspiracy-board.html"];
 const expected=["RESCUE REPORT","COMMANDERS","CARD LIBRARY","DECK WORKSHOP","ARCADE","NOMINATIONS","FIELD NETWORK","FIELD OFFICE"];
 for(const file of pages){
  const html=fs.readFileSync(file,"utf8");
  const match=html.match(/<nav\b[^>]*class="primary-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(match,file+" has no primary links");
  const labels=[...match[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)]
    .map(m=>m[1].replace(/<[^>]+>/g,"").trim());
  assert.deepEqual(labels,expected,file+" fallback nav labels differ");
 }
});
