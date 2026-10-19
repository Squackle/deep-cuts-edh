import test from "node:test";
import assert from "node:assert/strict";
import {gamesWrite} from "../src/community-games.js";
import {socialWrite} from "../src/community-social.js";
import {auth} from "../src/community-core.js";

const owner={id:"a".repeat(32)},outsider={id:"b".repeat(32)};
const deck={commanders:["Chainer, Dementia Master"],cards:[{name:"Sol Ring",qty:1}]};
const fakeDb=(record)=>({
 operations:[],
 prepare(sql){
  const self=this,call={sql,args:[]};self.operations.push(call);
  return {bind(...args){call.args=args;return this;},
   async first(){if(sql.startsWith("SELECT owner_id,version FROM community_decks"))return record;
    throw Error("Unexpected fixture read: "+sql)},
   async run(){throw Error("Unauthorized test attempted to write")},
  };
 }
});
test("Issue #38: outsider cannot create a version of another member's deck",async()=>{
 const db=fakeDb({owner_id:owner.id,version:1});
 const response=await gamesWrite(db,outsider,{action:"version",id:"c".repeat(32),deck,note:"try"});
 assert.equal(response.status,403);
 assert.equal(db.operations.length,1);
 assert.match(db.operations[0].sql,/SELECT owner_id,version FROM community_decks/);
});
test("Issue #38: deck deletes always scope to signed-in owner instead of client-supplied ID",async()=>{
 for(const [act,sql] of [
  ["delete_deck",/DELETE FROM community_decks WHERE id=\? AND owner_id=\?/],
  ["delete_comment",/UPDATE community_comments SET status='hidden' WHERE id=\? AND author_id=\?/]
 ]){
  const recorded=[];
  const db={prepare(query){return {bind(...args){recorded.push({query,args});return this},async run(){return {meta:{changes:0}}}}}};
  const out=await socialWrite(db,outsider,{action:act,id:owner.id,owner_id:owner.id});
  assert.equal(out.status,200);
  assert.equal(recorded.length,1);
  assert.match(recorded[0].query,sql);
  assert.equal(recorded[0].args.at(-1),outsider.id,"Must derive actor from authenticated session");
 }
});
test("Issue #38: malformed Authorization bearer must not fall back to a valid remembered-device cookie",async()=>{
 const db={prepare(){throw Error("Invalid bearer must not query device session or profile")}};
 const request=new Request("https://deep-cuts-edh.pages.dev/api/community",{headers:{
  Authorization:"Bearer dcprofile1_bad",
  Cookie:"__Host-dc_device=dcdevice1_"+"f".repeat(64)
 }});
 assert.equal(await auth(request,db),null);
});

import {onRequestGet as recoveryGet} from "../functions/api/profile-recovery.js";
import {onRequestPost as devicePost} from "../functions/api/profile-device.js";
import {onRequestPost as arcanePost} from "../functions/api/arcane-games.js";
import {hash} from "../src/community-core.js";
import {buildArcanePuzzle,chicagoDate,cipherLetters} from "../src/arcane-game-data.js";

const base="https://deep-cuts-edh.pages.dev";
const accountA="a".repeat(32),accountB="b".repeat(32);
const keys={
 [accountA]:"dcprofile1_"+accountA+"_"+"c".repeat(64),
 [accountB]:"dcprofile1_"+accountB+"_"+"d".repeat(64)
};
function fakeProfileAccess(){
 const visited=[];
 const db={prepare(sql){
  const call={sql,args:[]};visited.push(call);
  return {bind(...args){call.args=args;return this},
   async first(){
    if(sql.startsWith("SELECT id,handle,bio,")){
     const [id,digest]=call.args;
     return keys[id]&&digest===await hash(keys[id])?{id,handle:id===accountA?"SyntheticA":"SyntheticB"}:null;
    }
    if(sql.startsWith("SELECT email_cipher,verified_at FROM community_profile_emails")){
     return call.args[0]===accountA?{email_cipher:"synthetic-private-A",verified_at:12345}:null;
    }
    if(sql.startsWith("SELECT email_mask FROM community_pending_recovery_contacts")){
     return call.args[0]===accountB?{email_mask:"b***@example.invalid"}:null;
    }
    throw Error("Unexpected fixture read: "+sql);
   },
   async run(){throw Error("Recovery-settings GET must not write")},
   async all(){throw Error("Recovery-settings GET must not enumerate profiles")}
  };
 }};
 return {db,visited};
}
test("Staging matrix: a synthetic member cannot read another member's recovery settings",async()=>{
 const {db,visited}=fakeProfileAccess();
 const aReq=new Request(base+"/api/profile-recovery?profile_id="+accountB,{
  headers:{Authorization:"Bearer "+keys[accountA]}});
 const aRes=await recoveryGet({request:aReq,env:{DB:db}});
 assert.equal(aRes.status,200);
 const aData=await aRes.json();
 assert.equal(aData.verified,true);
 assert.equal(aData.pending,false);
 assert.equal(aData.pendingMaskedEmail,null);
 const bReq=new Request(base+"/api/profile-recovery?profile_id="+accountA,{
  headers:{Authorization:"Bearer "+keys[accountB]}});
 const bRes=await recoveryGet({request:bReq,env:{DB:db}});
 assert.equal(bRes.status,200);
 const bData=await bRes.json();
 assert.equal(bData.verified,false);
 assert.equal(bData.pending,true);
 assert.equal(bData.pendingMaskedEmail,"b***@example.invalid");
 const scoped=visited.filter(x=>x.sql.includes("community_profile_emails")||x.sql.includes("community_pending_recovery_contacts"));
 assert.deepEqual(scoped.map(x=>x.args[0]),[accountA,accountA,accountB,accountB]);
 const refused=await recoveryGet({request:new Request(base+"/api/profile-recovery",{
  headers:{Authorization:"Bearer "+keys[accountA].slice(0,-1)+"0"}}),env:{DB:db}});
 assert.equal(refused.status,401);
});
test("Staging matrix: forget revokes only the presented synthetic device cookie; cookie cannot enroll",async()=>{
 const token="dcdevice1_"+"e".repeat(64),operations=[];
 const db={prepare(sql){
  const call={sql,args:[]};operations.push(call);
  return {bind(...args){call.args=args;return this},
   async run(){if(!sql.startsWith("DELETE FROM community_device_sessions WHERE token_hash=?"))throw Error("Unexpected fixture write");return {meta:{changes:1}}},
   async first(){throw Error("Device without bearer cannot read member data")}
  };
 }};
 const cookie="__Host-dc_device="+token;
 const forget=await devicePost({request:new Request(base+"/api/profile-device",{
  method:"POST",headers:{Origin:base,Cookie:cookie,"Content-Type":"application/json"},
  body:JSON.stringify({action:"forget",profile_id:accountB})}),env:{DB:db}});
 assert.equal(forget.status,200);
 assert.match(forget.headers.get("Set-Cookie")||"",/Max-Age=0/);
 assert.equal(operations.length,1);
 assert.equal(operations[0].args[0],await hash(token));
 const enroll=await devicePost({request:new Request(base+"/api/profile-device",{
  method:"POST",headers:{Origin:base,Cookie:cookie,"Content-Type":"application/json"},
  body:JSON.stringify({action:"remember",profile_id:accountA})}),env:{DB:db}});
 assert.equal(enroll.status,401);
 assert.equal(operations.length,1,"Cookie-only re-enrollment must not access database");
});
test("Staging matrix: forged client daily scores, badges, history and profile IDs are ignored",async()=>{
 const puzzle=buildArcanePuzzle("cipher",chicagoDate());
 const answer=cipherLetters(puzzle.word);
 const guess=["Z","X","A"].map(c=>c.repeat(answer.length)).find(g=>g!==answer);
 assert.ok(guess,"Test requires a deliberately incorrect synthetic guess");
 const writes=[],db={prepare(sql){
  const query={sql,args:[]};
  return {bind(...args){query.args=args;return this},
   async first(){
    if(sql.startsWith("SELECT id,handle,bio,")){
     return query.args[0]===accountA&&query.args[1]===await hash(keys[accountA])?{id:accountA,handle:"SyntheticA"}:null;
    }
    if(sql.startsWith("INSERT INTO community_limits("))return {attempts:1};
    if(sql.startsWith("SELECT payload FROM daily_arcane_puzzles"))return {payload:JSON.stringify(puzzle)};
    if(sql.startsWith("SELECT progress,score,won,finished_at FROM daily_arcane_runs"))return null;
    throw Error("Unexpected fixture read: "+sql);
   },
   async run(){
    writes.push(query);
    if(sql.startsWith("INSERT OR IGNORE INTO daily_arcane_runs("))return {meta:{changes:1}};
    if(sql.startsWith("UPDATE daily_arcane_runs SET "))return {meta:{changes:1}};
    throw Error("Unexpected fixture write: "+sql);
   },
   async all(){
    if(sql.startsWith("SELECT badge,awarded_at FROM daily_arcane_badges"))return {results:[]};
    throw Error("Unexpected fixture listing: "+sql);
   }
  };
 }};
 const res=await arcanePost({request:new Request(base+"/api/arcane-games",{
  method:"POST",
  headers:{Origin:base,Authorization:"Bearer "+keys[accountA],"CF-Connecting-IP":"192.0.2.44","Content-Type":"application/json"},
  body:JSON.stringify({game:"cipher",mode:"daily",day:chicagoDate(),seed:0,action:"guess",guess,
   profile_id:accountB,score:999999,won:true,finished_at:123,badges:["cipher_perfect"],history:[answer]})
 }),env:{DB:db,TURNSTILE_SECRET:"synthetic-test-only"}});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.authenticated,true);
 assert.equal(data.score,0);
 assert.equal(data.won,false);
 assert.deepEqual(data.badges,[]);
 const change=writes.find(x=>x.sql.startsWith("UPDATE daily_arcane_runs SET "));
 assert.ok(change,"Expected authoritative server-side game progress update");
 assert.deepEqual(JSON.parse(change.args[0]),[guess],"Client-supplied winning history must be ignored");
 assert.equal(change.args[1],0,"Client-supplied score must not persist");
 assert.equal(change.args[4],accountA,"Only the verified signed-in account may receive the result");
});

import {onRequestPost as recoveryPost} from "../functions/api/profile-recovery.js";
import {emailHash,codeHash} from "../src/profile-email.js";
test("Staging matrix: one-use recovery code rotates only its verified synthetic profile and revokes devices",async()=>{
 const challengeId="1".repeat(32),code="12345678",email="synthetic-a@example.invalid";
 const env={TURNSTILE_SECRET:"synthetic-turnstile-fixture",KOFI_EMAIL_HASH_SECRET:"synthetic-email-index-fixture",
  RESEND_API_KEY:"synthetic-mailer-not-used",PROFILE_EMAIL_FROM:"fixture@example.invalid"};
 const emailDigest=await emailHash(email,env),otpDigest=await codeHash(challengeId,code,env);
 const written=[];let consumed=false,newKeyDigest=null,devicesRevoked=false;
 const db={
  prepare(sql){
   const q={sql,args:[]};
   return {bind(...args){q.args=args;return this},
    async first(){
     if(sql.startsWith("INSERT INTO community_limits("))return {attempts:1};
     if(sql.startsWith("SELECT profile_id,email_hash,code_hash FROM community_email_challenges"))
      return consumed?null:{profile_id:accountA,email_hash:emailDigest,code_hash:otpDigest};
     if(sql.startsWith("SELECT 1 FROM community_profile_emails WHERE profile_id="))
      return q.args[0]===accountA&&q.args[1]===emailDigest?{"1":1}:null;
     throw Error("Unexpected recovery fixture read: "+sql);
    },
    async run(){throw Error("Recovery fixture should use atomic DB.batch")}
   };
  },
  async batch(statements){
   written.push(...statements);
   assert.equal(statements.length,4);
   assert.match(statements[0].sql,/^UPDATE community_profiles SET key_hash=/);
   assert.equal(statements[0].args[1],accountA);
   assert.match(statements[1].sql,/^UPDATE community_email_challenges SET used_at=/);
   assert.match(statements[3].sql,/^DELETE FROM community_device_sessions WHERE profile_id=/);
   assert.equal(statements[3].args[0],accountA);
   assert.equal(consumed,false);
   consumed=true;newKeyDigest=statements[0].args[0];devicesRevoked=true;
   return statements.map(()=>({meta:{changes:1}}));
  }
 };
 env.DB=db;
 const build=()=>new Request(base+"/api/profile-recovery",{
  method:"POST",
  headers:{Origin:base,"CF-Connecting-IP":"192.0.2.51","Content-Type":"application/json"},
  body:JSON.stringify({action:"finish_recovery",email,requestId:challengeId,code,profile_id:accountB})
 });
 const first=await recoveryPost({request:build(),env});
 assert.equal(first.status,200);
 const result=await first.json();
 assert.equal(result.ok,true);
 assert.match(result.key,new RegExp("^dcprofile1_"+accountA+"_[a-f0-9]{64}$"));
 assert.equal(newKeyDigest,await hash(result.key),"Persisted new key hash must match only the verified owner");
 assert.equal(devicesRevoked,true);
 const replay=await recoveryPost({request:build(),env});
 assert.equal(replay.status,400,"Consumed one-time recovery challenges cannot rotate a second time");
 assert.equal("key" in (await replay.json()),false);
 assert.equal(written.length,4,"Replay must not issue another profile key or revoke anything else");
});
