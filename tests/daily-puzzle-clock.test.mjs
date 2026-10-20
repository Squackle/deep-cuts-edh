import test from "node:test";
import assert from "node:assert/strict";
import clock,{prepare} from "../workers/daily-puzzle-clock.js";

const success=(game)=>new Response(JSON.stringify({game,day:"2026-10-20",snapshot:"2026-10-19"}),{status:200,headers:{"Content-Type":"application/json"}});
const fetcher=(fn)=>async(url,opts)=>{
 const game=new URL(url).searchParams.get("game");
 return fn(game,opts,url);
};

test("Module-style scheduled worker publishes only safe health text",async()=>{
 let promise;
 clock.scheduled({},undefined,{waitUntil:p=>{promise=p}});
 assert.ok(promise instanceof Promise);
 // No real HTTP request is made by unit tests; catch the default live fetch.
 promise.catch(()=>{});
 const response=await clock.fetch();
 assert.equal(response.status,200);
 assert.equal(response.headers.get("Cache-Control"),"no-store");
 assert.match(await response.text(),/scheduled prewarm only/);
});
test("Both daily puzzle snapshots succeed using the real API response shape",async()=>{
 const calls=[],waits=[];
 const ready=await prepare({fetcher:fetcher(async game=>{calls.push(game);return success(game)}),wait:async m=>waits.push(m)});
 assert.deepEqual(calls,["cold","ladder"]);
 assert.deepEqual(ready,[{game:"cold",day:"2026-10-20",ready:true},{game:"ladder",day:"2026-10-20",ready:true}]);
 assert.deepEqual(waits,[]);
});
test("Retry transient failures with bounded backoff while preparing both games",async()=>{
 const counts=new Map(),waits=[];
 const ready=await prepare({fetcher:fetcher(async game=>{
  counts.set(game,(counts.get(game)||0)+1);
  if(game==="cold"&&counts.get(game)<3)return new Response("overload",{status:503});
  return success(game);
 }),wait:async ms=>waits.push(ms)});
 assert.equal(ready.length,2);
 assert.equal(counts.get("cold"),3);
 assert.equal(counts.get("ladder"),1);
 assert.deepEqual(waits,[350,900]);
});
test("Don't retry permanent 401 and still attempt the other game",async()=>{
 const counts=new Map();
 await assert.rejects(prepare({fetcher:fetcher(async game=>{
  counts.set(game,(counts.get(game)||0)+1);
  return game==="cold"?new Response("not authorized",{status:401}):success(game);
 }),wait:async()=>{throw Error("Permanent error must not retry")}}),/cold/);
 assert.equal(counts.get("cold"),1);
 assert.equal(counts.get("ladder"),1);
});
test("Invalid snapshot retries and never silently claims a daily puzzle is ready",async()=>{
 const counts=new Map();
 await assert.rejects(prepare({fetcher:fetcher(async game=>{
  counts.set(game,(counts.get(game)||0)+1);
  return game==="ladder"?new Response(JSON.stringify({game,day:"wrong",snapshot:"2026-10-19"}),{status:200}):success(game);
 }),wait:async()=>{}}),/ladder/);
 assert.equal(counts.get("cold"),1);
 assert.equal(counts.get("ladder"),3);
});
test("Optional owner alert sends only sanitized failure game names",async()=>{
 let alertData;
 const env={ALERT_WEBHOOK_URL:"https://example.org/alerts"};
 await assert.rejects(prepare({
  env,
  fetcher:async(url,opts)=>{
   if(url==="https://example.org/alerts"){
    alertData=JSON.parse(opts.body);
    assert.equal(opts.method,"POST");
    return new Response("ok",{status:200});
   }
   const game=new URL(url).searchParams.get("game");
   return game==="cold"?new Response("temporary outage with private internals",{status:503}):success(game);
  },
  wait:async()=>{}
 }),/cold/);
 assert.deepEqual(alertData.games,["cold"]);
 assert.equal(alertData.event,"daily-puzzle-prewarm-failed");
 assert.equal(JSON.stringify(alertData).includes("private internals"),false);
});
