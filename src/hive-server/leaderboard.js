import {MODES} from "../../games/hive-run/src/modes.js";
/**
 * Hive Run leaderboard — Cloudflare Pages Function.
 * Uses a separate Game Lab D1 database. Exact same simulation is replayed
 * server-side before publishing. No third-party account credentials accepted.
 */
import {newRun,start,step,turn,chooseMutation,RULES_VERSION} from "../../games/hive-run/src/engine.js";
import {placeHatchlingWard} from "../../games/hive-run/src/hatchling-ward.js";
import {parseArcadeInitials} from "../../games/hive-run/src/arcade-initials.js";
const json=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
const error=(message,status=400)=>json({error:message},status);
const now=()=>Math.floor(Date.now()/1000);
const MAX_EVENTS=14000,MAX_TICKS=6000;
async function subject(request){
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 // Stable pseudonymous value for a session that may span an hourly bucket.
 // Rate-limit windows themselves are separated inside throttle().
 const bytes=new TextEncoder().encode(ip+"|hive-limit-v1");
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,"0")).join("");
}
async function throttle(db,key,action,limit){
 const id=key+"|"+action;
 const bucket=new Date().toISOString().slice(0,13);
 await db.prepare("INSERT INTO hive_limits(subject,bucket,attempts) VALUES(?,?,1) ON CONFLICT(subject,bucket) DO UPDATE SET attempts=attempts+1").bind(id,bucket).run();
 const row=await db.prepare("SELECT attempts FROM hive_limits WHERE subject=? AND bucket=?").bind(id,bucket).first();
 return (row?.attempts||0)<=limit;
}
function validEvents(events){
 if(!Array.isArray(events)||events.length>MAX_EVENTS)return false;
 let last=0;
 for(const ev of events){
  if(!Array.isArray(ev)||ev.length!==3||!Number.isInteger(ev[0])||ev[0]<last||ev[0]>MAX_TICKS)return false;
  if(ev[1]==="turn"&&!["up","down","left","right"].includes(ev[2]))return false;
  if(ev[1]==="choose"&&!["W","U","B","R","G"].includes(ev[2]))return false;
  if(ev[1]==="ward"&&ev[2]!==null)return false;
  if(ev[1]!=="turn"&&ev[1]!=="choose"&&ev[1]!=="ward")return false;
  last=ev[0];
 }
 return true;
}
export function replayScore(seed,events,expected,mode="hunt"){
 if(!validEvents(events)||!expected||!Number.isInteger(expected.ticks)||expected.ticks<0||expected.ticks>MAX_TICKS)
  return {ok:false,reason:"Invalid replay format."};
 const run=newRun({cols:18,rows:22,seed,mode});
 start(run);
 let index=0,loops=0;
 while(loops++<MAX_TICKS+events.length+10){
  while(index<events.length&&events[index][0]===run.runTicks){
   const [at,kind,value]=events[index++];
   if(kind==="turn"){if(!turn(run,value))return {ok:false,reason:"Invalid turn in replay."}}
   else if(kind==="ward"){if(!placeHatchlingWard(run))return {ok:false,reason:"Invalid Hatchling Ward placement."}}
   else if(!chooseMutation(run,value))return {ok:false,reason:"Invalid mutation selection."};
  }
  if(run.status==="draft")return {ok:false,reason:"Missing mutation choice."};
  if(run.status==="over"||run.status==="won")break;
  if(run.runTicks>expected.ticks)return {ok:false,reason:"Run exceeds submitted ticks."};
  step(run);
 }
 if(index!==events.length||!["over","won"].includes(run.status))return {ok:false,reason:"Replay was incomplete."};
 const keys=["score","kills","evolutionsChosen"];
 if(!keys.every(k=>Number.isInteger(expected[k])&&expected[k]===run[k]))
  return {ok:false,reason:"Score or evolution tally does not match replay."};
 if(run.runTicks!==expected.ticks)return {ok:false,reason:"Step count does not match replay."};
 if(typeof expected.outcome!=="string"||expected.outcome!==run.outcome)return {ok:false,reason:"Terminal outcome does not match replay."};
 return {ok:true,score:run.score,kills:run.kills,evolutions:run.evolutionsChosen,ticks:run.runTicks,outcome:run.outcome};
}
export async function onRequestGet({request,env,data={}}){
 if(!env.HIVE_DB)return error("Leaderboard storage unavailable.",503);
 const url=new URL(request.url),mode=url.searchParams.get("mode")||"hunt",challenge=url.searchParams.get("challenge")||"arcade";
 if(!Object.hasOwn(MODES,mode)||challenge!=="arcade")return error("Only permanent Arcade rankings are supported.");
 const day="";
 try{
  const rows=await env.HIVE_DB.prepare("SELECT id,alias,profile_id AS profileId,profile_handle AS profileHandle,profile_verified AS profileVerified,score,kills,evolutions,rules_version AS rulesVersion,created_at AS createdAt FROM hive_scores_v1 WHERE mode=? AND challenge_day=? ORDER BY score DESC,kills DESC,created_at ASC,id ASC LIMIT 10").bind(mode,day).all();
  const entries=rows.results||[];
  // The signed-in player's VERIFIED record, even if it sits outside top ten.
  // Computing rank over every score keeps tied ranks deterministic.
  let personalBest=null;
  if(data.hiveProfile?.id){
   personalBest=await env.HIVE_DB.prepare(`SELECT alias,score,kills,evolutions,rulesVersion,position FROM (
    SELECT alias,score,kills,evolutions,rules_version AS rulesVersion,profile_id,profile_verified,
     ROW_NUMBER() OVER (ORDER BY score DESC,kills DESC,created_at ASC,id ASC) AS position
    FROM hive_scores_v1 WHERE mode=? AND challenge_day=?
   ) WHERE profile_id=? AND profile_verified=1 ORDER BY position ASC LIMIT 1`)
    .bind(mode,day,data.hiveProfile.id).first()||null;
  }
  // Resolve live identity on the integrated site. Deleted profiles lose public ownership.
  if(data.resolveProfiles)await data.resolveProfiles(entries);
  else for(const entry of entries){if(entry.profileVerified){entry.profileHandle=null;entry.profileVerified=0}}
  for(const entry of entries){
   entry.isYou=!!(data.hiveProfile?.id&&entry.profileVerified&&entry.profileId===data.hiveProfile.id);
   delete entry.profileId;
  }
  return json({season:"2.0",mode,challenge,day,rulesVersion:RULES_VERSION,verifiedScores:true,
   profile:data.hiveProfile?{handle:data.hiveProfile.handle}:null,personalBest,entries});
 }catch{return error("Could not load leaderboard.",503)}
}
async function boundedJSON(request){
 const reader=request.body?.getReader();if(!reader)throw Error("Empty request");
 const chunks=[];let length=0;
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;
  if(length>600000){await reader.cancel();throw Error("Replay too large")};chunks.push(value)}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export async function onRequestPost({request,env,data:contextData={}}){
 if(!env.HIVE_DB)return error("Leaderboard storage unavailable.",503);
 if(request.headers.get("Origin")!==new URL(request.url).origin)return error("Same-origin request required.",403);
 let data;try{data=await boundedJSON(request)}catch{return error("Invalid or oversized JSON.",400)}
 const db=env.HIVE_DB,key=await subject(request);
 try{
  if(data?.action==="start"){
   const mode=data.mode||"hunt",challenge=data.challenge||"arcade";
   if(!Object.hasOwn(MODES,mode)||challenge!=="arcade")return error("Daily Ritual and other challenges are retired.");
   if(!await throttle(db,key,"start",60))return error("Too many games started. Try again later.",429);
   const day="";
   const token=crypto.randomUUID(),seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;
   await db.prepare("INSERT INTO hive_sessions_v1(token,seed,issued_at,subject,mode,challenge_day,rules_version) VALUES(?,?,?,?,?,?,?)").bind(token,seed,now(),key,mode,day,RULES_VERSION).run();
   return json({token,seed,mode,challenge,day,rulesVersion:RULES_VERSION,sessionExpiresSeconds:7200},201);
  }
  if(data?.action!=="submit")return error("Unknown action.");
  if(!await throttle(db,key,"submit",30))return error("Submission rate limit reached.",429);
  const initials=parseArcadeInitials(data.alias);
  if(!initials)return error("Enter exactly three letters or numbers for your arcade initials.",400);
  const {token,events,summary}=data;
  if(typeof token!=="string"||!/^[-a-f0-9]{36}$/.test(token)||!validEvents(events))return error("Invalid game session or replay.");
  const record=await db.prepare("SELECT seed,issued_at,used_at,subject,mode,challenge_day,rules_version FROM hive_sessions_v1 WHERE token=?").bind(token).first();
  if(!record||record.used_at!==null||record.subject!==key||now()-record.issued_at>7200||record.rules_version!==RULES_VERSION||record.challenge_day!=="")
   return error("Game session expired or already submitted.",409);
  const result=replayScore(record.seed,events,summary,record.mode);
  if(!result.ok)return error("Score verification failed: "+result.reason,422);
  const identity=contextData.hiveProfile;
  const alias=initials;
  // Only authenticated account identity can attach a verified profile.
  // Ignore all caller-supplied profile handles, including historic clients.
  const profileHandle=identity?.handle||null;
  const id=crypto.randomUUID(),stamp=now();
  // The conditional INSERT and claim execute in one transaction. A racing second
  // submission cannot publish another row for this one-use token.
  const results=await db.batch([
   db.prepare("INSERT INTO hive_scores_v1(id,session_token,alias,profile_id,profile_handle,profile_verified,score,kills,evolutions,ticks,rules_version,mode,challenge_day,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM hive_sessions_v1 WHERE token=? AND used_at IS NULL)")
    .bind(id,token,alias,identity?.id||null,profileHandle,identity?1:0,result.score,result.kills,result.evolutions,result.ticks,RULES_VERSION,record.mode,record.challenge_day,stamp,token),
   db.prepare("UPDATE hive_sessions_v1 SET used_at=? WHERE token=? AND used_at IS NULL").bind(stamp,token)
  ]);
  if((results[0].meta?.changes||0)!==1)return error("This run has already been submitted.",409);
  return json({ok:true,id,score:result.score,kills:result.kills,evolutions:result.evolutions,initials:alias,
   profileVerified:!!identity,profileHandle:identity?.handle||null,outcome:result.outcome},201);
 }catch{return error("Leaderboard is temporarily unavailable.",503)}
}
