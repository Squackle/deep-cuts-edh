import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RULES_VERSION} from '../src/stackbreaker-verify/src/cards.js';
import {validateScenario} from '../src/stackbreaker-verify/src/engine.js';
import {LAB_SOURCE_SHA,loadScenarios,utcDay,approvedDailyEntry,boundScenario,
 digestScenario,replayServerMoves,STACKBREAKER_SERVER_RULES} from '../src/stackbreaker-verify/server-replay.js';
import {onRequestGet,onRequestPost} from '../functions/api/stackbreaker.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Pinned Lab replay source includes 250 unmodified classic scenarios',()=>{
 assert.equal(LAB_SOURCE_SHA,'9533987e5ec28cdbbbf07175a6cda5813b580d16');
 assert.equal(STACKBREAKER_SERVER_RULES,'sb-mtg-training-0.3.0');
 assert.equal(RULES_VERSION,STACKBREAKER_SERVER_RULES);
 const all=loadScenarios();
 assert.equal(all.length,250);
 assert.equal(new Set(all.map(s=>s.id)).size,250);
 assert.equal(all[0].id,'sb-01');
 assert.equal(all[249].id,'sg-250');
 for(const s of all)assert.deepEqual(validateScenario(s),{valid:true,errors:[]},s.id);
});
test('All 365 immutable UTC daily puzzles match the launched 250-case game',()=>{
 assert.equal(utcDay('2026-10-19T23:59:59Z'),'2026-10-19');
 assert.equal(utcDay('2026-10-20T00:00:00Z'),'2026-10-20');
 const manifest=JSON.parse(read('src/stackbreaker-verify/data/daily-manifest.json'));
 assert.equal(manifest.entries.length,365);
 const uniqueDates=new Set(manifest.entries.map(x=>x.utcDate));
 assert.equal(uniqueDates.size,365,'One manifest puzzle per UTC day');
 const loaded=loadScenarios();
 const ids=new Set(loaded.map(x=>x.id));
 const generated=manifest.entries.filter(e=>e.puzzleId.startsWith('sg-'));
 assert.ok(generated.length>=60,'Original published generated daily cases are retained');
 for(const e of manifest.entries){
  const verifiedEntry=approvedDailyEntry(e.utcDate);
  assert.deepEqual(verifiedEntry,e,'Never substitute a different ranked puzzle: '+e.utcDate);
  assert.ok(ids.has(e.puzzleId),'Original game lacks date '+e.utcDate);
  const bound=boundScenario(verifiedEntry);
  assert.equal(bound.id,e.puzzleId);
  assert.equal(bound.version,STACKBREAKER_SERVER_RULES);
  assert.deepEqual(validateScenario(bound),{valid:true,errors:[]},'Invalid published scenario '+e.utcDate);
 }
 assert.equal(approvedDailyEntry('2028-01-01'),null);
});
test('Generated day and hand-authored day both use identical server replay',()=>{
 for(const date of ['2026-10-19','2026-10-20']){
  const e=approvedDailyEntry(date);assert.ok(e);
  const scene=boundScenario(e);assert.equal(scene.id,e.puzzleId);
  assert.equal(replayServerMoves(scene,[]).state.status,'playing');
  assert.throws(()=>replayServerMoves(scene,[{type:'claim-win'}]),/Unsupported or malformed/);
 }
});
test('Pinned digest is cryptographic, scenario bound, versioned and deterministic',async()=>{
 const entry=approvedDailyEntry('2026-10-19');
 assert.ok(entry);
 const scene=boundScenario(entry);
 assert.equal(scene.id,entry.puzzleId);
 const sha=await digestScenario(scene);
 assert.match(sha,/^[0-9a-f]{64}$/);
 assert.equal(await digestScenario(scene),sha);
 assert.notEqual(await digestScenario({...scene,id:'bogus'}),sha);
});
test('Server independently checks accepted actions; fabricated wins never accepted',()=>{
 const s=loadScenarios()[0];
 const empty=replayServerMoves(s,[]);
 assert.equal(empty.state.status,'playing');
 assert.equal(empty.score.completed,false);
 assert.equal(empty.score.acceptedActionCount,0);
 assert.throws(()=>replayServerMoves(s,[{type:'claim-win'}]),/Unsupported or malformed/);
 assert.throws(()=>replayServerMoves(s,[{type:'tap',landId:'not-a-land'}]),/Land cannot be tapped/);
 assert.throws(()=>replayServerMoves(s,[{type:'pass',fakeAccepted:true}]),/Invalid move envelope/);
 assert.throws(()=>replayServerMoves(s,Array(141).fill({type:'pass'})),/Too many moves/);
});
test('Authenticated Stackbreaker API defaults disabled and does not touch DB',async()=>{
 const req=new Request('https://deep-cuts-edh.pages.dev/api/stackbreaker');
 const out=await onRequestGet({request:req,env:{}});
 assert.equal(out.status,503);
 const value=await out.json();
 assert.match(value.error,/not yet enabled/);
 const post=await onRequestPost({request:new Request('https://deep-cuts-edh.pages.dev/api/stackbreaker',{
 method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},
 body:JSON.stringify({action:'start'})}),env:{}});
 assert.equal(post.status,403);
});
test('Site route cannot issue claimed scores/achievements without server replay',()=>{
 const api=read('functions/api/stackbreaker.js');
 assert.ok(api.includes('replayServerMoves(scenario,moves)'));
 assert.ok(api.includes('WHERE profile_id=? AND utc_date=? AND accepted_moves=?'));
 assert.ok(api.includes("row.result!=='started'"));
 assert.ok(api.includes('source_sha!==LAB_SOURCE_SHA'));
 assert.ok(api.includes("stackbreaker_launch_v1"));
 assert.ok(api.includes("awarded_at"));
 assert.ok(!api.includes('clientWon'));
 assert.ok(!api.includes('data.achievementId'));
});
