import test from "node:test";
import assert from "node:assert/strict";
import {onRequestPost as ownerOpsPost,onRequestGet as ownerOpsGet} from "../functions/api/owner-ops.js";
import {onRequestPost as ownerMembersPost,onRequestGet as ownerMembersGet} from "../functions/api/owner-members.js";
import {onRequestPost as nominationsPost} from "../functions/api/nominations.js";
import {onRequestPost as feedbackPost} from "../functions/api/feedback.js";
import {onRequestPost as diagnosticPost,onRequestGet as diagnosticGet} from "../functions/api/kofi-diagnostics.js";
import {onRequestGet as retiredAccountGet,onRequestPost as retiredAccountPost} from "../functions/api/account.js";
import {onRequestPost as retiredStripePost} from "../functions/api/stripe-webhook.js";

const URL="https://deep-cuts-edh.pages.dev";
function request(path,method="GET",headers={},payload){
 return new Request(URL+path,{method,headers:{"CF-Connecting-IP":"192.0.2.99",...headers},body:payload===undefined?undefined:JSON.stringify(payload)});
}
function denialDb(){
 const seen=[];
 const db={prepare(sql){
  seen.push(sql);
  return {bind(){return this},async first(){
    if(sql.includes("community_limits"))return {attempts:1};
    if(sql.includes("member_issuer_credentials"))return {key_hash:"f".repeat(64)};
    return null;
  },async all(){throw Error("Unauthorized request reached private records!")},async run(){throw Error("Unauthorized request changed state!")}}
 }};
 return {db,seen};
}
test("owner-only v2 and member endpoints reject missing bearer key before private read or write",async()=>{
 for(const endpoint of [
  {label:"owner v2 GET",handler:ownerOpsGet,path:"/api/owner-ops?view=overview",method:"GET"},
  {label:"owner v2 POST",handler:ownerOpsPost,path:"/api/owner-ops",method:"POST"},
  {label:"member GET",handler:ownerMembersGet,path:"/api/owner-members",method:"GET"},
  {label:"member POST",handler:ownerMembersPost,path:"/api/owner-members",method:"POST"}
 ]){
  const {db,seen}=denialDb();
  const res=await endpoint.handler({request:request(endpoint.path,endpoint.method,{Origin:URL,...(endpoint.method==="POST"?{"Content-Type":"application/json"}:{})},endpoint.method==="POST"?{kind:"feature",action:"approved",id:"public_feedback"}:undefined),env:{DB:db,TURNSTILE_SECRET:"fixture-not-real"}});
  assert.ok([401,403,429].includes(res.status),endpoint.label+" returned unexpected "+res.status);
  assert.equal(seen.some(x=>/UPDATE |DELETE |INSERT INTO (?:owner_|member_|nominations|community_reports)/i.test(x)),false,endpoint.label+" attempted state change");
 }
});
test("nominations and feedback feature switches reject paused submissions before Turnstile or writes",async()=>{
 for(const {label,handler,path,flag} of [
  {label:"nominations",handler:nominationsPost,path:"/api/nominations",flag:"public_nominations"},
  {label:"feedback",handler:feedbackPost,path:"/api/feedback",flag:"public_feedback"}
 ]){
  const sql=[];
  const db={prepare(s){sql.push(s);return{bind(v){assert.equal(v,flag);return this},async first(){return {enabled:0}}}}};
  const res=await handler({request:request(path,"POST",{Origin:URL,"Content-Type":"application/json"},{}),env:{DB:db,TURNSTILE_SECRET:"fixture-not-real"}});
  assert.equal(res.status,503,label);
  assert.equal(sql.length,1,label+" must not write a paused submission");
 }
});
test("retired endpoints cannot create old password accounts or Stripe subscriptions",async()=>{
 assert.equal((await retiredAccountGet()).status,410);
 assert.equal((await retiredAccountPost()).status,410);
 assert.equal((await retiredStripePost()).status,410);
});
test("Ko-fi diagnostic endpoint denies requests without its separate private bearer credential",async()=>{
 const db={prepare(){throw Error("Unauthorized diagnostics attempted DB access!")}};
 const env={DB:db,KOFI_ADMIN_DIAGNOSTICS_HASH:"a".repeat(64)};
 const denied=await diagnosticPost({request:request("/api/kofi-diagnostics","POST",{Origin:URL}),env});
 assert.equal(denied.status,403);
 assert.equal((await diagnosticGet()).status,405);
});
