import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {onRequestGet,onRequestPost,countPresence} from "../functions/api/site-presence.js";
const ORIGIN="https://deep-cuts-edh.pages.dev";
const ID="11111111-1111-4111-8111-111111111111", OTHER="22222222-2222-4222-8222-222222222222";
function store(){
 const items=new Map(),puts=[];
 return {items,puts,
  async put(key,value,options){items.set(key,{options});puts.push({key,options})},
  async list(){return {keys:[...items.entries()].map(([name,entry])=>({name,metadata:entry.options.metadata})),list_complete:true}}
 };
}
function post(env,id,page,origin=ORIGIN){
 return onRequestPost({env,request:new Request(ORIGIN+"/api/site-presence",{method:"POST",headers:{"Content-Type":"application/json","Origin":origin},body:JSON.stringify({id,page})})});
}
test("One open browser across multiple pages/tabs is exactly one, anonymous and signed-in equal",async()=>{
 const kv=store(),env={SITE_PRESENCE:kv};
 assert.equal((await post(env,ID,"Home")).status,200);
 assert.equal((await post(env,ID,"Card Library")).status,200);
 assert.equal((await post(env,OTHER,"Arcade")).status,200);
 const counted=await countPresence(kv);
 assert.equal(counted.online,2);
 assert.deepEqual(counted.pages,{"Card Library":1,"Arcade":1});
 assert.equal(counted.approximate,true);
 assert.equal(counted.truncated,false);
 assert.equal(kv.puts[0].options.expirationTtl,180);
 const response=await onRequestGet({env}),json=await response.json();
 assert.equal(json.online,2);
 assert.equal("pages" in json,false,"Public browser counts never leak page-by-page analytics");
 assert.equal("registeredMembers" in json,false,"No member totals on public endpoint");
});
test("Writes reject fake IDs, unapproved page labels and cross-site origins",async()=>{
 const env={SITE_PRESENCE:store()};
 for(const [id,page,origin,code]of [
  ["123","Home",ORIGIN,400],
  [ID,"https://evil.example",ORIGIN,400],
  [ID,"Home","https://evil.example",403]
 ])assert.equal((await post(env,id,page,origin)).status,code);
 assert.equal(env.SITE_PRESENCE.puts.length,0);
});
test("Unavailable KV cannot make up live numbers",async()=>{
 const response=await onRequestGet({env:{}});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error,"Online count unavailable.");
});
test("Public middleware injects into HTML while preserving existing ad-free checks and Card Library source",()=>{
 const middleware=readFileSync("functions/_middleware.js","utf8");
 assert.match(middleware,/new HTMLRewriter\(\)/);
 assert.match(middleware,/site-presence\.js/);
 assert.match(middleware,/isPublicHTMLPath/);
 assert.match(middleware,/path\.startsWith\("\/member-operations"\)/);
 assert.match(middleware,/checkAdFree\(request,context\.env\)/);
 assert.match(middleware,/X-DeepCuts-Ad-Free/);
 const site=readFileSync("site-presence.js","utf8");
 assert.match(site,/window\.setInterval\(pulse,INTERVAL\)/);
 assert.match(site,/localStorage\.getItem\(KEY\)/);
 assert.match(site,/id=crypto\.randomUUID\(\)/);
 assert.doesNotMatch(site,/if\(document\.hidden\)return heartbeat|userIsActive|scrollTracking/);
 const library=readFileSync("library.html","utf8");
 assert.match(library,/id="librarySearch"/);
 const owner=readFileSync("functions/api/owner-ops.js","utf8");
 assert.match(owner,/await authorized\(request,env\)/);
 assert.match(owner,/COUNT\(\*\) AS total FROM community_profiles/);
 assert.match(owner,/countPresence\(env\.SITE_PRESENCE\)/);
 assert.match(readFileSync("owner-v2.js","utf8"),/api\("presence"\)/);
});
