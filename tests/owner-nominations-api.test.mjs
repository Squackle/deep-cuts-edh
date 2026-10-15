import "./nomination-names.test.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {onRequestGet,onRequestPost} from "../functions/api/owner-ops.js";

const ownerKey="dcissuer1_"+"a".repeat(64);
const hash=createHash("sha256").update(ownerKey).digest("hex");
const URL="https://deep-cuts-edh.pages.dev/api/owner-ops";

function database(){
 const nominations=[
  {id:42,name:"Gorbag of Minas Morgul",rationale:"Underrated sacrifice effects",strategy:"Tokens",cards:"Sol Ring",budget:"$100",status:"pending",created_at:"2026-10-15",votes:2},
  {id:43,name:"Reveka",rationale:"Unusual tap ability",strategy:"Untap synergy",cards:"Twiddle",budget:"$50",status:"pending",created_at:"2026-10-15",votes:1},
  {id:9,name:"Approved Candidate",rationale:"Deck",strategy:"Deck",cards:"",budget:"Any",status:"approved",created_at:"2026-10-01",votes:7},
  {id:30,name:"Retired Seed Candidate",rationale:"Old seed",strategy:"Old",cards:"",budget:"$100",status:"retired",created_at:"2026-10-01",votes:1}
 ];
 const writes=[];
 const db={
  nominations,writes,
  prepare(sql){
   const statement={sql,args:[],
    bind(...args){this.args=args;return this},
    async first(){
     if(sql.includes("INSERT INTO community_limits"))return {attempts:1};
     if(sql.includes("member_issuer_credentials"))return {key_hash:hash};
     if(sql.startsWith("SELECT status,name FROM nominations"))return nominations.find(n=>n.id===this.args[0])||null;
     throw Error("Unexpected read: "+sql);
    },
    async all(){
     if(sql.includes("FROM nominations n WHERE n.status='pending'"))return {results:nominations.filter(n=>n.status==="pending")};
     if(sql.includes("FROM nominations n WHERE n.status IN"))return {results:nominations.filter(n=>["approved","rejected","featured"].includes(n.status))};
     if(sql.includes("SELECT status,COUNT(*) AS nominations FROM nominations WHERE status!=\'retired\' GROUP BY status")){
      return {results:["pending","approved","rejected","featured"].map(status=>({status,nominations:nominations.filter(n=>n.status===status).length})).filter(x=>x.nominations)};
     }
     throw Error("Unexpected query: "+sql);
    }
   };return statement;
  },
  async batch(stmts){
   writes.push(stmts);
   assert.equal(stmts.length,2,"A review must include an audit record");
   assert.match(stmts[0].sql,/UPDATE nominations SET status=\? WHERE id=\? AND status='pending'/);
   assert.match(stmts[1].sql,/INSERT INTO owner_action_audit/);
   const [status,id]=stmts[0].args;
   const record=nominations.find(n=>n.id===id);
   assert.equal(record?.status,"pending");
   record.status=status;
   return [{meta:{changes:1}},{meta:{changes:1}}];
  }
 };
 return db;
}
function request(method,body,credential=ownerKey){
 return new Request(URL+(method==="GET"?"?view=nominations":""),{
  method,
  headers:{Origin:"https://deep-cuts-edh.pages.dev","CF-Connecting-IP":"192.0.2.2",
   Authorization:"Bearer "+credential,...(method==="POST"?{"Content-Type":"application/json"}:{})},
  body:method==="POST"?JSON.stringify(body):undefined
 });
}
const env=db=>({DB:db,TURNSTILE_SECRET:"synthetic-not-real"});
test("Protected nominations view returns real pending, reviewed, votes, rationale and strategy",{timeout:10000},async()=>{
 const db=database(),res=await onRequestGet({request:request("GET"),env:env(db)});
 assert.equal(res.status,200);
 const data=await res.json();
 assert.deepEqual(data.pending.map(n=>n.id),[42,43]);
 assert.equal(data.pending[0].votes,2);
 assert.equal(data.pending[0].rationale,"Underrated sacrifice effects");
 assert.equal(data.reviewed[0].status,"approved");
 assert.equal(data.reviewed.some(x=>x.status==="retired"),false,"Retired nominees must not appear in the owner review list");
 assert.equal(data.counts.some(x=>x.status==="retired"),false,"Retired nominees must not appear in owner counters");
 assert.equal(data.counts.find(x=>x.status==="pending").nominations,2);
 assert.equal(db.writes.length,0,"Read-only view must not change records");
});
test("Authorized approval publishes nomination status while keeping existing votes and audit",{timeout:10000},async()=>{
 const db=database(),before=db.nominations[0].votes;
 const res=await onRequestPost({request:request("POST",{kind:"nomination",action:"approved",id:"42"}),env:env(db)});
 assert.equal(res.status,200);
 assert.equal(db.nominations[0].status,"approved");
 assert.equal(db.nominations[0].votes,before);
 assert.equal(db.writes.length,1);
 const again=await onRequestPost({request:request("POST",{kind:"nomination",action:"approved",id:"42"}),env:env(db)});
 assert.equal(again.status,409,"A reviewed nomination cannot be silently reviewed again");
 assert.equal(db.writes.length,1);
});
test("Unauthorized nomination review cannot query nomination records or change status",{timeout:10000},async()=>{
 const db=database();
 for(const method of ["GET","POST"]){
  const res=method==="GET"?await onRequestGet({request:request(method,undefined,"dcissuer1_"+"0".repeat(64)),env:env(db)}):
   await onRequestPost({request:request(method,{kind:"nomination",action:"approved",id:"42"},"dcissuer1_"+"0".repeat(64)),env:env(db)});
  assert.equal(res.status,403);
 }
 assert.equal(db.writes.length,0);
 assert.equal(db.nominations[0].status,"pending");
});
