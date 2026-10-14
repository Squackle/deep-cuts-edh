import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {onRequestGet} from "../../../src/hive-server/leaderboard.js";
import {RULES_VERSION} from "../src/engine.js";
import {chicagoDay} from "../src/modes.js";
import {renderLeaderboard,renderPersonalBest} from "../src/leaderboard-ui.js";

function database(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(readFileSync(new URL("../db/leaderboard.sql",import.meta.url),"utf8"));
 const db={prepare(sql){
  const stmt=sqlite.prepare(sql);let args=[];
  const query={bind(...values){args=values;return query},
   async all(){return{results:stmt.all(...args)}},
   async first(){return stmt.get(...args)||null}};
  return query;
 }};
 return {sqlite,db};
}
function seedScore(sqlite,index,{mode="classic",day="",profileId=null,verified=0,claimedHandle=null,score=15000-index*1000}={}){
 sqlite.prepare(`INSERT INTO hive_scores_v1
  (id,session_token,alias,profile_id,profile_handle,profile_verified,
   score,kills,evolutions,ticks,rules_version,mode,challenge_day,created_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run("s"+index+"-"+mode+"-"+day,"t"+index+"-"+mode+"-"+day,
   index===11?"YOU":"P"+String(index).padStart(2,"0"),
   profileId,claimedHandle,verified,score,index%3,2,100,
   RULES_VERSION,mode,day,1000+index);
}
async function get(env,profile,mode="classic",challenge="arcade"){
 const response=await onRequestGet({env,request:new Request("https://example.test/api/leaderboard?mode="+mode+"&challenge="+challenge),
  data:{hiveProfile:profile,resolveProfiles:async()=>{}}});
 assert.equal(response.status,200);
 return response.json();
}
test("only top ten rows appear, but a verified personal best outside top ten still shows its rank",async()=>{
 const {sqlite,db}=database(),env={HIVE_DB:db};
 for(let i=0;i<13;i++)seedScore(sqlite,i,{
  profileId:i===11||i===12?"player-123":null,
  verified:i===11||i===12?1:0,
  claimedHandle:i===11||i===12?"Squackle":i===2?"Squackle":null
 });
 try{
  const profile={id:"player-123",handle:"Squackle"};
  const board=await get(env,profile);
  assert.equal(board.entries.length,10);
  assert.deepEqual(board.entries.map(x=>x.score),Array.from({length:10},(_,i)=>15000-i*1000));
  assert.equal(board.personalBest.position,12);
  assert.equal(board.personalBest.alias,"YOU");
  assert.equal(board.personalBest.score,4000);
  assert.equal(board.profile.handle,"Squackle");
  assert.equal(board.entries[2].isYou,false,"a guest claiming the account handle cannot be highlighted");
  assert.ok(board.entries.every(x=>!Object.hasOwn(x,"profileId")));
  const guest=await get(env,null);
  assert.equal(guest.entries.length,10);
  assert.equal(guest.personalBest,null,"a guest cannot look up someone else's private personal record");
  assert.equal(guest.profile,null);
 }finally{sqlite.close()}
});
test("retired Daily scores stay archived; old-version verified Arcade records remain in top ten",async()=>{
 const {sqlite,db}=database(),env={HIVE_DB:db};
 try{
  seedScore(sqlite,0,{profileId:"x",verified:1,score:9000});
  seedScore(sqlite,1,{mode:"hunt",profileId:"x",verified:1,score:8000});
  seedScore(sqlite,2,{day:"2026-10-14",profileId:"x",verified:1,score:7000});
  sqlite.prepare("UPDATE hive_scores_v1 SET rules_version='hive-1.0.2' WHERE mode='classic'").run();
  const profile={id:"x",handle:"Squackle"},arcade=await get(env,profile);
  assert.equal(arcade.entries.length,1);
  assert.equal(arcade.entries[0].rulesVersion,"hive-1.0.2");
  assert.equal(arcade.personalBest.rulesVersion,"hive-1.0.2");
  assert.equal(arcade.personalBest.score,9000);
  assert.equal((await get(env,profile,"hunt")).entries.length,1);
  const retired=await onRequestGet({env,request:new Request("https://example.test/api/leaderboard?mode=classic&challenge=daily")});
  assert.equal(retired.status,400);
 }finally{sqlite.close()}
});

function node(tag,text,css){
 return {tag,textContent:text||"",className:css||"",children:[],ownerDocument:null,
  append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
  setAttribute(k,v){this[k]=v}};
}
test("arcade table uses Rank / Initials / Score with ordinal ranks, links and exactly ten rows",()=>{
 const doc={createElement:tag=>node(tag)},root=node("root");root.ownerDocument=doc;
 const entries=Array.from({length:14},(_,i)=>({
  alias:"ABC",score:123456-i*500,profileVerified:i===0?1:0,
  profileHandle:i===0?"Squackle":null,isYou:i===0
 }));
 renderLeaderboard(root,{entries});
 assert.equal(root.children.length,10);
 assert.equal(root.children[0].children[0].textContent,"1ST");
 assert.equal(root.children[1].children[0].textContent,"2ND");
 assert.equal(root.children[2].children[0].textContent,"3RD");
 assert.equal(root.children[9].children[0].textContent,"10TH");
 assert.match(root.children[0].className,/is-you/);
 assert.equal(root.children[0].children[1].children[0].textContent,"ABC");
 assert.equal(root.children[0].children[2].children[0].textContent,"123,456");
 assert.equal(root.children[0].children[1].children[1].href,"https://deep-cuts-edh.pages.dev/community.html?profile=Squackle");
});
test("record panel prioritizes server-verified rank over this browser's local high score",()=>{
 const doc={createElement:tag=>node(tag)},nodes={};
 for(const id of ["personalRecordContext","personalRecordScore","personalRecordRank","personalRecordIdentity"])nodes[id]=node("div");
 const classes=new Set();
 const panel={ownerDocument:doc,querySelector:q=>nodes[q.slice(1)],classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
 renderPersonalBest(panel,{profile:{handle:"Squackle"},personalBest:{alias:"YOU",score:4000,position:12}},30000);
 assert.equal(nodes.personalRecordContext.textContent,"VERIFIED PERSONAL BEST");
 assert.equal(nodes.personalRecordScore.textContent,"04,000");
 assert.equal(nodes.personalRecordRank.textContent,"RANK 12TH");
 assert.equal(nodes.personalRecordIdentity.children[1].href,"https://deep-cuts-edh.pages.dev/community.html?profile=Squackle");
 assert.ok(classes.has("is-ranked"));
 renderPersonalBest(panel,null,1234);
 assert.equal(nodes.personalRecordContext.textContent,"LOCAL PERSONAL BEST");
 assert.equal(nodes.personalRecordScore.textContent,"01,234");
 assert.equal(nodes.personalRecordRank.textContent,"LOCAL RECORD");
 assert.equal(classes.has("is-ranked"),false);
});
test("HTML puts player best above a themed 3-column, ten-entry scoreboard",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 assert.ok(html.indexOf('id="personalRecord"')<html.indexOf('id="leaderboardTitle"'));
 assert.match(html,/id="personalRecordRank"/);
 assert.match(html,/class="board-column-headings"/);
 assert.match(html,/<span>RANK<\/span><span>INITIALS<\/span><span>SCORE<\/span>/);
 assert.match(main,/ · TOP 10/);
 assert.match(css,/\.board-row\.is-you/);
 assert.match(css,/@media\(max-width:420px\)/);
});
