import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {communityRead} from "../src/community-read.js";

const origin="https://deep-cuts-edh.pages.dev";
const request=(action,headers)=>new Request(origin+"/api/community?action="+action,{headers});
const noDbWrites={prepare(){throw Error("Anonymous session check must not query or mutate DB")}};

test("Guest header session returns HTTP 200 with a neutral profile",async()=>{
 const guest=await communityRead(request("session"),noDbWrites);
 assert.equal(guest.status,200);
 assert.deepEqual(await guest.json(),{profile:null});
 assert.match(guest.headers.get("Content-Type")||"","/json|application\/json/i");
 const strict=await communityRead(request("me"),noDbWrites);
 assert.equal(strict.status,401,"Existing strict authentication endpoint stays protected");
 const invalid=await communityRead(request("session",{Authorization:"Bearer invalid",Cookie:"__Host-dc_device=dcdevice1_"+"f".repeat(64)}),noDbWrites);
 assert.equal(invalid.status,200);
 assert.deepEqual(await invalid.json(),{profile:null},"Bad explicit bearer must not fall back to a cookie");
});

test("Guest-safe session returns only verified public profile for valid credentials",async()=>{
 const profile={id:"c".repeat(32),handle:"CaseTester",bio:"",bio_emoji:"",avatar:"",focus_x:50,focus_y:30,focus_zoom:2.8,created_at:"2026-01-01"};
 let selects=0;
 const db={prepare(sql){
  selects++;
  assert.match(sql,/SELECT/);
  return {bind(){return {first:async()=>profile}}};
 }};
 const bearer="Bearer dcprofile1_"+"a".repeat(32)+"_"+"b".repeat(64);
 const response=await communityRead(request("session",{Authorization:bearer}),db);
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.profile.handle,"CaseTester");
 assert.equal(body.profile.key_hash,undefined);
 assert.equal(selects,1);
 const header=readFileSync("header-profile.js","utf8");
 assert.match(header,/const endpoint="\/api\/community\?action=session"/);
 assert.match(header,/if\(key&&!data\.profile\)/,"Stale key retries a verified device cookie");
});
