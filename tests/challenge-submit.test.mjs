import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {gamesWrite} from "../src/community-games.js";
import {normalizeDeckSourceUrl} from "../src/challenge-source-url.js";

const featured={id:"rescue-001",title:"Featured Case",commander:"Old case",format:"commander",status:"active",opens_at:"2000-01-01 00:00:00",closes_at:"2099-01-01 00:00:00"};
const open={...featured,id:"open-001",format:"open"};
const mustard={commanders:["Commander Mustard"],cards:[{name:"Sol Ring",qty:1},{name:"Plains",qty:35}],targetBracket:2};
function fakeDb(ch){
 const batches=[];
 return {
  batches,
  prepare(sql){return {
   sql,args:[],
   bind(...args){this.args=args;return this},
   async first(){return sql.includes("FROM community_challenges")?ch:null}
  }},
  async batch(statements){batches.push(statements);return statements.map(()=>({meta:{changes:1}}))}
 };
}
async function submit(db,extra={}){
 const request={action:"challenge_submit",challenge_id:db.challengeId||"open-001",title:"Mustard's Field Case",deck:mustard,sourceUrl:"https://moxfield.com/decks/ABC-123",...extra};
 const response=await gamesWrite(db,{id:"owner1"},request);
 return {status:response.status,body:await response.json()};
}
test("Only public https deck routes are accepted as attribution; never fetch user URLs",()=>{
 for(const valid of ["https://moxfield.com/decks/123","https://archidekt.com/decks/12345","https://deckstats.net/decks/1/23","https://www.mtggoldfish.com/deck/123"]){
  assert.ok(normalizeDeckSourceUrl(valid),valid);
 }
 for(const invalid of ["javascript:alert(1)","http://moxfield.com/decks/1","https://moxfield.com.evil.org/decks/1","https://moxfield.com@evil.org/decks/1","https://evil.org/decks/1","https://moxfield.com/","https://127.0.0.1/decks/123"]){
  assert.equal(normalizeDeckSourceUrl(invalid),null,invalid);
 }
 assert.equal(normalizeDeckSourceUrl(""),"");
});
test("Direct Rescue Challenge paste is stored atomically as a public deck, version and legacy-compatible entry",async()=>{
 const db=fakeDb(open);
 const r=await submit(db);
 assert.equal(r.status,201);
 assert.match(r.body.id,/^[a-f0-9]{32}$/);
 assert.equal(db.batches.length,1);
 const [deck,version,entry]=db.batches[0];
 assert.match(deck.sql,/INSERT INTO community_decks/);
 assert.match(version.sql,/INSERT INTO community_deck_versions/);
 assert.match(entry.sql,/INSERT INTO community_entries/);
 assert.equal(deck.args[0],r.body.id);
 assert.equal(entry.args[1],r.body.id);
 const snapshot=JSON.parse(deck.args[4]);
 assert.deepEqual(snapshot.commanders,["Commander Mustard"]);
 assert.equal(snapshot.sourceUrl,"https://moxfield.com/decks/ABC-123");
 assert.equal(version.args[2],deck.args[4]);
});
test("Direct entry rejects closed challenges, wrong featured commander, fake URLs and empty lists before any write",async()=>{
 const invalidCases=[
  [open,{sourceUrl:"https://moxfield.com.evil.org/decks/1"},400],
  [open,{deck:{commanders:["Commander Mustard"],cards:[]}},400],
  [featured,{deck:{...mustard,commanders:["Commander Mustard","Partner"]},challenge_id:"rescue-001"},400],
  [featured,{deck:{...mustard,commanders:["Chainer, Dementia Master"]},challenge_id:"rescue-001"},400],
  [{...open,closes_at:"2000-01-02 00:00:00"},{},409]
 ];
 for(const [challenge,overrides,expected] of invalidCases){
  const db=fakeDb(challenge);
  const r=await submit(db,{challenge_id:challenge.id,...overrides});
  assert.equal(r.status,expected,JSON.stringify(overrides));
  assert.equal(db.batches.length,0);
 }
});
test("Card Library files are not modified by the challenge flow and original legacy features remain",()=>{
 const html=fs.readFileSync("community.html","utf8");
 const ui=fs.readFileSync("community-features.js","utf8");
 const endpoint=fs.readFileSync("functions/api/community.js","utf8");
 assert.match(html,/id="challengeSubmitForm"/);
 assert.match(html,/id="deckForm"/);
 assert.match(html,/id="challengeDeck"/);
 assert.match(html,/id="challengeEntries"/);
 assert.match(ui,/action:"challenge_submit"/);
 assert.match(ui,/EXPORT DECK SNAPSHOT/);
 assert.match(endpoint,/challenge_submit:"publish"/);
 assert.ok(fs.existsSync("library.html"));
 assert.ok(fs.existsSync("library.js"));
});
