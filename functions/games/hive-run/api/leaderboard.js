import {onRequestGet as get,onRequestPost as post} from "../../../../src/hive-server/leaderboard.js";
import {auth} from "../../../../src/community-core.js";
async function context(ctx){
 const hiveProfile=ctx.env.DB?await auth(ctx.request,ctx.env.DB):null;
 return {...ctx,data:{...ctx.data,hiveProfile,resolveProfiles:async entries=>{
  const ids=[...new Set(entries.filter(e=>e.profileVerified&&e.profileId).map(e=>e.profileId))];
  if(!ids.length)return;
  const rows=await ctx.env.DB.prepare("SELECT id,handle FROM community_profiles WHERE id IN ("+ids.map(()=>"?").join(",")+")").bind(...ids).all();
  const handles=new Map(rows.results.map(p=>[p.id,p.handle]));
  for(const entry of entries)if(entry.profileVerified){entry.profileHandle=handles.get(entry.profileId)||null;if(!entry.profileHandle){entry.profileVerified=0;entry.alias="Former investigator"}}
 }}};
}
export async function onRequestGet(ctx){return get(await context(ctx))}
export async function onRequestPost(ctx){return post(await context(ctx))}
