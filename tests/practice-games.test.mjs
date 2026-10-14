import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {onRequestGet as dailyGet,onRequestPost as dailyPost} from "../functions/api/daily-games.js";
import {onRequestGet as arcaneGet,onRequestPost as arcanePost} from "../functions/api/arcane-games.js";
import {getPuzzle} from "../src/automated-games.js";
const host="https://deep-cuts-edh.pages.dev";
const authHeader="Bearer dcprofile1_"+ "a".repeat(32)+"_"+ "b".repeat(64);
function envFixture(){
 const queries=[];
 const db={prepare(sql){return {sql,
  bind(...args){this.args=args;return this},
  async first(){
   queries.push({sql,args:this.args||[]});
   if(sql.includes("FROM community_profiles WHERE id=? AND key_hash=?"))return {id:"testplayer",handle:"Tester",avatar:"Commander Mustard"};
   if(sql.includes("INSERT INTO community_limits"))return {attempts:1};
   return null;
  },
  async all(){queries.push({sql,args:this.args||[]});return {results:[]}},
  async run(){queries.push({sql,args:this.args||[]});return {meta:{changes:1}}}
 };}};
 return{env:{DB:db,TURNSTILE_SECRET:"fixture"},queries};
}
function request(game,action,seed,history=[],signed=false){
 const arcane=game==="cipher"||game==="board",path=arcane?"/api/arcane-games":"/api/daily-games";
 const params=new URLSearchParams({action,game,mode:"practice",seed:String(seed),history:JSON.stringify(history)});
 const h={"CF-Connecting-IP":"198.51.100.45",...(signed?{Authorization:authHeader}:{})};
 return new Request(host+path+"?"+params,{headers:h});
}
async function post(game,action,seed,params,signed=false){
 const arcane=game==="cipher"||game==="board";
 const h={"Content-Type":"application/json",Origin:host,"CF-Connecting-IP":"198.51.100.45",...(signed?{Authorization:authHeader}:{})};
 const r=await (arcane?arcanePost:dailyPost)({request:new Request(host+(arcane?"/api/arcane-games":"/api/daily-games"),{
  method:"POST",headers:h,body:JSON.stringify({action,game,mode:"practice",seed,...params})}),env:fixture.env});
 const data=await r.json();assert.equal(r.status,200,game+" move: "+JSON.stringify(data));return data;
}
let fixture;
for(const signed of [false,true]){
 const who=signed?"signed-in":"guest";
 for(const game of ["cold","ladder","cipher","board"]){
  test(who+" "+game+": seeded full practice state and moves never write daily results",async()=>{
   fixture=envFixture();const seed=26789123;
   const get=async history=>{
    const response=await (game==="cold"||game==="ladder"?dailyGet:arcaneGet)({
     request:request(game,"state",seed,history,signed),env:fixture.env});
    const data=await response.json();assert.equal(response.status,200,game+" load: "+JSON.stringify(data));return data;
   };
   const start=await get([]);
   assert.equal(start.mode,"practice");assert.equal(start.seed,seed);
   if(game==="cold"){
    assert.equal(start.attempts.length,0);
    const truth=await getPuzzle(fixture.env.DB,"cold","2026-10-14","practice",seed);
    const first=start.choices.find(name=>name!==truth.answer.name);
    const one=await post(game,"guess",seed,{guess:first,history:[]},signed);
    assert.equal(one.attempts.length,1);
    const resumed=await get(one.attempts);assert.deepEqual(resumed.attempts,one.attempts);
    const second=start.choices.find(name=>name!==first);
    const two=await post(game,"guess",seed,{guess:second,history:one.attempts},signed);
    assert.equal(two.attempts.length,2);
    assert.deepEqual((await get(two.attempts)).attempts,two.attempts);
   }else if(game==="ladder"){
    assert.equal(start.cards.length,5);
    const one=await post(game,"submit",seed,{order:start.cards.map(c=>c.name).reverse()},signed);
    assert.equal(one.finished,true);assert.ok(Number.isFinite(one.score));
    // The verdict can be replayed because a practice score is not recorded in the daily run table.
    const second=await get([]);assert.equal(second.finished,false);
   }else if(game==="cipher"){
    assert.equal(start.attempts,0);
    const one=await post(game,"guess",seed,{guess:"ZZZZZ",history:[]},signed);
    assert.equal(one.attempts,1);
    assert.equal((await get(["ZZZZZ"])).attempts,1);
    const two=await post(game,"guess",seed,{guess:"YYYYY",history:["ZZZZZ"]},signed);
    assert.equal(two.attempts,2);
    assert.equal((await get(["ZZZZZ","YYYYY"])).attempts,2);
   }else{
    assert.equal(start.solved.length,0);assert.equal(start.tiles.length,16);
    const first=start.tiles.slice(0,4),second=start.tiles.slice(4,8);
    const one=await post(game,"group",seed,{cards:first,history:[]},signed);
    assert.equal(one.attempts,1);
    assert.equal((await get([first])).attempts,1);
    const two=await post(game,"group",seed,{cards:second,history:[first]},signed);
    assert.equal(two.attempts,2);
    assert.equal((await get([first,second])).attempts,2);
   }
   assert.ok(!fixture.queries.some(q=>/(?:INSERT|UPDATE|DELETE).*?(daily_game_runs|daily_arcane_runs|daily_game_achievements|daily_arcane_badges)/i.test(q.sql)),
    game+" wrote a daily score or achievement");
  });
 }
}
test("Cold Case and Obscurity Ladder practice puzzles remain stable across midnight",async()=>{
 const a=await getPuzzle(envFixture().env.DB,"cold","2026-10-14","practice",87990);
 const b=await getPuzzle(envFixture().env.DB,"cold","2026-10-15","practice",87990);
 assert.deepEqual(a,b);
 const c=await getPuzzle(envFixture().env.DB,"ladder","2026-10-14","practice",87990);
 const d=await getPuzzle(envFixture().env.DB,"ladder","2026-10-15","practice",87990);
 assert.deepEqual(c,d);
});
test("All practice modes retain client-side history after authentication and do not refresh on profile-change",()=>{
 const daily=fs.readFileSync("daily-games.js","utf8"),arcane=fs.readFileSync("arcane-games.js","utf8");
 assert.match(daily,/if\(practice\|\|!state\.authenticated\)saveStorage\(storageKey\("cold"/);
 assert.match(daily,/if\(!practice&&!state\.authenticated\)saveStorage\(storageKey\("ladder"/);
 assert.match(daily,/if\(!practice&&!working\)loadGame\(\)/);
 assert.match(arcane,/return practice\|\|!state\?\.authenticated\?readLocal/);
 assert.match(arcane,/\(practice\|\|!state\.authenticated\)\?\{history:before\}/);
 assert.match(arcane,/if\(practice\|\|!state\.authenticated\)writeLocal/);
 assert.match(arcane,/if\(!practice&&!working\)load\(\)/);
 assert.match(arcane,/practice\?"practice:"\+seed:day/);
});
test("Fresh practice generation remains seeded on all four Arcade links",()=>{
 const hub=fs.readFileSync("daily-games.js","utf8");
 const arcane=fs.readFileSync("arcane-games.js","utf8");
 for(const game of ["cold","ladder","cipher","board"])assert.match(hub,new RegExp(game+":"));
 assert.match(arcane,/location\.pathname\+"\?practice="\+n/);
 assert.match(fs.readFileSync("functions/api/arcane-games.js","utf8"),/buildArcanePuzzle\(game,"practice",mode,seed\)/);
});
