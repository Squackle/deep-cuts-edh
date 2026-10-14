/** Public rankings belong only to live, authenticated Field Network profiles. */
import {send,fail} from '../../src/community-core.js';
export async function onRequestGet({request,env}){
 const handle=new URL(request.url).searchParams.get('handle')||'';
 if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle))return fail('Invalid profile handle.');
 if(!env.DB||!env.HIVE_DB)return fail('Game records unavailable.',503);
 const profile=await env.DB.prepare('SELECT id,handle FROM community_profiles WHERE handle=? COLLATE NOCASE').bind(handle).first();
 if(!profile)return fail('Profile not found.',404);
 try{
  const rows=await env.HIVE_DB.prepare('SELECT mode,MAX(score) AS bestScore,MAX(evolutions) AS bestEvolution,COUNT(*) AS rankedRuns FROM hive_scores_v1 WHERE profile_id=? AND profile_verified=1 AND rules_version=? GROUP BY mode').bind(profile.id,'hive-1.0.0').all();
  return send({handle:profile.handle,records:rows.results||[]});
 }catch{return fail('Game records unavailable.',503)}
}
