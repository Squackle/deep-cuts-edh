import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {CURRENT_CASE,featuredDeckEligible,publicChallenge} from "../src/featured-case.js";
import {gamesWrite} from "../src/community-games.js";
import "./challenge-submit.test.mjs";
import {communityRead} from "../src/community-read.js";
const own="a".repeat(32),profile="my-player";
const featured={id:"rescue-001",title:"Chainer Resurrection Challenge",commander:"Chainer, Dementia Master",format:"commander",status:"active",opens_at:"2000-01-01 00:00:00",closes_at:"2099-01-01 00:00:00"};
const open={...featured,id:"open-001",format:"open",commander:"Open Format",title:"Open Build Showcase"};
const deck=(name,commanders=[name])=>({owner_id:profile,title:"Test build",commander:name,content:JSON.stringify({commanders,cards:[]})});
function dbMock(ch,owned,entry=owned){
 const changes=[];
 const db={prepare(sql){return {bind(...args){this.args=args;return this},async first(){
  if(sql.includes("FROM community_challenges"))return ch;
  if(sql.includes("FROM community_decks WHERE"))return owned;
  if(sql.includes("FROM community_entries e JOIN community_decks"))return {member_id:"other-person",commander:entry?.commander,content:entry?.content};
  return null;
 },async all(){if(sql.includes("FROM community_challenges"))return {results:[ch]};return {results:[{deck_id:own,title:"Existing",commander:entry?.commander,content:entry?.content,handle:"tester",votes:0}]}},
 async run(){changes.push({sql,args:this.args});return {meta:{changes:1}}}
 }},changes};
 return db;
}
async function submit(ch,owned){
 const d=dbMock(ch,owned),r=await gamesWrite(d,{id:profile},{action:"challenge_entry",deck_id:own,challenge_id:ch.id});
 return {status:r.status,data:await r.json(),changes:d.changes};
}
test("Current featured Commander Mustard matches homepage Featured Case File",()=>{
 const homepage=fs.readFileSync("index.html","utf8");
 assert.match(homepage,new RegExp('class="hub-feature" href="/reports/'+CURRENT_CASE.slug+'"'));
 assert.equal(CURRENT_CASE.commander,"Commander Mustard");
 assert.match(homepage,/Commander<br>Mustard/);
});
test("Featured challenge presents current case regardless of the old persisted title",()=>{
 assert.equal(publicChallenge(featured).commander,"Commander Mustard");
 assert.match(publicChallenge(featured).title,/Commander Mustard/);
 assert.equal(publicChallenge(open).commander,"Open Format");
 assert.equal(publicChallenge(open).title,open.title);
});
test("Featured challenge refuses co-commanders, mentions, old Chainer and missing content",()=>{
 assert.ok(featuredDeckEligible(deck("Commander Mustard")));
 for(const d of [deck("Chainer, Dementia Master"),deck("Commander Mustard & Partner",["Commander Mustard","Partner"]),deck("Commander Mustard",["Chainer, Dementia Master"]),
  {commander:"Commander Mustard",content:"malformed"},deck("Commander Mustard",[])]){
   assert.equal(featuredDeckEligible(d),false,JSON.stringify(d));
 }
});
test("Server rejects incorrect featured entries even if the UI is bypassed",async()=>{
 for(const name of ["Chainer, Dementia Master","Atraxa, Praetors' Voice"]){
  const x=await submit(featured,deck(name));assert.equal(x.status,400);assert.equal(x.changes.length,0);
  assert.match(x.data.error,/Commander Mustard/);
 }
 const legal=await submit(featured,deck("Commander Mustard"));assert.equal(legal.status,200);assert.equal(legal.changes.length,1);
});
test("Open Build accepts other Commander decks unchanged",async()=>{
 const result=await submit(open,deck("Chainer, Dementia Master"));
 assert.equal(result.status,200);assert.equal(result.changes.length,1);
});
test("Featured entries from previous cases are hidden from public results",async()=>{
 const db=dbMock(featured,deck("Commander Mustard"),deck("Chainer, Dementia Master"));
 const r=await communityRead(new Request("https://deep-cuts-edh.pages.dev/api/community?action=challenge&id=rescue-001"),db);
 const data=await r.json();assert.equal(data.challenge.commander,"Commander Mustard");assert.deepEqual(data.entries,[]);
 const list=await communityRead(new Request("https://deep-cuts-edh.pages.dev/api/community?action=challenges"),db);
 assert.equal((await list.json()).challenges[0].commander,"Commander Mustard");
});
test("Server rejects votes for obsolete, no-longer-eligible featured entries",async()=>{
 const d=dbMock(featured,deck("Commander Mustard"),deck("Chainer, Dementia Master"));
 const r=await gamesWrite(d,{id:profile},{action:"vote",deck_id:own,challenge_id:featured.id});
 assert.equal(r.status,409);assert.equal(d.changes.length,0);
});
test("Gold Support header is universal and always points to /supporters",()=>{
 const js=fs.readFileSync("header-profile.js","utf8");
 assert.match(js,/support\.href="\/supporters"/);
 assert.match(js,/support\.classList\.add\("site-support-action"\)/);
 assert.match(js,/root\.querySelector\("\.header-action"\)/);
 const css=fs.readFileSync("header-profile.css","utf8");
 assert.match(css,/site-support-action/);
 assert.match(css,/grid-area:support/);
});
test("Profile shortcut shows circular three lines to the right of the avatar",()=>{
 const js=fs.readFileSync("header-profile.js","utf8"),css=fs.readFileSync("header-profile.css","utf8");
 assert.match(js,/node\("span","header-profile-menu-glyph"\)/);
 assert.match(js,/for\(let i=0;i<3;i\+\+\)glyph\.append/);
 assert.match(css,/header-profile-menu-glyph>span/);
 assert.match(css,/grid-column:5/);
 assert.match(css,/border-radius:50%/);
});
test("Community and My Profile share the familiar forest, linen, gold design",()=>{
 for(const file of ["community.html","profile.html"])assert.match(fs.readFileSync(file,"utf8"),/href="\/community-theme\.css"/);
 const css=fs.readFileSync("community-theme.css","utf8");
 for(const token of [".cm-page",".cm-hero",".cm-tabs button",".cm-panel","#eee9db","#1a3024"])assert.ok(css.includes(token));
});
test("Featured gold halo remains behind card and preserves hover lift",()=>{
 const html=fs.readFileSync("index.html","utf8"),css=fs.readFileSync("home-hub.css","utf8");
 assert.match(html,/hub-feature-stage/);
 assert.match(css,/\.hub-feature-stage::before/);
 assert.match(css,/z-index:-1/);
 assert.match(css,/\.hub-feature:hover\{transform:rotate\(0\) translateY\(-3px\)/);
 assert.match(css,/prefers-reduced-motion/);
});

// Shared Site quality workflow also runs the independently scoped public case-file tests.
import "./case-file.test.mjs";
