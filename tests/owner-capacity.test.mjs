import test from "node:test";
import assert from "node:assert/strict";
import {FREE_REFERENCE,summarizeCloudflareUsage,readOwnerCapacity} from "../src/owner-capacity.js";
import {onRequestGet} from "../functions/api/owner-ops.js";
const now=Date.parse("2026-10-15T16:00:00Z");
const day="2026-10-15";
const cfFixture={data:{viewer:{accounts:[{
 workersInvocationsAdaptive:[{dimensions:{datetime:day+"T12:00:00Z",scriptName:"pages-site"},sum:{requests:321,errors:2}},{dimensions:{datetime:"2026-10-14T11:00:00Z",scriptName:"worker-other"},sum:{requests:80,errors:0}}],
 d1AnalyticsAdaptiveGroups:[
  {dimensions:{date:day,databaseId:"5f870895-4281-45d2-b331-45c8182e1079"},sum:{rowsRead:1200,rowsWritten:11,readQueries:70,writeQueries:7}},
  {dimensions:{date:day,databaseId:"47254394-3679-43f3-9ca3-9a14155d5a17"},sum:{rowsRead:300,rowsWritten:2,readQueries:12,writeQueries:1}},
  {dimensions:{date:"2026-10-14",databaseId:"another-account-db"},sum:{rowsRead:200,rowsWritten:3,readQueries:10,writeQueries:1}}
 ]}]}}};
const credential={CLOUDFLARE_ACCOUNT_ID:"a".repeat(32),CLOUDFLARE_ANALYTICS_TOKEN:"test-only-token-no-permissions"};
test("Capacity without account binding never makes network calls or invents zeros",{timeout:5000},async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error("disconnected view must not call Cloudflare")};
 try{const result=await readOwnerCapacity({},{now});assert.equal(result.state,"not_configured");assert.equal(result.workers,null);assert.equal(result.d1,null);assert.equal(result.freeReference.planVerified,false);assert.equal(result.freeReference.workersRequestsDay,100000)}
 finally{globalThis.fetch=old}
});
test("Actual GraphQL groups become properly labeled 7-day account metrics without claiming visitor counts",()=>{
 const data=summarizeCloudflareUsage(cfFixture,now);
 assert.equal(data.state,"connected");
 assert.equal(data.workers.today.requests,321);assert.equal(data.workers.today.errors,2);
 assert.equal(data.workers.daily.length,7);assert.equal(data.workers.daily.at(-2).requests,80);
 assert.equal(data.d1.today.rowsRead,1500);assert.equal(data.d1.today.rowsWritten,13);
 assert.equal(data.d1.daily.at(-2).rowsRead,200);
 assert.equal(data.d1.databases.community.rowsRead,1200);
 assert.equal(data.d1.databases.hive.rowsWritten,2);
 assert.match(data.workers.scope,/Entire Cloudflare account/);
 assert.match(data.note,/not unique visitors/);
});
test("Private authenticated view reads only Cloudflare analytics and D1 metadata when configured",{timeout:10000},async()=>{
 const old=globalThis.fetch, calls=[];
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),method:options.method||"GET",auth:options.headers.Authorization});
  if(String(url).endsWith("/graphql"))return new Response(JSON.stringify(cfFixture),{status:200,headers:{"Content-Type":"application/json"}});
  return new Response(JSON.stringify({success:true,result:{file_size:String(url).includes("5f870895")?1048576:131072}}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{
  const result=await readOwnerCapacity(credential,{now});
  assert.equal(result.state,"connected");
  assert.equal(result.d1.databases.community.sizeBytes,1048576);
  assert.equal(result.d1.databases.hive.sizeBytes,131072);
  assert.equal(result.workers.today.requests,321);
  assert.equal(calls.length,3);
  assert.ok(calls.every(x=>x.url.startsWith("https://api.cloudflare.com/client/v4/")));
  assert.ok(calls.every(x=>x.auth==="Bearer "+credential.CLOUDFLARE_ANALYTICS_TOKEN));
  assert.ok(calls.every(x=>x.method==="GET"||x.method==="POST"));
  assert.equal(JSON.stringify(result).includes(credential.CLOUDFLARE_ANALYTICS_TOKEN),false,"Never leak credentials in JSON response");
 }finally{globalThis.fetch=old}
});
test("Cloudflare permission error returns unavailable, not invented zero daily traffic",{timeout:10000},async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({errors:[{message:"Permission denied"}],data:null}),{status:200});
 try{const result=await readOwnerCapacity(credential,{now});assert.equal(result.state,"unavailable");assert.equal(result.workers,null);assert.equal(result.d1,null);assert.equal(JSON.stringify(result).includes("Permission denied"),false)}
 finally{globalThis.fetch=old}
});
test("Malformed GraphQL response is refused rather than displaying partial totals",()=>{
 assert.throws(()=>summarizeCloudflareUsage({data:{viewer:{accounts:[{workersInvocationsAdaptive:[]}]}}},now),/not available/);
 assert.equal(FREE_REFERENCE.d1RowsWrittenDay,100000);
});
test("Missing owner-key rejects access to capacity metrics before any D1 read or external fetch",{timeout:7000},async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>{throw Error("No Cloudflare calls allowed")};
 const db={prepare(sql){if(sql.includes("community_limits")||sql.includes("member_issuer_credentials"))return{bind(){return this},async first(){return sql.includes("community_limits")?{attempts:1}:{key_hash:"f".repeat(64)}}};throw Error("Denied identity accessed private D1")}};
 try{
  const request=new Request("https://deep-cuts-edh.pages.dev/api/owner-ops?view=capacity",{headers:{"CF-Connecting-IP":"192.0.2.9",Origin:"https://deep-cuts-edh.pages.dev"}});
  const res=await onRequestGet({request,env:{DB:db,...credential}});
  assert.ok([401,403,429].includes(res.status));
 }finally{globalThis.fetch=old}
});
