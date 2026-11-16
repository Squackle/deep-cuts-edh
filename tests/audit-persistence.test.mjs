import test from 'node:test';
import assert from 'node:assert/strict';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
import {gamesWrite} from '../src/community-games.js';
import {onRequestPost as share} from '../functions/api/decks.js';

const owner={id:'a'.repeat(32)}, outsider={id:'b'.repeat(32)};
const original={commanders:['Commander Mustard'],cards:[{name:'Plains',qty:35}],targetBracket:2};
const revised={...original,cards:[{name:'Plains',qty:36}]};
async function fixture(t){
 const db=sqliteD1('db/community.sql','db/community-v2.sql');t.after(()=>db.close());
 for(const [id,name] of [[owner.id,'AuditOwner'],[outsider.id,'AuditOutsider']])
  db.sqlite.prepare('INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)').run(id,name,'synthetic');
 const published=await gamesWrite(db,owner,{action:'publish_deck',title:'Audit deck',deck:original});
 const {id}=await published.json();assert.equal(published.status,201);
 return {db,id};
}
const update=id=>({action:'version',id,deck:revised,note:'Regression snapshot'});
test('SQL: publishing and updating keep the current deck and version history consistent',async t=>{
 const {db,id}=await fixture(t);
 const r=await gamesWrite(db,owner,update(id));assert.equal(r.status,200);
 const current=db.sqlite.prepare('SELECT version,content FROM community_decks WHERE id=?').get(id);
 const history=db.sqlite.prepare('SELECT content,note FROM community_deck_versions WHERE deck_id=? AND version=2').get(id);
 assert.equal(current.version,2);assert.equal(current.content,history.content);assert.deepEqual(JSON.parse(history.content),revised);
 assert.equal(history.note,'Regression snapshot');
 assert.equal((await gamesWrite(db,outsider,update(id))).status,403);
});
test('SQL regression: failed history insertion rolls back the current deck update',async t=>{
 const {db,id}=await fixture(t);
 db.sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON community_deck_versions WHEN NEW.version=2 BEGIN SELECT RAISE(ABORT,'injected history failure'); END");
 await assert.rejects(gamesWrite(db,owner,update(id)),/injected history failure/);
 const row=db.sqlite.prepare('SELECT version,content FROM community_decks WHERE id=?').get(id);
 assert.equal(row.version,1,'A failed save must preserve the previously committed version');
 assert.deepEqual(JSON.parse(row.content),original);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM community_deck_versions WHERE deck_id=?').get(id).n,1);
});
test('SQL: concurrent updates accept only one writer and preserve its matching history',async t=>{
 const {db,id}=await fixture(t);
 // Force both requests to read the same version before executing their writes.
 const prepare=db.prepare;let readers=0,release;const gate=new Promise(r=>release=r);
 db.prepare=sql=>{
  const s=prepare(sql);
  if(sql.startsWith('SELECT owner_id,version')){
   const first=s.first;s.first=async()=>{const row=await first();if(++readers===2)release();await gate;return row};
  }
  return s;
 };
 // D1 serializes transactions. Serialize local batches too, while reads above race.
 const batch=db.batch;let pending=Promise.resolve();
 db.batch=statements=>{const result=pending.then(()=>batch(statements));pending=result.catch(()=>{});return result};
 const responses=await Promise.all([gamesWrite(db,owner,update(id)),gamesWrite(db,owner,{...update(id),deck:original})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 const row=db.sqlite.prepare('SELECT version,content FROM community_decks WHERE id=?').get(id);
 assert.equal(row.version,2);
 assert.equal(db.sqlite.prepare('SELECT content FROM community_deck_versions WHERE deck_id=? AND version=2').get(id).content,row.content);
});
test('SQL: challenge entry and initial history roll back together on database failure',async t=>{
 const {db}=await fixture(t);
 db.sqlite.exec("UPDATE community_challenges SET opens_at='2000-01-01 00:00:00',closes_at='2099-01-01 00:00:00'; CREATE TRIGGER fail_entry BEFORE INSERT ON community_entries BEGIN SELECT RAISE(ABORT,'injected entry failure'); END");
 const before=db.sqlite.prepare('SELECT COUNT(*) AS n FROM community_decks').get().n;
 await assert.rejects(gamesWrite(db,owner,{action:'challenge_submit',challenge_id:'open-001',title:'Atomic challenge',deck:original}),/injected entry failure/);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM community_decks').get().n,before);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM community_deck_versions').get().n,before);
});
test('Share endpoint rejects null JSON with 400 before database access',async()=>{
 const request=new Request('https://audit.invalid/api/decks',{method:'POST',headers:{Origin:'https://audit.invalid','Content-Type':'application/json'},body:'null'});
 const response=await share({request,env:{DB:{prepare(){throw Error('No database access expected')}},TURNSTILE_SECRET:'synthetic'}});
 assert.equal(response.status,400);
});
