import {send,fail,auth,originOK,quota,body} from '../../src/community-core.js';
import {LAB_SOURCE_SHA,STACKBREAKER_SERVER_RULES,MAX_ACCEPTED_MOVES,
 utcDay,currentDaily,boundScenario,digestScenario,replayServerMoves} from '../../src/stackbreaker-verify/server-replay.js';
// Features remain DISABLED until the separate schema, authentication, QA and
// production release are explicitly verified by the website developer.
async function ready(env){
 if(!env.DB)return false;
 try{
  const row=await env.DB.prepare("SELECT enabled FROM stackbreaker_launch_v1 WHERE feature='verified-daily'").first();
  return Number(row?.enabled)===1;
 }catch{return false}
}
const awardMap={
 'daily-first':{slot:'frame',reward:'gold',threshold:1},
 'seven-dates':{slot:'vfx',reward:'prismatic',threshold:7},
 'monthly-rhythm':{slot:'title',reward:'daily-adept',threshold:20}
};
const safeJSON=x=>{try{return JSON.parse(x||'[]')}catch{return null}};
const gameStatus=(row)=>row?{day:row.utc_date,status:row.result,
  moves:row.accepted_moves,puzzleId:row.puzzle_id,finishedAt:row.finished_at||null}:null;
async function session(request,env){
 if(!await ready(env))return {error:fail('Verified Stackbreaker is not yet enabled.',503)};
 const user=await auth(request,env.DB);
 if(!user)return {error:fail('Sign in to your community profile first.',401)};
 return {user};
}
async function activeRow(db,profileId,day){
 return db.prepare('SELECT * FROM stackbreaker_daily_attempts_v1 WHERE profile_id=? AND utc_date=?')
  .bind(profileId,day).first();
}
async function verifiedAwards(db,profileId){
 const a=await db.prepare('SELECT achievement_id FROM stackbreaker_verified_awards_v1 WHERE profile_id=? ORDER BY awarded_at')
  .bind(profileId).all();
 return (a.results||[]).map(x=>x.achievement_id).filter(x=>Object.hasOwn(awardMap,x));
}
async function equipment(db,profileId){
 const a=await db.prepare('SELECT slot,reward_id FROM stackbreaker_equipped_v1 WHERE profile_id=?')
  .bind(profileId).all();
 return Object.fromEntries((a.results||[]).filter(x=>['title','frame','vfx'].includes(x.slot)).map(x=>[x.slot,x.reward_id]));
}
async function unlockedOnWin(db,profileId){
 const r=await db.prepare("SELECT COUNT(*) AS n FROM stackbreaker_daily_attempts_v1 WHERE profile_id=? AND result='won' AND finished_at IS NOT NULL")
  .bind(profileId).first();
 const count=Number(r?.n)||0;
 for(const [id,award] of Object.entries(awardMap)){
  if(count>=award.threshold)
   await db.prepare('INSERT OR IGNORE INTO stackbreaker_verified_awards_v1(profile_id,achievement_id) VALUES(?,?)')
    .bind(profileId,id).run();
 }
}
export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 if(url.searchParams.get('view')==='leaderboard'){
  // Anonymous read-only display of VERIFIED server-replayed wins, never Lab saves.
  if(!await ready(env))return send({ok:true,enabled:false,day:utcDay(),entries:[],method:'SERVER_REPLAY_ONLY'});
  try{
   const day=utcDay(),entry=currentDaily();
   if(!entry)return send({ok:true,enabled:false,day,entries:[],method:'SERVER_REPLAY_ONLY'});
   const result=await env.DB.prepare(`SELECT p.handle AS handle,a.accepted_moves AS acceptedMoves,
    a.finished_at AS finishedAt
    FROM stackbreaker_daily_attempts_v1 a
    JOIN community_profiles p ON p.id=a.profile_id
    WHERE a.utc_date=? AND a.result='won' AND a.rules_version=?
     AND a.puzzle_id=? AND a.source_sha=? AND a.finished_at IS NOT NULL
    ORDER BY a.accepted_moves ASC,a.finished_at ASC,p.handle COLLATE NOCASE ASC LIMIT 25`)
    .bind(day,STACKBREAKER_SERVER_RULES,entry.puzzleId,LAB_SOURCE_SHA).all();
   return send({ok:true,enabled:true,day,entries:(result.results||[]).map((row,i)=>({
    rank:i+1,handle:String(row.handle||'').slice(0,24),
    acceptedMoves:Math.max(0,Number(row.acceptedMoves)||0)
   })),method:'SERVER_REPLAY_ONLY'});
  }catch{return fail('Verified leaderboard temporarily unavailable.',503)}
 }
 const gate=await session(request,env);if(gate.error)return gate.error;
 try{
  const day=utcDay(),entry=currentDaily(),id=gate.user.id;
  const row=await activeRow(env.DB,id,day);
  const scenario=entry?boundScenario(entry):null;
  if(entry&&!scenario)return fail('Pinned scenario unavailable.',503);
  if(row&&(row.puzzle_id!==entry?.puzzleId||row.rules_version!==STACKBREAKER_SERVER_RULES||
    row.source_sha!==LAB_SOURCE_SHA||(scenario&&row.scenario_digest!==await digestScenario(scenario))))
    return fail('The stored attempt is pinned to another version.',409);
  let verifiedState=null;
  if(row){
    const actions=safeJSON(row.moves_json);
    if(!Array.isArray(actions)||actions.length!==row.accepted_moves)return fail('Corrupt saved replay.',503);
    verifiedState=replayServerMoves(scenario,actions).state;
    if((row.result==='started')!==(verifiedState.status==='playing')||
       (row.result!=='started'&&row.result!==verifiedState.status))
      return fail('Stored result disagrees with server replay.',503);
  }
  const awards=await verifiedAwards(env.DB,id);
  return send({ok:true,day,eligible:!!entry,entry:entry?{
   puzzleId:entry.puzzleId,revision:entry.puzzleRevision,rulesVersion:entry.rulesVersion}:null,
   attempt:gameStatus(row),state:verifiedState,scenario:scenario||null,awards,equipped:await equipment(env.DB,id),
   verification:'SERVER_REPLAY_VERIFIED',sourceSha:LAB_SOURCE_SHA});
 }catch{return fail('Stackbreaker records temporarily unavailable.',503)}
}
export async function onRequestPost({request,env}){
 if(!request.headers.get('Origin')||!originOK(request))return fail('Origin not allowed.',403);
 const gate=await session(request,env);if(gate.error)return gate.error;
 let data;try{data=await body(request)}catch{return fail('Invalid request.',400)}
 if(!data||typeof data!=='object'||Array.isArray(data))return fail('Invalid request.',400);
 const action=String(data.action||''),id=gate.user.id,day=utcDay(),entry=currentDaily();
 if(!['start','move','equip'].includes(action))return fail('Unsupported action.',400);
 try{
  const limit=action==='move'?240:action==='equip'?35:8;
  if(!await quota(env.DB,env,request,'sb-'+action,limit,gate.user))return fail('Rate limit or verification unavailable.',429);
  if(action==='equip'){
   const slot=String(data.slot||''),reward=String(data.rewardId||'');
   if(!['title','frame','vfx'].includes(slot))return fail('Unsupported cosmetic slot.',400);
   if(reward==='default'){
    await env.DB.prepare('DELETE FROM stackbreaker_equipped_v1 WHERE profile_id=? AND slot=?').bind(id,slot).run();
   }else{
    const allowed=Object.entries(awardMap).find(([key,v])=>v.slot===slot&&v.reward===reward);
    if(!allowed)return fail('Unknown reward.',400);
    const owned=await env.DB.prepare('SELECT 1 AS owned FROM stackbreaker_verified_awards_v1 WHERE profile_id=? AND achievement_id=?')
     .bind(id,allowed[0]).first();
    if(!owned)return fail('This cosmetic has not been verified for this profile.',403);
    await env.DB.prepare('INSERT INTO stackbreaker_equipped_v1(profile_id,slot,reward_id) VALUES(?,?,?) ON CONFLICT(profile_id,slot) DO UPDATE SET reward_id=excluded.reward_id,equipped_at=unixepoch()')
     .bind(id,slot,reward).run();
   }
   return send({ok:true,equipped:await equipment(env.DB,id)});
  }
  if(!entry)return fail('Today’s Stackbreaker puzzle is practice-only until editorial approval.',423);
  const scenario=boundScenario(entry);if(!scenario)return fail('Pinned puzzle unavailable.',503);
  const digest=await digestScenario(scenario);
  if(action==='start'){
   await env.DB.prepare(`INSERT OR IGNORE INTO stackbreaker_daily_attempts_v1
    (profile_id,utc_date,puzzle_id,puzzle_revision,rules_version,scenario_digest,source_sha)
    VALUES(?,?,?,?,?,?,?)`).bind(id,day,entry.puzzleId,entry.puzzleRevision,
      STACKBREAKER_SERVER_RULES,digest,LAB_SOURCE_SHA).run();
   const row=await activeRow(env.DB,id,day);
   return send({ok:true,attempt:gameStatus(row),scenario,state:replayServerMoves(scenario,
    safeJSON(row.moves_json)||[]).state,accepted:row?.result==='started',
    startLocked:row?.result!=='started'},row?.result==='started'?200:409);
  }
  const row=await activeRow(env.DB,id,day);
  if(!row)return fail('Start the qualifying attempt first.',409);
  if(row.result!=='started')return fail('Today’s qualifying attempt has already finished.',409);
  if(row.source_sha!==LAB_SOURCE_SHA||row.rules_version!==STACKBREAKER_SERVER_RULES||
   row.puzzle_id!==entry.puzzleId||row.scenario_digest!==digest)
   return fail('Pinned replay version mismatch. Do not overwrite existing attempt.',409);
  if(!Number.isInteger(data.seq)||data.seq!==row.accepted_moves||
     row.accepted_moves>=MAX_ACCEPTED_MOVES)return fail('Out-of-order or exhausted attempt.',409);
  const prior=safeJSON(row.moves_json);if(!Array.isArray(prior))return fail('Stored replay corrupt.',503);
  const moves=[...prior,data.move];
  let result;try{result=replayServerMoves(scenario,moves)}
  catch{return fail('Illegal move.',422)}
  const completed=result.state.status!=='playing';
  const update=await env.DB.prepare(`UPDATE stackbreaker_daily_attempts_v1
   SET moves_json=?,accepted_moves=?,result=?,finished_at=CASE WHEN ? THEN unixepoch() ELSE NULL END
   WHERE profile_id=? AND utc_date=? AND accepted_moves=? AND result='started'`)
   .bind(JSON.stringify(moves),moves.length,completed?result.state.status:'started',
    completed?1:0,id,day,data.seq).run();
  if((update.meta?.changes||0)!==1)return fail('Concurrent move: refresh your attempt.',409);
  if(result.state.status==='won')await unlockedOnWin(env.DB,id);
  return send({ok:true,state:result.state,attempt:{day,status:result.state.status,moves:moves.length,
    completed:result.state.status==='won'},score:result.score,
    awards:result.state.status==='won'?await verifiedAwards(env.DB,id):[]});
 }catch{return fail('Stackbreaker verification unavailable.',503)}
}
