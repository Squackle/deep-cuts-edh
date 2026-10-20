import {send,fail} from '../../src/community-core.js';
import {utcDay,currentDaily} from '../../src/stackbreaker-verify/server-replay.js';
// No local client claim is accepted. Only completed, website-verified D1 attempts.
export async function onRequestGet({env}){
 if(!env.DB)return fail('Leaderboard unavailable.',503);
 try{
  const launch=await env.DB.prepare("SELECT enabled FROM stackbreaker_launch_v1 WHERE feature='verified-daily'").first();
  if(Number(launch?.enabled)!==1)return send({ok:true,day:utcDay(),entries:[],active:false});
  const day=utcDay(),daily=currentDaily();
  if(!daily)return send({ok:true,day,entries:[],active:false});
  const rows=await env.DB.prepare(`
   SELECT p.handle AS handle,a.accepted_moves AS moves,
    a.finished_at AS finishedAt
   FROM stackbreaker_daily_attempts_v1 a
   JOIN community_profiles p ON p.id=a.profile_id
   WHERE a.utc_date=? AND a.puzzle_id=? AND a.puzzle_revision=?
    AND a.rules_version=? AND a.result='won' AND a.finished_at IS NOT NULL
   ORDER BY a.accepted_moves ASC,a.finished_at ASC,p.handle COLLATE NOCASE ASC
   LIMIT 100`).bind(day,daily.puzzleId,daily.puzzleRevision,daily.rulesVersion).all();
  return send({ok:true,day,active:true,entries:(rows.results||[]).map(x=>({
   handle:x.handle,moves:x.moves,finishedAt:new Date(Number(x.finishedAt)*1000).toISOString().slice(11,19)
  }))});
 }catch{return fail('Leaderboard unavailable.',503)}
}
