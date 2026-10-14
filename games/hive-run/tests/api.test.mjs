import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestGet,onRequestPost} from '../../../src/hive-server/leaderboard.js';
import {newRun,start,step} from '../src/engine.js';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../db/leaderboard.sql',import.meta.url),'utf8'));
 return {sqlite,prepare(sql){const st=sqlite.prepare(sql);let params=[];const q={bind(...p){params=p;return q},async run(){const result=st.run(...params);return {meta:{changes:Number(result.changes)}}},async first(){return st.get(...params)||null},async all(){return {results:st.all(...params)}}};return q},async batch(statements){sqlite.exec('BEGIN');try{const res=[];for(const s of statements)res.push(await s.run());sqlite.exec('COMMIT');return res}catch(e){sqlite.exec('ROLLBACK');throw e}}};
}
const url='https://test.invalid/api/leaderboard';
function request(value,origin='https://test.invalid'){return new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.10'},body:JSON.stringify(value)})}
async function call(env,value,data){const r=await onRequestPost({env,request:request(value),data});return {status:r.status,body:await r.json()}}
function ended(seed,mode){const r=newRun({seed,mode});start(r);while(r.status==='running')step(r);return {score:r.score,kills:r.kills,evolutionsChosen:r.evolutionsChosen,ticks:r.runTicks}}
test('permanent Arcade D1 session, profile identity and one-use replay',async()=>{
 const db=database(),env={HIVE_DB:db};
 assert.equal((await call(env,{action:'start',mode:'classic',challenge:'daily'})).status,400);
 const a=await call(env,{action:'start',mode:'classic',challenge:'arcade'});assert.equal(a.status,201);
 const b=await call(env,{action:'start',mode:'hunt',challenge:'arcade'});assert.equal(b.status,201);
 assert.equal(a.body.day,"");assert.equal(b.body.day,"");
 const submit={action:'submit',token:a.body.token,events:[],alias:'t9x',profileHandle:'Imposter',summary:ended(a.body.seed,'classic')};
 const who={id:'profile1',handle:'RealOwner'};
 const result=await call(env,submit,{hiveProfile:who});assert.equal(result.status,201,JSON.stringify(result));
 assert.equal(result.body.initials,'T9X');assert.equal(result.body.profileHandle,'RealOwner');
 assert.equal((await call(env,submit,{hiveProfile:who})).status,409);
 const board=await onRequestGet({env,request:new Request(url+'?mode=classic&challenge=arcade'),data:{resolveProfiles:async()=>{}}});
 const rows=await board.json();assert.equal(rows.entries.length,1);
 assert.equal(rows.entries[0].profileHandle,'RealOwner');assert.equal(rows.entries[0].rulesVersion,'hive-1.3');
 assert.equal(rows.entries[0].profileId,undefined);
 const other=await onRequestGet({env,request:new Request(url+'?mode=hunt&challenge=arcade')});
 assert.equal((await other.json()).entries.length,0);
 assert.equal((await onRequestGet({env,request:new Request(url+'?mode=classic&challenge=daily')})).status,400);
 db.sqlite.close();
});
test('API rejects cross-origin writes, invalid modes, inflated replays, and preserves rejected session',async()=>{
 const db=database(),env={HIVE_DB:db};
 assert.equal((await onRequestPost({env,request:request({action:'start'},'https://evil.invalid')})).status,403);
 assert.equal((await call(env,{action:'start',mode:'fake'})).status,400);
 const a=(await call(env,{action:'start',mode:'hunt'})).body;
 const valid=ended(a.seed,'hunt');
 const bad=await call(env,{action:'submit',token:a.token,events:[],alias:'ABC',summary:{...valid,score:999999}});assert.equal(bad.status,422);
 for(const invalid of [undefined,"","A","AB","ABCD","A-B","A B","🐉🐉🐉"]){
  const result=await call(env,{action:'submit',token:a.token,events:[],alias:invalid,summary:valid});
  assert.equal(result.status,400,"rejected initials "+JSON.stringify(invalid));
 }
 const ok=await call(env,{action:'submit',token:a.token,events:[],alias:'A7Z',summary:valid,profileHandle:'GuestUser'});
 assert.equal(ok.status,201);assert.equal(ok.body.profileVerified,false);assert.equal(ok.body.profileHandle,null);
 const row=db.sqlite.prepare('SELECT alias,profile_handle,profile_id,profile_verified FROM hive_scores_v1').get();
 assert.equal(row.alias,'A7Z');assert.equal(row.profile_verified,0);
 assert.equal(row.profile_handle,null);assert.equal(row.profile_id,null);
 db.sqlite.close();
});
