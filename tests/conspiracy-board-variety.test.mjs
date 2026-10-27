import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {chicagoDate,buildArcanePuzzle,BOARD_CATEGORIES,nextBoardPracticeSeed} from "../src/arcane-game-data.js";
import {onRequestGet} from "../functions/api/arcane-games.js";

const centralCases=[
 ["Spring forward: before midnight","2027-03-13T05:59:59.999Z","2027-03-12"],
 ["Spring forward: after midnight","2027-03-13T06:00:00.000Z","2027-03-13"],
 ["DST Sunday: before midnight","2027-03-14T05:59:59.999Z","2027-03-13"],
 ["DST Sunday: after midnight","2027-03-14T06:00:00.000Z","2027-03-14"],
 ["Fall back: before midnight","2026-11-01T04:59:59.999Z","2026-10-31"],
 ["Fall back: after midnight","2026-11-01T05:00:00.000Z","2026-11-01"],
 ["Fall back Sunday: before midnight","2026-11-02T05:59:59.999Z","2026-11-01"],
 ["Fall back Sunday: after midnight","2026-11-02T06:00:00.000Z","2026-11-02"],
 ["Standard-time midnight","2026-12-15T06:00:00.000Z","2026-12-15"]
];
test("Conspiracy Board daily date turns over at Central midnight, across daylight saving boundaries",()=>{
 for(const [label,time,expected] of centralCases)assert.equal(chicagoDate(new Date(time)),expected,label);
 for(const [before,after] of [["2026-10-27","2026-10-28"],["2026-11-01","2026-11-02"],["2027-03-13","2027-03-14"]]){
  const a=buildArcanePuzzle("board",before),b=buildArcanePuzzle("board",after);
  assert.notDeepEqual(a.groups.map(g=>g.title),b.groups.map(g=>g.title),"Categories should change on "+after);
  assert.equal(a.edition,"hand-curated-v2");
  assert.equal(b.edition,"hand-curated-v2");
  assert.equal(a.tiles.length,16);
  assert.equal(b.tiles.length,16);
  assert.deepEqual(a,buildArcanePuzzle("board",before),"Same-day answer is stable for all users");
 }
});
test("Every new practice seed represents a new puzzle with no repeated categories",()=>{
 for(let previous=1;previous<=75;previous++){
  const original=buildArcanePuzzle("board","practice","practice",previous);
  const chosen=nextBoardPracticeSeed(original.tiles,previous,()=>((previous*104729)%999999999)+1);
  const following=buildArcanePuzzle("board","practice","practice",chosen);
  assert.notEqual(chosen,previous);
  assert.equal(following.groups.length,4);
  assert.equal(following.tiles.length,16);
  assert.equal(following.tiles.filter(tile=>original.tiles.includes(tile)).length,0,"Repeat category from "+previous);
  assert.deepEqual(following,buildArcanePuzzle("board","practice","practice",chosen),"Practice seed is bookmarkable");
 }
 const day=buildArcanePuzzle("board","2026-10-27");
 const next=buildArcanePuzzle("board","practice","practice",nextBoardPracticeSeed(day.tiles,0,()=>1512));
 assert.equal(next.tiles.some(tile=>day.tiles.includes(tile)),false,"First practice should differ from today's daily board");
});
test("Practice selector never writes D1 daily rows, badges, scores or frozen snapshots",async()=>{
 const day="2026-10-27",old=buildArcanePuzzle("board",day);
 const env={DB:{prepare(){throw Error("No database access should be needed to choose practice")}}};
 const params=new URLSearchParams({
  action:"new-practice",game:"board",mode:"daily",seed:"0",
  previousTiles:JSON.stringify(old.tiles)
 });
 const response=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/arcane-games?"+params),env});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.mode,"practice");
 assert.ok(body.seed>0&&body.seed<=999999999);
 const p=buildArcanePuzzle("board","practice","practice",body.seed);
 assert.equal(p.tiles.some(t=>old.tiles.includes(t)),false);
 assert.deepEqual(buildArcanePuzzle("board",day),old,"Published daily generator unchanged");
});
test("Practice selector rejects bad or spoiler-injecting tile sets",async()=>{
 const env={DB:{prepare(){throw Error("No DB access expected")}}};
 for(const previousTiles of [["not a magic card"],Array(16).fill("Sol Ring"),["Sol Ring"],"bad"]){
  const q=new URLSearchParams({action:"new-practice",game:"board",mode:"daily",previousTiles:JSON.stringify(previousTiles)});
  const response=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/arcane-games?"+q),env});
  assert.equal(response.status,400);
 }
 const q=new URLSearchParams({action:"new-practice",game:"cipher"});
 const cipher=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/arcane-games?"+q),env});
 assert.equal(cipher.status,400);
});
test("Daily progress keys, signed-in score handlers and Central rollover guards stay unchanged",()=>{
 const frontend=fs.readFileSync(new URL("../arcane-games.js",import.meta.url),"utf8");
 const api=fs.readFileSync(new URL("../functions/api/arcane-games.js",import.meta.url),"utf8");
 assert.ok(frontend.includes('const boardEdition=game==="board"&&!practice?"v2:":""'));
 assert.ok(frontend.includes('deepcuts:arcane:'+""),'Original progress key namespace remains');
 assert.ok(frontend.includes('sessionStorage.setItem(boardLayoutKey(day)'),'Layout is separate from histories');
 assert.ok(frontend.includes('displayOrder=game==="board"?initialBoardLayout(data)'),'Shuffle first render');
 assert.ok(frontend.includes('saveBoardLayout(state.day,displayOrder)'),'Manual shuffle persists in the same session');
 assert.ok(frontend.includes("msToCentralMidnight"),"Exact day boundary timer is installed");
 assert.ok(frontend.includes('America/Chicago'),"Rollover uses Central timezone not device local");
 assert.ok(frontend.includes('document.addEventListener("visibilitychange"'),'Sleep/wake refresh is retained');
 assert.ok(api.includes("daily_arcane_runs SET progress=?"),"Signed-in score persistence untouched");
 assert.ok(api.includes("INSERT OR IGNORE INTO daily_arcane_puzzles"),"Daily frozen snapshots untouched");
 assert.equal(BOARD_CATEGORIES.length,16);
});
