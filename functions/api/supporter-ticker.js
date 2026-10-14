/* Public supporter credit roll. Show ONLY explicitly opted-in, verified,
   currently paid Ko-fi subscriptions. No public email, payment or member IDs. */
import {auth,body,originOK,send,fail} from "../../src/community-core.js";
import {decryptEmail,normalizeEmail} from "../../src/profile-email.js";
const names=new Set(["informant","detective","chief"]);
const TIER_ORDER={chief:3,detective:2,informant:1};
const CACHE={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=90, s-maxage=90","X-Content-Type-Options":"nosniff"};
const encoder=new TextEncoder();
const safeName=value=>{
 const s=String(value||"").normalize("NFKC").trim().replace(/\s+/g," ");
 return s.length>=2&&s.length<=36&&/^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .'-]*$/u.test(s)&&!/[\p{C}]/u.test(s)?s:"";
};
async function koFiHash(env,email){
 const key=await crypto.subtle.importKey("raw",encoder.encode(env.KOFI_EMAIL_HASH_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=await crypto.subtle.sign("HMAC",key,encoder.encode("ko-fi-member-v1:"+email));
 return [...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
async function paidTier(env,encryptedEmail){
 if(!encryptedEmail||!env.KOFI_EMAIL_HASH_SECRET)return null;
 const email=normalizeEmail(await decryptEmail(encryptedEmail,env));
 if(!email)return null;
 const digest=await koFiHash(env,email);
 const row=await env.DB.prepare("SELECT tier FROM kofi_renewals WHERE email_hash=? AND paid_until>unixepoch() AND tier IN ('informant','detective','chief') LIMIT 1").bind(digest).first();
 return names.has(row?.tier)?row.tier:null;
}
export async function onRequestGet({request,env}){
 if(!env.DB)return fail("Supporter list temporarily unavailable.",503);
 try{
  const mine=new URL(request.url).searchParams.get("action")==="mine";
  if(mine){
   const account=await auth(request,env.DB);if(!account)return fail("Sign in to manage supporter credit.",401);
   const [opt,email]=await Promise.all([
    env.DB.prepare("SELECT display_name,visible FROM supporter_ticker_optins WHERE profile_id=?").bind(account.id).first(),
    env.DB.prepare("SELECT email_cipher FROM community_profile_emails WHERE profile_id=?").bind(account.id).first()
   ]);
   let tier=null;
   try{tier=await paidTier(env,email?.email_cipher)}catch(e){console.error("Unable to verify supporter tier",String(e?.name||"error"))}
   return send({displayName:opt?.display_name||"",visible:!!opt?.visible,tier,eligible:!!tier,emailVerified:!!email});
  }
  const rows=await env.DB.prepare(`SELECT o.display_name,e.email_cipher FROM supporter_ticker_optins o
   JOIN community_profile_emails e ON e.profile_id=o.profile_id
   WHERE o.visible=1 ORDER BY o.updated_at DESC LIMIT 70`).all();
  const credits=[];
  for(const row of rows.results||[]){
   const name=safeName(row.display_name);if(!name)continue;
   try{
    const tier=await paidTier(env,row.email_cipher);
    if(tier)credits.push({name,tier});
   }catch(e){console.error("Skipped unavailable supporter credit",String(e?.name||"error"))}
  }
  credits.sort((a,b)=>TIER_ORDER[b.tier]-TIER_ORDER[a.tier]||a.name.localeCompare(b.name));
  return new Response(JSON.stringify({supporters:credits.slice(0,50),asOf:new Date().toISOString()}),{headers:CACHE});
 }catch(e){console.error("Supporter ticker read",String(e?.name||"error"));return fail("Supporter list temporarily unavailable.",503)}
}
export async function onRequestPost({request,env}){
 if(!env.DB||!env.KOFI_EMAIL_HASH_SECRET)return fail("Supporter listing not available.",503);
 if(!request.headers.get("Origin")||!originOK(request))return fail("Origin rejected.",403);
 const account=await auth(request,env.DB);if(!account)return fail("Sign in to manage your supporter credit.",401);
 let data;try{data=await body(request)}catch{return fail("Invalid supporter listing request.",400)}
 const visible=data?.visible===true;
 if(data?.visible!==true&&data?.visible!==false)return fail("Choose whether your credit is public.",400);
 if(!visible){
  await env.DB.prepare("DELETE FROM supporter_ticker_optins WHERE profile_id=?").bind(account.id).run();
  return send({ok:true,visible:false});
 }
 const name=safeName(data?.displayName);if(!name)return fail("Enter a display name with 2–36 letters or numbers.",400);
 const verified=await env.DB.prepare("SELECT email_cipher FROM community_profile_emails WHERE profile_id=?").bind(account.id).first();
 if(!verified)return fail("Verify your profile email to enable public supporter credit.",403);
 let tier;try{tier=await paidTier(env,verified.email_cipher)}catch{return fail("Could not verify your current Ko-fi subscription.",503)}
 if(!tier)return fail("A current Ko-fi membership matching your verified profile email is required.",403);
 await env.DB.prepare(`INSERT INTO supporter_ticker_optins(profile_id,display_name,visible,updated_at)
   VALUES(?,?,1,unixepoch()) ON CONFLICT(profile_id) DO UPDATE SET
   display_name=excluded.display_name,visible=1,updated_at=unixepoch()`).bind(account.id,name).run();
 return send({ok:true,visible:true,displayName:name,tier});
}
