import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPost as webhook} from "../functions/api/kofi-webhook.js";

function fakeD1(){
 const payments=new Set(),adfree=new Set(),events=[];
 return {
  events,payments,adfree,
  prepare(sql){
   const db=this;
   return {sql,args:[],
    bind(...args){this.args=args;return this},
    async run(){return {meta:{changes:1}}},
   };
  },
  async batch(statements){
   const sql=statements.map(s=>s.sql);
   if(sql[0].startsWith("INSERT INTO kofi_webhook_audit"))return statements.map(()=>({meta:{changes:1}}));
   if(sql[0].startsWith("INSERT OR IGNORE INTO kofi_adfree_payments")){
    const id=statements[0].args[0],fresh=!adfree.has(id);
    if(fresh)adfree.add(id);
    return [{meta:{changes:fresh?1:0}},{meta:{changes:fresh?1:0}}];
   }
   if(sql[0].startsWith("INSERT OR IGNORE INTO kofi_payment_events")){
    const id=statements[0].args[0],fresh=!payments.has(id);
    if(fresh)payments.add(id);
    if(fresh)events.push(id);
    return [{meta:{changes:fresh?1:0}},{meta:{changes:fresh?1:0}}];
   }
   throw Error("Unexpected test D1 statement: "+sql[0]);
  }
 };
}
const envFor=db=>({DB:db,KOFI_VERIFICATION_TOKEN:"not-a-real-kofi-secret",KOFI_EMAIL_HASH_SECRET:"not-a-real-email-hash-secret"});
function req(event){
 const form=new URLSearchParams({data:JSON.stringify(event)});
 return new Request("https://deep-cuts-edh.pages.dev/api/kofi-webhook",{
  method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
  body:form.toString()
 });
}
const fixture=()=>({
 verification_token:"not-a-real-kofi-secret",type:"Subscription",
 is_subscription_payment:true,tier_name:"The Informant",
 amount:"5.00",currency:"USD",is_refunded:false,
 email:"synthetic-fixture@example.invalid",message_id:"test-payment-event-0001",
 timestamp:new Date().toISOString()
});
test("Issue #38: identical authenticated Ko-fi event does not record a second entitlement",{timeout:15000},async()=>{
 const db=fakeD1(),env=envFor(db);
 const first=await webhook({request:req(fixture()),env});
 assert.equal(first.status,200);
 assert.equal((await first.json()).recorded,true);
 const again=await webhook({request:req(fixture()),env});
 assert.equal(again.status,200);
 assert.equal((await again.json()).duplicate,true);
 assert.equal(db.payments.size,1);
 assert.equal(db.adfree.size,1);
});
test("Issue #38: spoofed Ko-fi verification token cannot insert payment records",{timeout:15000},async()=>{
 const db=fakeD1(),event=fixture();event.verification_token="spoofed";
 const response=await webhook({request:req(event),env:envFor(db)});
 assert.equal(response.status,403);
 assert.equal(db.payments.size,0);assert.equal(db.adfree.size,0);
});
test("Issue #38: one-off donations do not create recurring membership",{timeout:15000},async()=>{
 const db=fakeD1(),event=fixture();event.type="Tip";event.is_subscription_payment=false;
 const response=await webhook({request:req(event),env:envFor(db)});
 assert.equal(response.status,200);
 assert.equal(db.payments.size,0);
});

test("Staging payment fixture: reusing an authenticated message ID with altered tier/amount grants no second entitlement",{timeout:15000},async()=>{
 const db=fakeD1(),env=envFor(db);
 const original=fixture();
 const initial=await webhook({request:req(original),env});
 assert.equal(initial.status,200);
 assert.equal((await initial.json()).recorded,true);
 const modified={...original,tier_name:"The Chief Investigator",amount:"25.00",email:"synthetic-fixture@example.invalid"};
 const replay=await webhook({request:req(modified),env});
 assert.equal(replay.status,200);
 assert.equal((await replay.json()).duplicate,true);
 assert.deepEqual([...db.payments],[original.message_id]);
 assert.equal(db.adfree.size,1);
});
test("Staging payment fixture: refunded subscriptions cannot create a recurring entitlement",{timeout:15000},async()=>{
 const db=fakeD1(),event={...fixture(),is_refunded:true};
 const res=await webhook({request:req(event),env:envFor(db)});
 assert.equal(res.status,200);
 assert.equal(db.payments.size,0);
 assert.equal(db.adfree.size,0);
});
