import {send,fail,auth,originOK,body,quota,rnd,hash,verifyHuman} from "../../src/community-core.js";
import {normalizeEmail,emailReady,emailHash,encryptEmail,decryptEmail,hideEmail,newCode,codeHash,verifyHash,deliverCode} from "../../src/profile-email.js";
const generic={ok:true,message:"If this address is verified on a profile, a recovery code has been sent. Check your inbox and spam folder."};
const timestamp=()=>Math.floor(Date.now()/1000);
const validId=id=>/^[a-f0-9]{32}$/.test(String(id||""));
const validCode=code=>/^\d{8}$/.test(String(code||""));
function configured(env){return emailReady(env)}
async function targetQuota(db,hashId,name,max){
 const date=new Date().toISOString().slice(0,10);
 return Boolean(await db.prepare("INSERT INTO community_limits(subject,date_key,action,attempts) VALUES(?,?,?,1) ON CONFLICT(subject,date_key,action) DO UPDATE SET attempts=attempts+1 WHERE attempts<? RETURNING attempts").bind(hashId,date,name,max).first());
}
export async function onRequestGet({request,env}){
 if(!env.DB)return fail("Recovery data unavailable.",503);
 const a=await auth(request,env.DB);
 if(!a)return fail("Sign in to view recovery settings.",401);
 const row=await env.DB.prepare("SELECT email_cipher,verified_at FROM community_profile_emails WHERE profile_id=?").bind(a.id).first();
 const pending=await env.DB.prepare("SELECT email_mask FROM community_pending_recovery_contacts WHERE profile_id=?").bind(a.id).first();
 const verified=!!row&&Number(row.verified_at)>0;
 let masked=null;
 if(verified&&env.KOFI_EMAIL_HASH_SECRET){try{masked=hideEmail(await decryptEmail(row.email_cipher,env))}catch{masked="Verified address (unavailable for display)"}}
 return send({verified,maskedEmail:masked,pending:!!pending&&!verified,pendingMaskedEmail:pending?.email_mask||null,emailSendingReady:configured(env),
  notice:verified?"Recovery email verified.":pending?"Address staged, but NOT active for key recovery. Sign in and complete email verification when sending is available.":"No recovery email connected."});
}
export async function onRequestPost({request,env}){
 if(!env.DB||!env.TURNSTILE_SECRET)return fail("Profile recovery service unavailable.",503);
 if(!originOK(request))return fail("Origin rejected.",403);
 let d;try{d=await body(request)}catch{return fail("Invalid request.",400)}
 const action=d?.action,now=timestamp();
 if(action==="start_verify"){
  const a=await auth(request,env.DB);if(!a)return fail("Sign in before linking an email.",401);
  if(!configured(env))return fail("Email delivery has not been configured by the site owner.",503);
  const email=normalizeEmail(d.email);if(!email)return fail("Enter a valid email address.",400);
  if(!await quota(env.DB,env,request,"verify-email",5,a))return fail("Daily verification limit reached.",429);
  const digest=await emailHash(email,env);
  if(!await targetQuota(env.DB,digest,"verify-target",6))return fail("Too many verification emails for this address today.",429);
  const already=await env.DB.prepare("SELECT profile_id FROM community_profile_emails WHERE email_hash=?").bind(digest).first();
  if(already&&already.profile_id!==a.id)return fail("This address cannot be linked. Choose another.",409);
  const recent=await env.DB.prepare("SELECT 1 FROM community_email_challenges WHERE profile_id=? AND purpose='verify' AND created_at>? LIMIT 1").bind(a.id,now-60).first();
  if(recent)return fail("Try again after one minute.",429);
  await env.DB.prepare("DELETE FROM community_email_challenges WHERE expires_at<?").bind(now-86400).run();
  const id=rnd(),code=newCode();
  await env.DB.prepare("INSERT INTO community_email_challenges(id,profile_id,purpose,email_hash,email_cipher,code_hash,expires_at) VALUES(?,?,?,?,?,?,?)").bind(id,a.id,"verify",digest,await encryptEmail(email,env),await codeHash(id,code,env),now+900).run();
  try{await deliverCode(env,email,code,id,"verify")}catch{
   await env.DB.prepare("DELETE FROM community_email_challenges WHERE id=? AND purpose='verify'").bind(id).run();
   return fail("Email could not be sent. Check the sending provider configuration.",503);
  }
  return send({ok:true,requestId:id,message:"An 8-digit verification code was sent. It expires in 15 minutes."});
 }
 if(action==="finish_verify"){
  const a=await auth(request,env.DB);if(!a)return fail("Sign in before verifying your email.",401);
  if(!configured(env))return fail("Email service unavailable.",503);
  const id=String(d.requestId||""),code=String(d.code||"");
  if(!validId(id)||!validCode(code))return fail("Invalid or expired verification code.",400);
  const row=await env.DB.prepare("SELECT email_hash,email_cipher,code_hash,expires_at,attempts FROM community_email_challenges WHERE id=? AND profile_id=? AND purpose='verify' AND used_at IS NULL AND expires_at>? AND attempts<5").bind(id,a.id,now).first();
  if(!row)return fail("Invalid or expired verification code.",400);
  const actual=await codeHash(id,code,env);
  if(!verifyHash(actual,row.code_hash)){
   await env.DB.prepare("UPDATE community_email_challenges SET attempts=attempts+1 WHERE id=? AND profile_id=? AND used_at IS NULL").bind(id,a.id).run();
   return fail("Invalid or expired verification code.",400);
  }
  try{
   const results=await env.DB.batch([
    env.DB.prepare("UPDATE community_email_challenges SET used_at=? WHERE id=? AND profile_id=? AND purpose='verify' AND code_hash=? AND used_at IS NULL AND expires_at>? AND attempts<5").bind(now,id,a.id,actual,now),
    env.DB.prepare("INSERT INTO community_profile_emails(profile_id,email_hash,email_cipher,verified_at) SELECT profile_id,email_hash,email_cipher,? FROM community_email_challenges WHERE id=? AND profile_id=? AND used_at=? ON CONFLICT(profile_id) DO UPDATE SET email_hash=excluded.email_hash,email_cipher=excluded.email_cipher,verified_at=excluded.verified_at").bind(now,id,a.id,now),
    env.DB.prepare("DELETE FROM community_pending_recovery_contacts WHERE profile_id=?").bind(a.id)
   ]);
   if(!results[0]?.meta?.changes)return fail("This code has already been used.",409);
  }catch{return fail("Unable to verify this address. It may already belong to another profile.",409)}
  return send({ok:true,message:"Recovery email verified. Your current profile key is unchanged."});
 }
 if(action==="start_recovery"){
  if(!configured(env))return fail("Email recovery is not available yet. The owner must configure and verify an email sender.",503);
  const email=normalizeEmail(d.email);
  if(!email)return fail("Enter a valid email address.",400);
  if(!await verifyHuman(env,d.token,request))return fail("Human verification is required.",403);
  if(!await quota(env.DB,env,request,"recover-start",9))return fail("Too many requests from this connection today.",429);
  const digest=await emailHash(email,env),requestId=rnd();
  if(!await targetQuota(env.DB,digest,"recover-target",4))return send({...generic,requestId});
  const profile=await env.DB.prepare("SELECT profile_id,email_cipher FROM community_profile_emails WHERE email_hash=? AND verified_at>0").bind(digest).first();
  const fingerprint=await hash("deep-cuts-owner-recovery-grant:v1:"+email);
  // A manually approved grant is NOT a verified email. It permits sending a
  // one-time code only to that exact mailbox after Turnstile and rate limits.
  const grant=profile?null:await env.DB.prepare("SELECT profile_id FROM community_email_recovery_grants WHERE email_fingerprint=? AND consumed_at IS NULL AND expires_at>?").bind(fingerprint,now).first();
  if(!profile&&!grant)return send({...generic,requestId});
  const target=profile?.profile_id||grant.profile_id;
  const recent=await env.DB.prepare("SELECT 1 FROM community_email_challenges WHERE profile_id=? AND purpose='recover' AND created_at>? LIMIT 1").bind(target,now-60).first();
  if(recent)return send({...generic,requestId});
  const code=newCode(),id=requestId;
  await env.DB.prepare("INSERT INTO community_email_challenges(id,profile_id,purpose,email_hash,code_hash,expires_at) VALUES(?,?,?,?,?,?)").bind(id,target,"recover",digest,await codeHash(id,code,env),now+900).run();
  try{await deliverCode(env,profile?await decryptEmail(profile.email_cipher,env):email,code,id,"recover")}catch{
   await env.DB.prepare("DELETE FROM community_email_challenges WHERE id=? AND purpose='recover'").bind(id).run();
  }
  return send({...generic,requestId});
 }
 if(action==="finish_recovery"){
  if(!configured(env))return fail("Email recovery is not available.",503);
  const id=String(d.requestId||""),code=String(d.code||""),email=normalizeEmail(d.email);
  if(!validId(id)||!validCode(code)||!email)return fail("Code invalid or expired.",400);
  if(!await quota(env.DB,env,request,"recover-finish",24))return fail("Too many recovery attempts today.",429);
  const digest=await emailHash(email,env);
  const row=await env.DB.prepare("SELECT profile_id,email_hash,code_hash FROM community_email_challenges WHERE id=? AND purpose='recover' AND used_at IS NULL AND expires_at>? AND attempts<5").bind(id,now).first();
  if(!row||!verifyHash(row.email_hash,digest))return fail("Code invalid or expired.",400);
  const normal=await env.DB.prepare("SELECT 1 FROM community_profile_emails WHERE profile_id=? AND email_hash=? AND verified_at>0").bind(row.profile_id,digest).first();
  const fingerprint=await hash("deep-cuts-owner-recovery-grant:v1:"+email);
  const grant=normal?null:await env.DB.prepare("SELECT 1 FROM community_email_recovery_grants WHERE profile_id=? AND email_fingerprint=? AND consumed_at IS NULL AND expires_at>?").bind(row.profile_id,fingerprint,now).first();
  if(!normal&&!grant)return fail("Code invalid or expired.",400);
  const actual=await codeHash(id,code,env);
  if(!verifyHash(actual,row.code_hash)){
   await env.DB.prepare("UPDATE community_email_challenges SET attempts=attempts+1 WHERE id=? AND purpose='recover' AND used_at IS NULL").bind(id).run();
   return fail("Code invalid or expired.",400);
  }
  const key="dcprofile1_"+row.profile_id+"_"+rnd(32),keyHash=await hash(key);
  // Both existing verified owners and exceptional owner-approved legacy profiles
  // must present the correct one-time mailbox code before a key is rotated.
  const requirement=grant?
   "EXISTS(SELECT 1 FROM community_email_recovery_grants g WHERE g.profile_id=community_email_challenges.profile_id AND g.email_fingerprint=? AND g.consumed_at IS NULL AND g.expires_at>?)":
   "EXISTS(SELECT 1 FROM community_profile_emails e WHERE e.profile_id=community_email_challenges.profile_id AND e.email_hash=community_email_challenges.email_hash AND e.verified_at>0)";
  try{
   const actions=[
    env.DB.prepare("UPDATE community_profiles SET key_hash=? WHERE id=? AND EXISTS(SELECT 1 FROM community_email_challenges WHERE id=? AND profile_id=? AND purpose='recover' AND code_hash=? AND email_hash=? AND used_at IS NULL AND expires_at>? AND attempts<5 AND "+requirement+")").bind(keyHash,row.profile_id,id,row.profile_id,actual,digest,now,...(grant?[fingerprint,now]:[])),
    env.DB.prepare("UPDATE community_email_challenges SET used_at=? WHERE id=? AND purpose='recover' AND used_at IS NULL AND expires_at>? AND code_hash=?").bind(now,id,now,actual),
    env.DB.prepare("UPDATE community_email_challenges SET used_at=? WHERE profile_id=? AND purpose='recover' AND used_at IS NULL").bind(now,row.profile_id)
   ];
   if(grant){
    const cipher=await encryptEmail(email,env);
    actions.push(
     env.DB.prepare("INSERT INTO community_profile_emails(profile_id,email_hash,email_cipher,verified_at) VALUES(?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET email_hash=excluded.email_hash,email_cipher=excluded.email_cipher,verified_at=excluded.verified_at").bind(row.profile_id,digest,cipher,now),
     env.DB.prepare("UPDATE community_email_recovery_grants SET consumed_at=? WHERE profile_id=? AND email_fingerprint=? AND consumed_at IS NULL AND expires_at>?").bind(now,row.profile_id,fingerprint,now),
     env.DB.prepare("DELETE FROM community_pending_recovery_contacts WHERE profile_id=?").bind(row.profile_id)
    );
   }
   // Resetting a recovery key invalidates every old remembered device.
   // The newly recovered browser can enroll again with its fresh key.
   actions.push(env.DB.prepare("DELETE FROM community_device_sessions WHERE profile_id=?").bind(row.profile_id));
   const results=await env.DB.batch(actions);
   if(results[0]?.meta?.changes!==1||results[1]?.meta?.changes!==1||(grant&&results[4]?.meta?.changes!==1))
    return fail("Code already used or expired.",409);
  }catch{return fail("Could not reset profile key. Request a fresh code.",503)}
  return send({ok:true,key,warning:"Your old profile key was revoked. Store this new recovery key securely; it is displayed once."});
 }
 return fail("Unknown recovery operation.",404);
}
