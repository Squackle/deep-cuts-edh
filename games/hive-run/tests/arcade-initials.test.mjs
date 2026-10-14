import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ARCADE_INITIALS_PATTERN,parseArcadeInitials,editArcadeInitials} from "../src/arcade-initials.js";
import {LeaderboardClient} from "../src/leaderboard-client.js";
import {renderLeaderboard} from "../src/leaderboard-ui.js";

test("strict arcade initials: three A-Z or 0-9 only; uppercase on entry",()=>{
 for(const value of ["ABC","a1z","777","Z9Z"]){
  const label=parseArcadeInitials(value);
  assert.ok(label&&ARCADE_INITIALS_PATTERN.test(label));
 }
 for(const value of ["AB","ABCD","A-B","A B","","🔥🔥🔥",123,null,"A_B"]){
  assert.equal(parseArcadeInitials(value),null);
 }
 assert.equal(editArcadeInitials("a bc4"),"ABC");
 assert.equal(editArcadeInitials("aa-"),"AA");
 assert.equal(editArcadeInitials("ß"),"");
});
test("leaderboard client submits initials, never allows a claimed profile handle",async()=>{
 const prior=globalThis.fetch,requests=[];
 globalThis.fetch=async (url,options)=>{
  requests.push(JSON.parse(options.body));
  return new Response(JSON.stringify({ok:true,initials:"Z9Z",profileVerified:true,profileHandle:"RealOwner",score:1800}),{status:201,headers:{"Content-Type":"application/json"}});
 };
 try{
  const client=new LeaderboardClient("/games/hive-run/api/leaderboard");
  client.session={token:"123",seed:42};
  const result=await client.submit({score:1800,kills:2,evolutionsChosen:1,runTicks:11},"Z9Z","PretendOwner");
  assert.equal(result.profileHandle,"RealOwner");
  assert.deepEqual(requests.map(r=>r.alias),["Z9Z"]);
  assert.equal(Object.hasOwn(requests[0],"profileHandle"),false);
  assert.equal(client.session,null);
 }finally{globalThis.fetch=prior}
});
function node(tag,txt,css){
 return {tag,txt,css,children:[],append(...values){this.children.push(...values)},
  replaceChildren(...values){this.children=values},ownerDocument:null};
}
test("only server-verified profiles receive clickable leaderboard links",()=>{
 const doc={createElement:(tag)=>node(tag)};
 const root=node("root");root.ownerDocument=doc;
 const data={mode:"classic",entries:[
  {alias:"ABC",score:1000,kills:0,evolutions:2,profileHandle:"RealOwner",profileVerified:1},
  {alias:"XYZ",score:900,kills:0,evolutions:1,profileHandle:"Imposter",profileVerified:0},
  {alias:"AAA",score:800,kills:0,evolutions:1,profileHandle:null,profileVerified:0}
 ]};
 renderLeaderboard(root,data);
 const verified=root.children[0].children[1].children;
 const guest=root.children[1].children[1].children;
 assert.equal(verified.length,2);assert.equal(verified[1].tag,"a");
 assert.match(verified[1].href,/profile=RealOwner/);
 assert.equal(guest.length,1,"unverified historical guest link must not render");
});
test("submission form displays only three-slot input and identity explanation",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 assert.match(html,/id="playerAlias"[^>]*minlength="3" maxlength="3"/);
 assert.doesNotMatch(html,/id="playerProfile"/);
 assert.match(html,/SIGNED|signed-in/i);
 assert.match(main,/parseArcadeInitials\(\$\("playerAlias"\)\.value\)/);
 assert.doesNotMatch(main,/hive-last-alias-v1/);
});

test("temporary Field Network recovery-key sessions auto-link exactly like the shared profile header",async()=>{
 const before={fetch:globalThis.fetch,localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};
 const key="dcprofile1_"+"a".repeat(32)+"_"+"b".repeat(64);
 const urls=[];
 globalThis.sessionStorage={getItem:name=>name==="dc-profile-key"?key:null};
 globalThis.localStorage={getItem:()=>null};
 globalThis.fetch=async(url,options={})=>{
  urls.push({url,headers:options.headers});
  if(url==="/api/community?action=me"){
   assert.equal(options.headers.Authorization,"Bearer "+key);
   return new Response(JSON.stringify({profile:{handle:"Squackle"}}),{status:200,headers:{"Content-Type":"application/json"}});
  }
  if(options.method==="POST")return new Response(JSON.stringify({ok:true,score:500,profileVerified:true,profileHandle:"Squackle"}),{status:201,headers:{"Content-Type":"application/json"}});
  return new Response(JSON.stringify({entries:[],profile:{handle:"Squackle"}}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{
  const client=new LeaderboardClient("/games/hive-run/api/leaderboard");
  const board=await client.load();
  assert.deepEqual(board.profile,{handle:"Squackle"});
  client.session={token:"abc",seed:13};
  const run=await client.submit({score:500,kills:1,evolutionsChosen:1,runTicks:8},"LOG");
  assert.equal(run.profileVerified,true);
  assert.equal(urls.length,3,"one account validation and two authenticated leaderboard calls");
  assert.ok(urls.slice(1).every(x=>x.headers.Authorization==="Bearer "+key));
 }finally{
  for(const [name,value] of Object.entries(before)){if(value===undefined)delete globalThis[name];else globalThis[name]=value}
 }
});
test("stale recovery key does not override a remembered-device cookie",async()=>{
 const before={fetch:globalThis.fetch,localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};
 const key="dcprofile1_"+"c".repeat(32)+"_"+"d".repeat(64),urls=[];
 globalThis.sessionStorage={getItem:()=>key};globalThis.localStorage={getItem:()=>null};
 globalThis.fetch=async(url,options={})=>{
  urls.push({url,headers:options.headers});
  if(url==="/api/community?action=me")return new Response("{}",{status:401});
  return new Response(JSON.stringify({entries:[],profile:{handle:"CookieOwner"}}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{
  const client=new LeaderboardClient("/games/hive-run/api/leaderboard");
  const board=await client.load();
  assert.equal(board.profile.handle,"CookieOwner");
  assert.equal(urls.length,2);
  assert.equal(Object.hasOwn(urls[1].headers,"Authorization"),false);
 }finally{
  for(const [name,value] of Object.entries(before)){if(value===undefined)delete globalThis[name];else globalThis[name]=value}
 }
});
