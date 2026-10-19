import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {communityRead} from "../src/community-read.js";
const key="dcprofile1_"+"a".repeat(32)+"_"+"b".repeat(64);
function stub(){
 const statements=[];
 const db={prepare(sql){
  let args=[];
  const query={bind(...fields){args=fields;return this},
   async first(){
    statements.push({sql,args,kind:"first"});
    if(sql.startsWith("SELECT id,handle,bio"))return {id:"real-account-42",handle:"ArchiveUser",bio:""};
    if(sql.includes("community_decks"))return {n:3};
    if(sql.includes("community_entries"))return {n:2};
    if(sql.includes("community_comments"))return {n:4};
    if(sql.includes("community_playtests"))return {n:1};
    return {n:0};
   },
   async all(){
    statements.push({sql,args,kind:"all"});
    return {results:[{game:sql.includes("arcane")?"cipher":"cold",completed:4,won:2}]}
   }};
  return query;
 }};
 return {db,statements};
}
test("Passport requires actual profile authorization and never accepts a client-supplied profile ID",async()=>{
 const x=stub(),url="https://deep-cuts-edh.pages.dev/api/community?action=passport&profile_id=other-account";
 const unauthorized=await communityRead(new Request(url),x.db);
 assert.equal(unauthorized.status,401);
 assert.equal(x.statements.length,0);
 const valid=await communityRead(new Request(url,{headers:{Authorization:"Bearer "+key}}),x.db);
 assert.equal(valid.status,200);
 const result=await valid.json();
 assert.equal(result.verifiedSource,true);
 assert.equal(result.games.daily[0].completed,4);
 assert.equal(result.games.arcane[0].won,2);
 assert.deepEqual(result.community,{publishedDecks:3,challengeEntries:2,visibleContributions:4,playtests:1});
 assert.equal(x.statements.length,7);
 assert.ok(x.statements.slice(1).every(s=>s.args.length===1&&s.args[0]==="real-account-42"),
  "All stats must be bound to authenticated profile, not URL-provided profile id");
 assert.ok(x.statements.every(s=>!/\bINSERT\b|\bUPDATE\b|\bDELETE\b/i.test(s.sql)),
  "Read-only Passport cannot overwrite accomplishments");
});
test("Passport appears only inside existing signed-in profile overview, without collecting or leaking keys",()=>{
 const html=fs.readFileSync("profile.html","utf8");
 const script=fs.readFileSync("passport.js","utf8");
 assert.match(html,/id="profileOverviewSignedIn" hidden>/);
 assert.ok(html.indexOf('id="passportStats"')>html.indexOf('id="profileOverviewSignedIn"'));
 assert.match(html,/src="\/passport\.js"/);
 assert.match(script,/deepcuts:profile-change/);
 assert.match(script,/fetch\(/);
 assert.match(script,/action=passport/);
 assert.match(script,/action=badges/);
 assert.doesNotMatch(script,/innerHTML|localStorage\.setItem|INSERT INTO|profileRecoveryKey|email_cipher/);
});
