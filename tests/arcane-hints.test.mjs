import test from "node:test";
import assert from "node:assert/strict";
import {onRequestGet,onRequestPost} from "../functions/api/arcane-games.js";
import {buildArcanePuzzle,cipherLetters,chicagoDate} from "../src/arcane-game-data.js";
const origin="https://deep-cuts-edh.pages.dev";
const token="dcprofile1_"+"a".repeat(32)+"_"+"b".repeat(64);
function sample(min,max){
 for(let seed=1;seed<2000;seed++){
  const p=buildArcanePuzzle("cipher","practice","practice",seed);
  const length=cipherLetters(p.word).length;
  if(length>=min&&length<=max)return {seed,p,length};
 }
 throw Error("No example found in specified length band");
}
function fixture(){
 const puzzles=new Map(),runs=new Map(),writes=[];
 const db={prepare(sql){
  let args=[];
  return {
   bind(...input){args=input;return this},
   async first(){
    if(sql.includes("FROM community_profiles WHERE id=? AND key_hash=?"))return {id:"test-profile",handle:"Tester"};
    if(sql.includes("INSERT INTO community_limits"))return {attempts:1};
    if(sql.includes("SELECT payload FROM daily_arcane_puzzles"))return puzzles.has(args.join(":"))?{payload:puzzles.get(args.join(":"))}:null;
    if(sql.includes("SELECT progress,score,won,finished_at FROM daily_arcane_runs"))return runs.get(args.join(":"))||null;
    if(sql.includes("COUNT(DISTINCT game)"))return {n:1};
    return null;
   },
   async all(){
    if(sql.includes("FROM daily_arcane_badges"))return {results:[]};
    if(sql.includes("FROM daily_arcane_runs r"))return {results:[...runs.values()].filter(x=>x.finished_at).map(x=>({
     handle:"Tester",score:x.score,won:x.won,finished_at:x.finished_at,progress:x.progress
    }))};
    return {results:[]};
   },
   async run(){
    writes.push(sql);
    if(sql.includes("INSERT OR IGNORE INTO daily_arcane_puzzles")){
     const key=args[0]+":"+args[1];if(!puzzles.has(key))puzzles.set(key,args[2]);
    }
    if(sql.includes("INSERT OR IGNORE INTO daily_arcane_runs")){
     const key=args.join(":");if(!runs.has(key))runs.set(key,{progress:"[]",score:0,won:0,finished_at:null});
    }
    if(sql.includes("UPDATE daily_arcane_runs SET")){
     const key=args[4]+":"+args[5]+":"+args[6],old=runs.get(key);
     if(!old||old.progress!==args[7]||old.finished_at)return {meta:{changes:0}};
     runs.set(key,{progress:args[0],score:args[1],won:args[2],finished_at:args[3]});
     return {meta:{changes:1}};
    }
    return {meta:{changes:1}};
   }
  };
 }};
 return {env:{DB:db,TURNSTILE_SECRET:"test-turnstile"},runs,writes};
}
async function api(fx,{method="GET",mode="practice",seed=1,action="state",history=[],guess,auth=false,game="cipher"}={}){
 const url=new URL(origin+"/api/arcane-games");
 const headers={"CF-Connecting-IP":"198.51.100.2"};
 if(auth)headers.Authorization="Bearer "+token;
 let body;
 if(method==="GET"){
  Object.entries({action,mode,seed,game,history:JSON.stringify(history)}).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 }else{
  headers.Origin=origin;headers["Content-Type"]="application/json";
  body=JSON.stringify({action,mode,seed,game,day:chicagoDate(),history,guess});
 }
 const response=await (method==="GET"?onRequestGet:onRequestPost)({
  request:new Request(url,{method,headers,...(body?{body}:{})}),env:fx.env
 });
 return {status:response.status,data:await response.json()};
}
test("Adaptive hints reveal 1, 2 or 3 new positions and cost a whole guess",async()=>{
 for(const [min,max,count] of [[2,5,1],[6,9,2],[10,14,3]]){
  const {seed,length}=sample(min,max),fx=fixture();
  const first=await api(fx,{method:"POST",action:"hint",seed});
  assert.equal(first.status,200,JSON.stringify(first.data));
  assert.equal(first.data.attempts,1);
  assert.equal(first.data.hintCount,1);
  assert.equal(first.data.guesses[0].hint,true);
  assert.equal(first.data.hintLetters.length,count);
  assert.ok(first.data.hintLetters.every(x=>x.index>=0&&x.index<length));
  assert.equal(first.data.score,0);
  const second=await api(fx,{method:"POST",action:"hint",seed,history:["!HINT"]});
  assert.equal(second.status,200,JSON.stringify(second.data));
  assert.equal(second.data.attempts,2);
  assert.equal(second.data.hintCount,2);
  assert.ok(second.data.hintLetters.length>=count);
  assert.equal(new Set(second.data.hintLetters.map(x=>x.index)).size,second.data.hintLetters.length);
  assert.equal(second.data.hintAvailable,false);
  const blocked=await api(fx,{method:"POST",action:"hint",seed,history:["!HINT","!HINT"]});
  assert.equal(blocked.status,400);
  const reload=await api(fx,{seed,history:["!HINT","!HINT"]});
  assert.equal(reload.status,200);
  assert.deepEqual(reload.data.hintLetters,second.data.hintLetters);
  assert.equal(reload.data.attempts,2);
  assert.equal(fx.writes.length,0,"Practice hints must never write to daily results");
 }
});
test("Hinted letters are fixed, invalid history is rejected, and an assisted solve scores by turns",async()=>{
 const {seed,p,length}=sample(6,9),fx=fixture();
 const first=await api(fx,{method:"POST",action:"hint",seed});
 const locked=first.data.hintLetters[0];
 const fake="Z".repeat(locked.index)+"X"+"Z".repeat(length-locked.index-1);
 const invalid=await api(fx,{method:"POST",action:"guess",seed,history:["!HINT"],guess:fake});
 if(fake[locked.index]!==locked.letter)assert.equal(invalid.status,400);
 const solved=await api(fx,{method:"POST",action:"guess",seed,history:["!HINT"],guess:cipherLetters(p.word)});
 assert.equal(solved.status,200,JSON.stringify(solved.data));
 assert.equal(solved.data.won,true);
 assert.equal(solved.data.finished,true);
 assert.equal(solved.data.assisted,true);
 assert.equal(solved.data.attempts,2);
 assert.equal(solved.data.score,85);
 assert.equal(solved.data.hintCount,1);
 assert.equal(solved.data.answer.word,p.word);
 const illegal=await api(fx,{seed,history:["!HINT",cipherLetters(p.word),"!HINT"]});
 assert.equal(illegal.status,400);
});
test("The last available guess cannot be exchanged for a hint",async()=>{
 const {seed,length}=sample(3,5),fx=fixture();
 const guesses=["Z","Y","X","W","V"].map(x=>x.repeat(length));
 const ready=await api(fx,{seed,history:guesses});
 assert.equal(ready.status,200);
 assert.equal(ready.data.attemptsLeft,1);
 assert.equal(ready.data.hintAvailable,false);
 const blocked=await api(fx,{method:"POST",action:"hint",seed,history:guesses});
 assert.equal(blocked.status,400);
});
test("Signed-in daily hints are saved, not client-controlled, and leaderboard does not expose progress",async()=>{
 const fx=fixture();
 const start=await api(fx,{auth:true,mode:"daily"});
 assert.equal(start.status,200);
 const hinted=await api(fx,{method:"POST",action:"hint",mode:"daily",auth:true,history:["A".repeat(start.data.wordLength)]});
 assert.equal(hinted.status,200,JSON.stringify(hinted.data));
 assert.equal(hinted.data.attempts,1,"Client-supplied history must be ignored for signed-in daily play");
 const saved=await api(fx,{auth:true,mode:"daily",history:[]});
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal(saved.data.hintCount,1);
 assert.deepEqual(saved.data.hintLetters,hinted.data.hintLetters);
 const again=await api(fx,{method:"POST",action:"hint",mode:"daily",auth:true});
 assert.equal(again.status,200);
 assert.equal(again.data.hintCount,2);
 assert.equal(fx.runs.get("test-profile:cipher:"+chicagoDate()).progress,'["!HINT","!HINT"]');
 const final=await api(fx,{method:"POST",action:"guess",mode:"daily",auth:true,guess:
  // Reconstruct the answer using a separate fixture of the same frozen daily date.
  cipherLetters(buildArcanePuzzle("cipher",chicagoDate()).word)});
 assert.equal(final.status,200,JSON.stringify(final.data));
 assert.equal(final.data.won,true);
 assert.equal(final.data.score,70);
 const leaderboard=await api(fx,{mode:"daily",action:"board"});
 assert.equal(leaderboard.status,200);
 assert.equal(leaderboard.data.leaders[0].assisted,true);
 assert.ok(!("progress" in leaderboard.data.leaders[0]));
 assert.equal(leaderboard.data.leaders[0].score,70);
 const denied=await api(fx,{method:"POST",action:"hint",mode:"daily",auth:true});
 assert.equal(denied.status,200);
 assert.equal(denied.data.alreadySubmitted,true);
});
test("Original unaided Cipher and Conspiracy Board endpoints are unchanged",async()=>{
 const fx=fixture(),{seed,p}=sample(2,5);
 const win=await api(fx,{method:"POST",action:"guess",seed,guess:cipherLetters(p.word)});
 assert.equal(win.status,200);
 assert.equal(win.data.assisted,false);
 assert.equal(win.data.score,100);
 assert.equal(win.data.hintCount,0);
 const board=await api(fx,{game:"board",action:"state",seed});
 assert.equal(board.status,200);
 assert.equal(board.data.tiles.length,16);
 const noBoardHint=await api(fx,{method:"POST",game:"board",action:"hint",seed});
 assert.equal(noBoardHint.status,400);
});
