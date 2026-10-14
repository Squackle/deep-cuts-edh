import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {onRequestGet,onRequestPost} from "../functions/api/supporter-ticker.js";
import {encryptEmail} from "../src/profile-email.js";
const origin="https://deep-cuts-edh.pages.dev";
const key="dcprofile1_"+"a".repeat(32)+"_"+"b".repeat(64);
const env={KOFI_EMAIL_HASH_SECRET:"fixture-secret",DB:null};
function database(){
 const cipherPromise=encryptEmail("current-supporter@example.com",env);
 const entries=new Map(),writes=[];
 const db={prepare(sql){
  let args=[];
  return {bind(...v){args=v;return this},async first(){
   if(sql.includes("FROM community_profiles WHERE id=? AND key_hash=?"))return {id:"profile1",handle:"Investigator"};
   if(sql.includes("FROM community_profile_emails"))return {email_cipher:await cipherPromise};
   if(sql.includes("FROM supporter_ticker_optins"))return entries.get(args[0])||null;
   if(sql.includes("FROM kofi_renewals"))return {tier:"chief"};
   return null;
  },async all(){
   if(sql.includes("FROM supporter_ticker_optins o")){
    return{results:[...entries.values()].filter(x=>x.visible).map(x=>({display_name:x.display_name,email_cipher:null}))};
   }return{results:[]};
  },async run(){
   writes.push(sql);
   if(sql.includes("INSERT INTO supporter_ticker_optins"))entries.set(args[0],{display_name:args[1],visible:1});
   if(sql.includes("DELETE FROM supporter_ticker_optins"))entries.delete(args[0]);
   return{meta:{changes:1}};
  }};
 }};
 return {db,entries,writes};
}
function req(method,body,authorized=true){
 const headers={Origin:origin,"Content-Type":"application/json"};
 if(authorized)headers.Authorization="Bearer "+key;
 return new Request(origin+"/api/supporter-ticker",{method,headers,body:JSON.stringify(body)});
}
test("Public supporter credits never list a payment without explicit opt-in",async()=>{
 const {db}=database();env.DB=db;
 const response=await onRequestGet({request:new Request(origin+"/api/supporter-ticker"),env});
 assert.equal(response.status,200);assert.deepEqual((await response.json()).supporters,[]);
});
test("Only signed-in users may opt in and explicit consent cannot be inferred",async()=>{
 const {db,writes}=database();env.DB=db;
 const unknown=await onRequestPost({request:req("POST",{displayName:"Jim",visible:true},false),env});
 assert.equal(unknown.status,401);assert.equal(writes.length,0);
 const invalid=await onRequestPost({request:req("POST",{displayName:"Jim"}),env});
 assert.equal(invalid.status,400);assert.equal(writes.length,0);
 const malicious=await onRequestPost({request:req("POST",{displayName:"<script>bad</script>",visible:true}),env});
 assert.equal(malicious.status,400);assert.equal(writes.length,0);
});
test("Opted-in names may be deleted by the verified profile owner",async()=>{
 const {db,entries}=database();env.DB=db;
 const save=await onRequestPost({request:req("POST",{displayName:"Jim",visible:true}),env});
 assert.equal(save.status,200);const data=await save.json();
 assert.equal(data.tier,"chief");assert.equal(entries.get("profile1").display_name,"Jim");
 const remove=await onRequestPost({request:req("POST",{visible:false}),env});
 assert.equal(remove.status,200);assert.equal(entries.size,0);
});
test("Public response strips all email, ids, hashes and credentials",async()=>{
 const {db,entries}=database();env.DB=db;
 entries.set("profile1",{display_name:"Somebody",visible:1});
 const response=await onRequestGet({request:new Request(origin+"/api/supporter-ticker"),env});
 assert.equal(response.status,200);
 const raw=await response.text();
 assert.doesNotMatch(raw,/email|cipher|profile1|secret|payment/i);
});
test("Ticker in shared header has distinct gold, silver, bronze and reduced-motion styles",()=>{
 const js=fs.readFileSync("header-profile.js","utf8"),css=fs.readFileSync("header-profile.css","utf8");
 assert.match(js,/setupSupporterTicker\(root\)/);
 assert.match(js,/header\.append\(strip\)/);
 assert.match(js,/fetch\("\/api\/supporter-ticker"/);
 assert.match(js,/copy\.setAttribute\("aria-hidden","true"\)/);
 assert.match(js,/!values\.length\)return/);
 for(const x of ["site-supporter-chief","site-supporter-detective","site-supporter-informant","site-supporter-roll","prefers-reduced-motion"]){
  assert.ok(css.includes(x),x+" missing");
 }
});
test("User-facing opt-in form requires consent and has an immediate removal route",()=>{
 const html=fs.readFileSync("profile.html","utf8"),js=fs.readFileSync("supporter-ticker-settings.js","utf8");
 for(const marker of ["supporterCreditSettings","supporterCreditName","supporterCreditConsent","supporterCreditRemove"]){
  assert.ok(html.includes('id="'+marker+'"'),marker+" missing");
 }
 assert.match(js,/if\(!consent\.checked\)/);
 assert.match(js,/visible:false/);
});
test("Both daily games have a full card tooltip with hover, focus, ESC and touch controls",()=>{
 const js=fs.readFileSync("daily-games.js","utf8"),css=fs.readFileSync("games.css","utf8");
 assert.match(js,/version=normal/);
 assert.match(js,/pointerenter/);assert.match(js,/\.addEventListener\("focus"/);
 assert.match(js,/el\("button","games-card-peek"/);
 assert.match(js,/event\.key==="Escape"/);
 assert.match(js,/wrapper\.append\(link,peek\)/);
 assert.match(js,/const commanderName=el\("strong"\);commanderName\.append\(commanderLink\(c\.name\)\)/);
 assert.match(js,/entry\.append\(commanderLink\(name\),option\)/);
 assert.match(css,/games-card-tooltip\[hidden\]/);
 assert.match(css,/position:fixed;z-index:250/);
});
