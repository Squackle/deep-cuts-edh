import {reply,random,sha,json} from "../../src/member-auth.js";
import {ownerAuth} from "../../src/owner-access.js";

const bad=(m,status=400)=>reply({error:m},status);
const now=()=>Math.floor(Date.now()/1000);
const uuid=s=>/^[a-f0-9]{32}$/.test(String(s||""));
const trim=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
function tierOK(t){return ["informant","detective","chief"].includes(t)}
function daysOK(n){return Number.isInteger(n)&&n>=1&&n<=365}
function pageValue(req){return Math.max(0,Math.min(200,Number.parseInt(new URL(req.url).searchParams.get("page")||"0",10)||0))}
export async function onRequestGet({request,env}){
 let owner;try{owner=await ownerAuth(request,env)}catch{return bad("Owner service unavailable.",503)}
 if(owner.error)return owner.error;
 const q=new URL(request.url).searchParams,view=q.get("view")||"overview",offset=pageValue(request)*50;
 try{
  if(view==="overview"){
   const stats=await env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM community_profiles) AS community_profiles,
    (SELECT COUNT(*) FROM community_profile_emails) AS verified_recovery_emails,
    (SELECT COUNT(*) FROM community_decks) AS public_decks,
    (SELECT COUNT(*) FROM member_accounts) AS membership_records,
    (SELECT COUNT(*) FROM member_complimentary_grants WHERE revoked_at IS NULL AND expires_at>unixepoch()) AS active_complimentary,
    (SELECT COUNT(*) FROM member_kofi_links) AS kofi_linked,
    (SELECT COUNT(*) FROM member_devices WHERE revoked_at IS NULL) AS activated_devices`).first();
   return reply({stats,asOf:now(),notice:"Profile keys, subscriber emails, and payment secrets are never exposed here."});
  }
  if(view==="profiles"){
   const r=await env.DB.prepare(`SELECT p.id,p.handle,p.avatar,p.created_at,
     CASE WHEN e.profile_id IS NOT NULL THEN 1 ELSE 0 END recovery_verified,
     (SELECT COUNT(*) FROM community_decks d WHERE d.owner_id=p.id) AS decks,
     (SELECT COUNT(*) FROM community_comments c WHERE c.author_id=p.id AND c.status='visible') AS comments,
     (SELECT COUNT(*) FROM community_playtests t WHERE t.author_id=p.id) AS playtests
     FROM community_profiles p LEFT JOIN community_profile_emails e ON e.profile_id=p.id
     ORDER BY p.created_at DESC,p.id DESC LIMIT 50 OFFSET ?`).bind(offset).all();
   return reply({profiles:r.results||[],page:offset/50,limit:50});
  }
  if(view==="members"){
   const r=await env.DB.prepare(`SELECT a.id,a.tier,a.status,a.created_at,
     g.label AS grant_label,g.tier AS grant_tier,g.expires_at AS grant_expires,g.revoked_at AS grant_revoked,
     l.member_id AS kofi_linked,l.revoked_at AS kofi_revoked,k.paid_until AS paid_until,
     (SELECT COUNT(*) FROM member_devices d WHERE d.member_id=a.id AND d.revoked_at IS NULL) AS devices,
     (SELECT MAX(d.last_seen_at) FROM member_devices d WHERE d.member_id=a.id) AS last_seen
     FROM member_accounts a
     LEFT JOIN member_complimentary_grants g ON g.member_id=a.id
     LEFT JOIN member_kofi_links l ON l.member_id=a.id
     LEFT JOIN kofi_renewals k ON k.email_hash=l.email_hash
     ORDER BY a.created_at DESC,a.id DESC LIMIT 50 OFFSET ?`).bind(offset).all();
   const rows=(r.results||[]).map(m=>{
    const source=m.grant_label!=null?"complimentary":m.kofi_linked?"kofi":"legacy";
    const expiry=source==="complimentary"?m.grant_expires:source==="kofi"?m.paid_until:null;
    const active=m.status==="active"&&source==="complimentary"?m.grant_revoked==null&&Number(expiry)>now():
     m.status==="active"&&source==="kofi"?env.KOFI_MEMBER_ACCESS_READY==="true"&&m.kofi_revoked==null&&Number(expiry)>now():false;
    return {id:m.id,tier:source==="complimentary"?m.grant_tier:m.tier,
      source,label:source==="complimentary"?m.grant_label:"Ko-fi / private",
      expiresAt:expiry,active,createdAt:m.created_at,devices:m.devices,lastSeen:m.last_seen||0};
   });
   return reply({members:rows,page:offset/50,limit:50});
  }
  if(view==="audit"){
   const r=await env.DB.prepare("SELECT id,member_id,action,tier,event_time,detail FROM member_grant_audit ORDER BY event_time DESC,id DESC LIMIT 80").all();
   return reply({events:r.results||[]});
  }
  return bad("Unknown dashboard view.",404);
 }catch(e){console.error("Owner member-list database error");return bad("Owner data unavailable.",503)}
}
export async function onRequestPost({request,env}){
 let owner;try{owner=await ownerAuth(request,env)}catch{return bad("Owner service unavailable.",503)}
 if(owner.error)return owner.error;
 let data;try{data=await json(request,2500)}catch{return bad("Invalid request.",400)}
 const action=data?.action,id=trim(data?.memberId,32);
 const stamp=now();
 try{
  if(action==="grant"){
   const tier=data?.tier,label=trim(data?.label,72),days=Number(data?.days);
   if(!tierOK(tier)||!daysOK(days)||label.length<2||/\S+@\S+\.\S+/.test(label)||!/^[\p{L}\p{N} _.,+#@'-]{2,72}$/u.test(label))
    return bad("Enter a label (2–72 characters), tier and 1–365 days.");
   // Only a small number of new bearer credentials can be minted each day.
   const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM member_grant_audit WHERE action='issued' AND event_time>=?").bind(stamp-86400).first();
   if(Number(count?.n||0)>=20)return bad("Daily complimentary issuance limit reached.",429);
   const memberId=random(16),key="dcmember1_"+memberId+"_"+random(32),expires=stamp+days*86400,secret=await sha(key);
   await env.DB.batch([
    env.DB.prepare("INSERT INTO member_accounts(id,stripe_customer,stripe_subscription,checkout_session,tier,key_hash,status,checked_at) VALUES(?,?,?,?,?,?,?,?)").bind(memberId,"grant:"+memberId,"grant:"+memberId,"grant:"+memberId,tier,secret,"active",stamp),
    env.DB.prepare("INSERT INTO member_complimentary_grants(member_id,tier,label,expires_at) VALUES(?,?,?,?)").bind(memberId,tier,label,expires),
    env.DB.prepare("INSERT INTO member_grant_audit(id,member_id,action,tier,event_time,detail) VALUES(?,?,?,?,?,?)").bind(random(16),memberId,"issued",tier,stamp,days+" days")
   ]);
   return reply({ok:true,memberId,key,tier,label,expiresAt:expires,oneTime:true},201);
  }
  if(!uuid(id))return bad("Select a valid complimentary membership.");
  const grant=await env.DB.prepare("SELECT tier,expires_at,revoked_at,label FROM member_complimentary_grants WHERE member_id=?").bind(id).first();
  if(!grant)return bad("Complimentary membership not found.",404);
  if(action==="revoke"){
   if(grant.revoked_at!=null)return bad("This complimentary key has already been revoked.",409);
   await env.DB.batch([
    env.DB.prepare("UPDATE member_complimentary_grants SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL").bind(stamp,id),
    env.DB.prepare("UPDATE member_devices SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL").bind(stamp,id),
    env.DB.prepare("INSERT INTO member_grant_audit(id,member_id,action,tier,event_time,detail) VALUES(?,?,?,?,?,?)").bind(random(16),id,"revoked",grant.tier,stamp,"Owner revoked access")
   ]);
   return reply({ok:true,status:"revoked",memberId:id});
  }
  if(grant.revoked_at!=null)return bad("Revoked grants cannot be changed. Issue a fresh one.",409);
  if(action==="extend"){
   const days=Number(data.days);
   if(!daysOK(days))return bad("Enter 1–365 days.");
   const expires=stamp+days*86400;
   await env.DB.batch([
    env.DB.prepare("UPDATE member_complimentary_grants SET expires_at=? WHERE member_id=? AND revoked_at IS NULL").bind(expires,id),
    env.DB.prepare("INSERT INTO member_grant_audit(id,member_id,action,tier,event_time,detail) VALUES(?,?,?,?,?,?)").bind(random(16),id,"extended",grant.tier,stamp,days+" days from now")
   ]);
   return reply({ok:true,expiresAt:expires,memberId:id});
  }
  if(action==="rotate"){
   const key="dcmember1_"+id+"_"+random(32);
   await env.DB.batch([
    env.DB.prepare("UPDATE member_accounts SET key_hash=?,checked_at=? WHERE id=?").bind(await sha(key),stamp,id),
    env.DB.prepare("UPDATE member_devices SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL").bind(stamp,id),
    env.DB.prepare("INSERT INTO member_grant_audit(id,member_id,action,tier,event_time,detail) VALUES(?,?,?,?,?,?)").bind(random(16),id,"rotated",grant.tier,stamp,"Revoked all device sessions")
   ]);
   return reply({ok:true,memberId:id,key,tier:grant.tier,expiresAt:grant.expires_at,oneTime:true});
  }
  return bad("Unknown owner action.",404);
 }catch(e){console.error("Owner grant operation failed");return bad("Owner operation was not completed.",503)}
}
