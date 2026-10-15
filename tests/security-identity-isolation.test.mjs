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
