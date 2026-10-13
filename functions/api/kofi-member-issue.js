// Owner-only Ko-fi membership issuance. Never accepts subscriber self-claims.
// Real payment must already be present from an authenticated Ko-fi webhook.
// Owner must separately verify the recipient owns the matching Ko-fi account.
import {reply,random,sha,originOK,json} from "../../src/member-auth.js";
const text=s=>typeof s==="string"?s.trim():"";
async function hmac(secret,value){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),"HMAC",false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)));
 return Array.from(signed,x=>x.toString(16).padStart(2,"0")).join("");
}
function sameHash(a,b){
 const aa=String(a||""),bb=String(b||"");if(aa.length!==64||bb.length!==64)return false;
 let diff=0;for(let i=0;i<64;i++)diff|=aa.charCodeAt(i)^bb.charCodeAt(i);
 return diff===0;
}
const deny=(s=403,message="Not authorized.")=>reply({error:message},s);
export async function onRequestPost({request,env}){
 if(!originOK(request))return deny(403,"Invalid request origin.");
 if(!env.DB||!env.KOFI_EMAIL_HASH_SECRET||!env.TURNSTILE_SECRET)return deny(503,"Owner issuance is not configured.");
 const source=request.headers.get("CF-Connecting-IP");if(!source)return deny();
 const ipHash=await sha("member:issuer:v1:"+env.TURNSTILE_SECRET+":"+source);
 const day=new Date().toISOString().slice(0,10);
 // Quota applies even to wrong credentials, preventing repeated brute-force requests.
 const allowed=await env.DB.prepare("INSERT INTO member_issuer_limits(day_key,ip_hash,attempts) VALUES(?,?,1) ON CONFLICT(day_key,ip_hash) DO UPDATE SET attempts=attempts+1 WHERE attempts<30 RETURNING attempts").bind(day,ipHash).first();
 if(!allowed)return deny(429,"Daily operator request cap reached.");
 const key=(request.headers.get("Authorization")||"").replace(/^Bearer /,"");
 const cred=await env.DB.prepare("SELECT key_hash FROM member_issuer_credentials WHERE id=1").first();
 if(!cred)return deny(503,"Owner issuance is not configured.");
 if(!/^dcissuer1_[a-f0-9]{64}$/.test(key)||!sameHash(await sha(key),cred.key_hash))return deny();
 let data;try{data=await json(request,3000)}catch{return deny(400,"Invalid request body.")}
 const action=text(data.action);
 const email=text(data.email).toLowerCase();
 if(email.length>250||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return deny(400,"Enter the exact verified subscriber email.");
 const emailHash=await hmac(env.KOFI_EMAIL_HASH_SECRET,"ko-fi-member-v1:"+email);
 const renewal=await env.DB.prepare("SELECT tier,last_paid_at,paid_until FROM kofi_renewals WHERE email_hash=?").bind(emailHash).first();
 const existing=await env.DB.prepare("SELECT member_id,revoked_at FROM member_kofi_links WHERE email_hash=?").bind(emailHash).first();
 const now=Math.floor(Date.now()/1000),active=!!renewal&&Number(renewal.paid_until)>now&&Number(renewal.last_paid_at)>0&&["informant","detective","chief"].includes(renewal.tier);
 if(action==="lookup"){
  return reply({ok:true,verifiedPaymentRecorded:active,paidUntil:active?renewal.paid_until:null,tier:active?renewal.tier:null,keyIssued:!!existing,revoked:existing?.revoked_at!=null});
 }
 if(!["issue","replace","revoke"].includes(action))return deny(400,"Unknown operation.");
 if(data.confirmedKoFi!==true||data.confirmedOwnership!==true)return deny(400,"Operator must confirm payment in Ko-fi and recipient ownership independently.");
 if(action==="revoke"){
  if(!existing)return deny(404,"There is no issued membership for this subscriber.");
  await env.DB.prepare("UPDATE member_kofi_links SET revoked_at=? WHERE email_hash=? AND revoked_at IS NULL").bind(now,emailHash).run();
  return reply({ok:true,revoked:true,note:"Access has been revoked. Ko-fi subscription billing must be handled separately."});
 }
 if(!active)return deny(409,"No currently paid verified Ko-fi renewal is recorded for this subscriber. Do not issue a key.");
 if(action==="issue"&&existing)return deny(409,"A key already exists. Use the separately verified replacement workflow; never reveal a stored hash.");
 if(action==="replace"&&(!existing||existing.revoked_at!=null))return deny(409,"No active issued key is available for replacement.");
 const id=action==="replace"?existing.member_id:random(16);
 const memberKey="dcmember1_"+id+"_"+random(32),digest=await sha(memberKey);
 try{
  if(action==="issue"){
   await env.DB.batch([
    env.DB.prepare("INSERT INTO member_accounts(id,stripe_customer,stripe_subscription,checkout_session,tier,key_hash,status,checked_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,"kofi:"+emailHash,"kofi:"+emailHash,"kofi-owner:"+id,renewal.tier,digest,"active",now),
    env.DB.prepare("INSERT INTO member_kofi_links(member_id,email_hash,confirmed_by_owner_at) VALUES(?,?,?)").bind(id,emailHash,now)
   ]);
  }else{
   await env.DB.batch([
    env.DB.prepare("UPDATE member_accounts SET key_hash=?,tier=?,status='active',checked_at=? WHERE id=?").bind(digest,renewal.tier,now,id),
    env.DB.prepare("UPDATE member_devices SET revoked_at=? WHERE member_id=? AND revoked_at IS NULL").bind(now,id),
    env.DB.prepare("UPDATE member_kofi_links SET confirmed_by_owner_at=? WHERE member_id=?").bind(now,id)
   ]);
  }
 }catch(e){console.error("Ko-fi owner-claim database operation failed.");return deny(503,"Key could not be issued. Check existing membership state privately.");}
 return reply({ok:true,action,key:memberKey,tier:renewal.tier,paidUntil:renewal.paid_until,
 warning:"ONE-TIME KEY. Deliver securely to the independently verified Ko-fi subscriber. Key is not stored in plaintext and cannot be retrieved again."},201);
}
export function onRequestGet(){return new Response(JSON.stringify({ok:false,error:"Owner-only POST endpoint."}),{status:405,headers:{"Content-Type":"application/json","Cache-Control":"no-store, private","X-Robots-Tag":"noindex, nofollow"}});}
