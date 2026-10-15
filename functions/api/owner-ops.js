// Owner Command Center 2.0: bounded real-D1 operational views, audited writes.
// Cloudflare Access ALSO protects this path; ownerAuth remains mandatory.
import {ownerAuth} from "../../src/owner-access.js";
import {reply,random} from "../../src/member-auth.js";

const error=(message,status=400)=>reply({error:message},status);
const query=async(db,sql,...params)=>(await db.prepare(sql).bind(...params).all()).results||[];
const first=async(db,sql,...params)=>await db.prepare(sql).bind(...params).first();
const select={
 overview:async(db)=>({stats:await first(db,`SELECT
    (SELECT COUNT(*) FROM nominations WHERE status='pending') AS nominations,
    (SELECT COUNT(*) FROM community_reports WHERE status='pending') AS reports,
    (SELECT COUNT(*) FROM site_feedback WHERE status='new') AS feedback,
    (SELECT COUNT(*) FROM owner_editorial_queue WHERE stage!='published') AS drafts,
    (SELECT COUNT(*) FROM member_complimentary_grants WHERE revoked_at IS NULL AND expires_at>unixepoch()) AS active_grants`)}),
 nominations:async(db)=>({
  pending:await query(db,`SELECT n.id,n.name,n.rationale,n.strategy,n.cards,n.budget,n.created_at,n.status,
      (SELECT COUNT(*) FROM nomination_votes v WHERE v.nomination_id=n.id) AS votes
      FROM nominations n WHERE n.status='pending' ORDER BY n.created_at ASC,n.id ASC LIMIT 100`),
  reviewed:await query(db,`SELECT n.id,n.name,n.status,n.created_at,
      (SELECT COUNT(*) FROM nomination_votes v WHERE v.nomination_id=n.id) AS votes
      FROM nominations n WHERE n.status IN ('approved','rejected','featured','retired')
      ORDER BY n.created_at DESC,n.id DESC LIMIT 100`),
  counts:await query(db,`SELECT status,COUNT(*) AS nominations FROM nominations GROUP BY status ORDER BY status`),
  note:"Community nominations submitted through the public nomination form. Approving makes a candidate appear on the public nominations board without changing existing votes."
 }),
 moderation:async(db)=>({
  nominations:await query(db,`SELECT n.id,n.name,n.rationale,n.strategy,n.budget,n.created_at,n.status,
       (SELECT COUNT(*) FROM nomination_votes v WHERE v.nomination_id=n.id) AS votes
       FROM nominations n WHERE n.status='pending' ORDER BY n.created_at ASC LIMIT 30`),
  reports:await query(db,`SELECT r.id,r.reason,r.status,r.created_at,c.topic,c.body AS comment_body,
        c.status AS comment_status,p.handle AS author
        FROM community_reports r LEFT JOIN community_comments c ON c.id=r.comment_id
        LEFT JOIN community_profiles p ON p.id=c.author_id
        WHERE r.status='pending' ORDER BY r.created_at ASC LIMIT 30`),
  evidence:await query(db,`SELECT id,title,case_slug,status,created_at FROM field_evidence ORDER BY created_at DESC LIMIT 15`)
 }),
 feedback:async(db)=>({feedback:await query(db,`SELECT id,category,message,page,status,created_at
          FROM site_feedback ORDER BY CASE WHEN status='new' THEN 0 ELSE 1 END, id DESC LIMIT 60`)}),
 publishing:async(db)=>({
  drafts:await query(db,`SELECT id,commander,title,stage,notes,updated_at FROM owner_editorial_queue ORDER BY updated_at DESC LIMIT 70`),
  candidates:await query(db,`SELECT name,status,created_at FROM nominations WHERE status IN ('approved','featured') ORDER BY created_at DESC LIMIT 30`)
 }),
 games:async(db,env)=>({
  daily:await query(db,`SELECT game,COUNT(*) AS plays,SUM(CASE WHEN won=1 THEN 1 ELSE 0 END) AS wins,
       ROUND(AVG(score),1) AS average_score FROM daily_game_runs WHERE day>=date('now','-30 days') GROUP BY game`),
  arcane:await query(db,`SELECT game,COUNT(*) AS plays,SUM(CASE WHEN won=1 THEN 1 ELSE 0 END) AS wins,
       ROUND(AVG(score),1) AS average_score FROM daily_arcane_runs WHERE day>=date('now','-30 days') GROUP BY game`),
  hive:env.HIVE_DB?await query(env.HIVE_DB,`SELECT mode,rules_version,COUNT(*) AS runs,
       ROUND(AVG(score),1) AS average_score,MAX(score) AS best_score,ROUND(AVG(evolutions),2) AS average_evolutions
       FROM hive_scores_v1 GROUP BY mode,rules_version ORDER BY runs DESC LIMIT 20`):[],
  note:"Recorded server-verified sessions only. This does not measure anonymous browser plays, boss defeats, or why invalid runs failed."
 }),
 integrity:async(db,env)=>({
  sessions:env.HIVE_DB?await query(env.HIVE_DB,`SELECT mode,rules_version,
    COUNT(*) AS issued,SUM(CASE WHEN used_at IS NOT NULL THEN 1 ELSE 0 END) AS completed
    FROM hive_sessions_v1 GROUP BY mode,rules_version ORDER BY issued DESC LIMIT 20`):[],
  scores:env.HIVE_DB?await query(env.HIVE_DB,`SELECT mode,rules_version,COUNT(*) AS verified
    FROM hive_scores_v1 GROUP BY mode,rules_version ORDER BY verified DESC LIMIT 20`):[],
  note:"Replay rejection reasons are not stored in this report. Do not interpret incomplete sessions as fraud."
 }),
 schedule:async(db)=>({
  cold:await query(db,`SELECT game,MAX(day) AS latest_day,COUNT(*) AS cached_days FROM game_auto_puzzles GROUP BY game`),
  arcane:await query(db,`SELECT game,MAX(day) AS latest_day,COUNT(*) AS cached_days FROM daily_arcane_puzzles GROUP BY game`),
  challenge:await query(db,`SELECT title,commander,opens_at,closes_at,status FROM community_challenges ORDER BY opens_at DESC LIMIT 5`)
 }),
 site:async(db)=>({
  records:await first(db,`SELECT
    (SELECT COUNT(*) FROM community_profiles) AS profiles,
    (SELECT COUNT(*) FROM community_decks) AS decks,
    (SELECT COUNT(*) FROM community_comments) AS comments,
    (SELECT COUNT(*) FROM field_evidence) AS evidence,
    (SELECT COUNT(*) FROM member_accounts) AS memberships,
    (SELECT COUNT(*) FROM nominations) AS nominations,
    (SELECT COUNT(*) FROM site_feedback) AS feedback`),
  webhook:await query(db,`SELECT event_type,classification,received_at FROM kofi_webhook_audit ORDER BY id DESC LIMIT 8`),
  audit:await query(db,`SELECT category,action,target,occurred_at FROM owner_action_audit ORDER BY occurred_at DESC LIMIT 20`)
 }),
 revenue:async(db)=>({
  summary:await first(db,`SELECT
     (SELECT COUNT(*) FROM kofi_renewals WHERE paid_until>unixepoch()) AS active_renewals,
     (SELECT COUNT(*) FROM kofi_payment_events WHERE received_at>=unixepoch()-2592000) AS payment_events_30d,
     (SELECT COALESCE(SUM(amount_cents),0) FROM kofi_payment_events WHERE received_at>=unixepoch()-2592000) AS recorded_cents_30d,
     (SELECT COUNT(*) FROM kofi_adfree_manual) AS manual_adfree,
     (SELECT COUNT(*) FROM member_complimentary_grants WHERE revoked_at IS NULL AND expires_at>unixepoch()) AS free_grants`),
  note:"Only webhook-recorded Ko-fi events; not a complete bank reconciliation or AdSense earnings statement."
 }),
 analytics:async(db)=>({
  content:await query(db,`SELECT case_slug,COUNT(*) AS research_items,
   SUM(CASE WHEN status='featured' THEN 1 ELSE 0 END) AS featured
   FROM field_evidence GROUP BY case_slug ORDER BY research_items DESC LIMIT 20`),
  activity:await first(db,`SELECT
     (SELECT COUNT(*) FROM community_profiles WHERE created_at>=datetime('now','-30 days')) AS new_profiles_30d,
     (SELECT COUNT(*) FROM community_comments WHERE created_at>=datetime('now','-30 days')) AS comments_30d,
     (SELECT COUNT(*) FROM community_playtests WHERE created_at>=datetime('now','-30 days')) AS playtests_30d`),
  note:"Community database activity, not web traffic or unique visitor statistics."
 }),
 features:async(db)=>({flags:await query(db,`SELECT flag,enabled,updated_at FROM owner_feature_flags ORDER BY flag`)}),
 recovery:async(db)=>({
  tables:await query(db,`SELECT name FROM sqlite_master WHERE type='table' AND name IN
    ('owner_editorial_queue','owner_action_audit','owner_feature_flags','member_accounts','community_profiles','nominations') ORDER BY name`),
  latest:await query(db,`SELECT category,action,target,occurred_at FROM owner_action_audit ORDER BY occurred_at DESC LIMIT 12`),
  note:"Backups and restores must be run in Cloudflare D1 with proper privilege and a verified recovery plan. No restore action is exposed here."
 })
};
const valid=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const statuses={feedback:["new","reviewed","resolved"],report:["pending","resolved","dismissed"],nomination:["pending","approved","rejected"],editorial:["research","draft","review","ready","published"]};
const responseHeaders={"Cache-Control":"no-store, private","X-Robots-Tag":"noindex"};
async function authorized(request,env){
 try{return await ownerAuth(request,env)}catch{return {error:error("Owner service unavailable.",503)}}
}
export async function onRequestGet({request,env}){
 const owner=await authorized(request,env);if(owner.error)return owner.error;
 const view=new URL(request.url).searchParams.get("view")||"overview";
 if(!Object.hasOwn(select,view))return error("Unknown admin view.",404);
 try{return reply({ok:true,view,...await select[view](env.DB,env)})}
 catch(e){console.error("Owner V2 read failed",view);return error("The requested admin data is unavailable. Check the database migration and retry.",503)}
}
export async function onRequestPost({request,env}){
 const owner=await authorized(request,env);if(owner.error)return owner.error;
 if(Number(request.headers.get("content-length")||0)>5000)return error("Request too large.",413);
 let data;try{data=await request.json()}catch{return error("Invalid JSON request.")};
 if(!data||JSON.stringify(data).length>5000)return error("Request too large.",413);
 const kind=valid(data.kind,30),action=valid(data.action,30);
 const id=valid(data.id,110),auditId=random(16);
 const log=(category,act,target)=>env.DB.prepare("INSERT INTO owner_action_audit(id,category,action,target) VALUES(?,?,?,?)").bind(auditId,category,act,String(target).slice(0,120));
 try{
  if(kind==="nomination"){
   if(!statuses.nomination.includes(action)||action==="pending"||!/^[0-9]{1,10}$/.test(id))return error("Invalid nomination action.");
   const current=await first(env.DB,"SELECT status,name FROM nominations WHERE id=?",Number(id));
   if(!current||current.status!=="pending")return error("Nomination has already been reviewed. Reload the queue.",409);
   await env.DB.batch([env.DB.prepare("UPDATE nominations SET status=? WHERE id=? AND status='pending'").bind(action,Number(id)),log("nomination",action,id)]);
  }else if(kind==="report"){
   if(!["resolved","dismissed"].includes(action)||!/^[a-f0-9]{32}$/.test(id))return error("Invalid report.");
   const current=await first(env.DB,"SELECT status FROM community_reports WHERE id=?",id);
   if(!current||current.status!=="pending")return error("Report has already been handled. Reload.",409);
   await env.DB.batch([env.DB.prepare("UPDATE community_reports SET status=? WHERE id=? AND status='pending'").bind(action,id),log("report",action,id)]);
  }else if(kind==="feedback"){
   if(!statuses.feedback.includes(action)||!/^[0-9]{1,10}$/.test(id))return error("Invalid feedback.");
   const current=await first(env.DB,"SELECT id FROM site_feedback WHERE id=?",Number(id));
   if(!current)return error("Feedback not found.",404);
   await env.DB.batch([env.DB.prepare("UPDATE site_feedback SET status=? WHERE id=?").bind(action,Number(id)),log("feedback",action,id)]);
  }else if(kind==="editorial"){
   if(!statuses.editorial.includes(action))return error("Invalid editorial stage.");
   const commander=valid(data.commander,100),title=valid(data.title,160),notes=valid(data.notes,1200);
   if(commander.length<2||title.length<2)return error("Enter a commander and a title.");
   const safeId=/^[a-f0-9]{32}$/.test(id)?id:random(16);
   await env.DB.batch([
    env.DB.prepare(`INSERT INTO owner_editorial_queue(id,commander,title,stage,notes)
      VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET commander=excluded.commander,
      title=excluded.title,stage=excluded.stage,notes=excluded.notes,updated_at=unixepoch()`).bind(safeId,commander,title,action,notes),
    log("editorial",action,safeId)
   ]);
   return reply({ok:true,id:safeId,message:"Editorial workflow saved. Publishing remains a separate reviewed site release."});
  }else if(kind==="feature"){
   if(!["public_nominations","public_feedback"].includes(id)||typeof data.enabled!=="boolean")return error("Invalid feature switch.");
   await env.DB.batch([
    env.DB.prepare("UPDATE owner_feature_flags SET enabled=?,updated_at=unixepoch() WHERE flag=?").bind(data.enabled?1:0,id),
    log("feature",data.enabled?"enabled":"paused",id)
   ]);
   return reply({ok:true,message:(data.enabled?"Resumed ":"Paused ")+id.replaceAll("_"," ")+". Existing content remains available."});
  }else return error("Unsupported admin operation.",404);
  return reply({ok:true,message:"Saved. The action has been recorded in the owner audit log."});
 }catch(e){console.error("Owner V2 action failed",kind);return error("Admin action could not be completed. Check the activity log before retrying.",503)}
}