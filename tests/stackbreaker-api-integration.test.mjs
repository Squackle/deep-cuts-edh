import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {hash} from '../src/community-core.js';
import {currentDaily,utcDay,boundScenario,replayServerMoves} from '../src/stackbreaker-verify/server-replay.js';
import {onRequestGet,onRequestPost} from '../functions/api/stackbreaker.js';
const migration=readFileSync(new URL('../db/stackbreaker-verified-v1.sql',import.meta.url),'utf8');
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec(`CREATE TABLE community_profiles(id TEXT PRIMARY KEY,handle TEXT,bio TEXT DEFAULT '',bio_emoji TEXT DEFAULT '',avatar TEXT DEFAULT '',focus_x INTEGER DEFAULT 50,focus_y INTEGER DEFAULT 30,focus_zoom REAL DEFAULT 2.8,created_at TEXT DEFAULT '');
 CREATE TABLE community_device_sessions(profile_id TEXT, token_hash TEXT PRIMARY KEY, expires_at INTEGER);
 CREATE TABLE community_limits(subject TEXT,date_key TEXT,action TEXT,attempts INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(subject,date_key,action));`);
 db.exec(migration);
 db.prepare("UPDATE stackbreaker_launch_v1 SET enabled=1 WHERE feature='verified-daily'").run();
 const d1={prepare(sql){
  const bound=args=>{const q=db.prepare(sql);return {
   bind(...next){return bound(next)},
   async first(){return q.get(...args)||null},
   async all(){return {results:q.all(...args)}},
   async run(){return {meta:{changes:q.run(...args).changes}}}
  }};
  return bound([]);
 }};
 return {raw:db,env:{DB:d1,STACKBREAKER_VERIFIED_READY:'true',TURNSTILE_SECRET:'local-test-not-a-real-secret'}};
}
const token=id=>'dcdevice1_'+id.repeat(64);
async function addUser(f,id){
 f.raw.prepare('INSERT INTO community_profiles(id,handle) VALUES(?,?)').run('member-'+id,'TestMember'+id);
 f.raw.prepare('INSERT INTO community_device_sessions(profile_id,token_hash,expires_at) VALUES(?,?,?)')
  .run('member-'+id,await hash(token(id)),Math.floor(Date.now()/1000)+3600);
}
const req=(id,body)=>new Request('https://deep-cuts-edh.pages.dev/api/stackbreaker',{
 method:body?'POST':'GET',
 headers:{Cookie:'__Host-dc_device='+token(id),'CF-Connecting-IP':'198.51.100.'+(id==='a'?'11':'12'),
  ...(body?{Origin:'https://deep-cuts-edh.pages.dev','Content-Type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
const unwrap=async x=>({status:x.status,data:await x.json()});
test('D1 migration is additive, rerunnable and foreign-keyed without dropping any existing table',()=>{
 const x=fixture(),db=x.raw;
 db.exec(migration);
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'stackbreaker_%'").all().map(x=>x.name);
 assert.equal(tables.filter(x=>x.endsWith('_v1')&&!x.startsWith('stackbreaker_attempts_completed')).length,4);
 assert.ok(tables.includes('stackbreaker_daily_attempts_v1'));
});
test('Verified profile session, one UTC start, owner isolation and server replay concurrency',async()=>{
 if(!currentDaily())return; // Editorially gated calendar date; independent date contract is tested separately.
 const f=fixture();await addUser(f,'a');await addUser(f,'b');
 const before=await unwrap(await onRequestGet({request:req('a'),env:f.env}));
 assert.equal(before.status,200);
 assert.equal(before.data.eligible,true);
 assert.equal(before.data.attempt,null);
 assert.ok(before.data.scenario);
 const guest=await unwrap(await onRequestGet({request:new Request('https://deep-cuts-edh.pages.dev/api/stackbreaker'),env:f.env}));
 assert.equal(guest.status,401);
 const started=await unwrap(await onRequestPost({request:req('a',{action:'start'}),env:f.env}));
 assert.equal(started.status,200);
 assert.equal(started.data.attempt.moves,0);
 assert.equal(started.data.state.status,'playing');
 const elsewhere=await unwrap(await onRequestGet({request:req('b'),env:f.env}));
 assert.equal(elsewhere.status,200);
 assert.equal(elsewhere.data.attempt,null,'One profile must not see the other profile’s run');
 const forged=await unwrap(await onRequestPost({request:req('a',{action:'move',seq:0,move:{type:'claim-win',completed:true}}),env:f.env}));
 assert.equal(forged.status,422);
 const invalidSeq=await unwrap(await onRequestPost({request:req('a',{action:'move',seq:2,move:{type:'pass'}}),env:f.env}));
 assert.equal(invalidSeq.status,409);
 const played=await unwrap(await onRequestPost({request:req('a',{action:'move',seq:0,move:{type:'pass'}}),env:f.env}));
 assert.equal(played.status,200);
 assert.equal(played.data.attempt.moves,1);
 const duplicate=await unwrap(await onRequestPost({request:req('a',{action:'move',seq:0,move:{type:'pass'}}),env:f.env}));
 assert.equal(duplicate.status,409,'Same move cannot be counted twice');
 const resumed=await unwrap(await onRequestGet({request:req('a'),env:f.env}));
 assert.equal(resumed.status,200);
 assert.equal(resumed.data.attempt.moves,1);
 assert.equal(resumed.data.state.status,played.data.state.status);
 const unowned=await unwrap(await onRequestPost({request:req('a',{action:'equip',slot:'frame',rewardId:'gold'}),env:f.env}));
 assert.equal(unowned.status,403,'Client claim never grants a frame');
 const table=f.raw.prepare("SELECT COUNT(*) AS n FROM stackbreaker_verified_awards_v1").get();
 assert.equal(table.n,0);
});
test('CSRF/cookie security, staging flag, idempotent awards and cosmetic ownership',async()=>{
 const f=fixture();await addUser(f,'a');await addUser(f,'b');
 const authRequest=req('a');
 f.raw.prepare("UPDATE stackbreaker_launch_v1 SET enabled=0 WHERE feature='verified-daily'").run();
 assert.equal((await onRequestGet({request:authRequest,env:f.env})).status,503);
 f.raw.prepare("UPDATE stackbreaker_launch_v1 SET enabled=1 WHERE feature='verified-daily'").run();
 const csrf=new Request('https://deep-cuts-edh.pages.dev/api/stackbreaker',{
  method:'POST',headers:{Origin:'https://attacker.invalid',Cookie:'__Host-dc_device='+token('a'),
   'CF-Connecting-IP':'198.51.100.11'},body:'{"action":"equip","slot":"frame","rewardId":"gold"}'});
 assert.equal((await onRequestPost({request:csrf,env:f.env})).status,403);
 f.raw.prepare("INSERT INTO stackbreaker_verified_awards_v1(profile_id,achievement_id) VALUES(?,?)").run('member-a','daily-first');
 const own=await unwrap(await onRequestPost({request:req('a',{action:'equip',slot:'frame',rewardId:'gold'}),env:f.env}));
 assert.equal(own.status,200);
 assert.equal(own.data.equipped.frame,'gold');
 const other=await unwrap(await onRequestPost({request:req('b',{action:'equip',slot:'frame',rewardId:'gold'}),env:f.env}));
 assert.equal(other.status,403);
 const row=f.raw.prepare("SELECT profile_id,reward_id FROM stackbreaker_equipped_v1").all();
 assert.deepEqual(row.map(x=>({...x})),[{profile_id:'member-a',reward_id:'gold'}]);
 const reset=await unwrap(await onRequestPost({request:req('a',{action:'equip',slot:'frame',rewardId:'default'}),env:f.env}));
 assert.equal(reset.status,200);assert.equal(Object.keys(reset.data.equipped).length,0);
});


test('Synthetic authenticated Daily run completes to a server-verified win, grants once and isolates accounts',async()=>{
 // This is a local D1-backed Pages handler exercise, not a request to production.
 const entry=currentDaily();
 assert.ok(entry,'Ranked Daily editorial manifest needs replenishment before this test date');
 const scenario=boundScenario(entry);
 assert.ok(scenario&&Array.isArray(scenario.solution)&&scenario.solution.length>0,
  'Published Daily must include a replayable, documented winning response');
 const f=fixture();
 await addUser(f,'a');
 await addUser(f,'b');
 const started=await unwrap(await onRequestPost({request:req('a',{action:'start'}),env:f.env}));
 assert.equal(started.status,200,'A signed-in synthetic profile can begin today');
 assert.equal(started.data.attempt.moves,0);
 const otherBefore=await unwrap(await onRequestGet({request:req('b'),env:f.env}));
 assert.equal(otherBefore.status,200);
 assert.equal(otherBefore.data.attempt,null,'Second profile cannot view first attempt');
 let accepted=[],last=started.data;
 const move=async(action)=>{
  const expected=replayServerMoves(scenario,[...accepted,action]);
  const answer=await unwrap(await onRequestPost({
   request:req('a',{action:'move',seq:accepted.length,move:action}),env:f.env
  }));
  assert.equal(answer.status,200,'Server rejected a legal reference action: '+JSON.stringify(action)+
   ' response='+JSON.stringify(answer.data));
  accepted.push(action);
  assert.equal(answer.data.state.status,expected.state.status,'API must match replayed game state');
  last=answer.data;
 };
 for(const land of scenario.lands)await move({type:'tap',landId:land.id});
 for(const [actionId,targetId] of scenario.solution)
  await move({type:'cast',actionId,targetId:targetId??null});
 for(let n=0;n<50&&last.state.status==='playing';n++)await move({type:'pass'});
 assert.equal(last.state.status,'won','Published reference must finish in a win');
 assert.equal(last.score.completed,true);
 assert.ok(last.awards.includes('daily-first'),'One eligible verified win grants first-run achievement');
 const rows=f.raw.prepare("SELECT profile_id,result,accepted_moves FROM stackbreaker_daily_attempts_v1").all();
 assert.equal(rows.length,1,'No duplicate attempt rows');
 assert.equal(rows[0].profile_id,'member-a');
 assert.equal(rows[0].result,'won');
 assert.equal(rows[0].accepted_moves,accepted.length);
 const awards=f.raw.prepare("SELECT profile_id,achievement_id FROM stackbreaker_verified_awards_v1").all();
 assert.equal(awards.filter(a=>a.profile_id==='member-a'&&a.achievement_id==='daily-first').length,1,
  'Reward is idempotent and belongs to the authenticated player');
 const duplicateStart=await unwrap(await onRequestPost({request:req('a',{action:'start'}),env:f.env}));
 assert.equal(duplicateStart.status,409,'Completed official run cannot be restarted');
 const duplicateMove=await unwrap(await onRequestPost({request:req('a',{
  action:'move',seq:accepted.length,move:{type:'pass'}
 }),env:f.env}));
 assert.equal(duplicateMove.status,409,'No further actions after terminal result');
 const otherAfter=await unwrap(await onRequestGet({request:req('b'),env:f.env}));
 assert.equal(otherAfter.status,200);
 assert.equal(otherAfter.data.attempt,null,'Other profile retains no first profile attempt');
 const stolenEquip=await unwrap(await onRequestPost({request:req('b',{
  action:'equip',slot:'frame',rewardId:'gold'
 }),env:f.env}));
 assert.equal(stolenEquip.status,403,'Second profile cannot claim winner cosmetic');
 const ownEquip=await unwrap(await onRequestPost({request:req('a',{
  action:'equip',slot:'frame',rewardId:'gold'
 }),env:f.env}));
 assert.equal(ownEquip.status,200);
 assert.equal(ownEquip.data.equipped.frame,'gold');
});
