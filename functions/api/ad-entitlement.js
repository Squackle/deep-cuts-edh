/* Anonymous-safe member ad exemption status and owner-only legacy reconciliation.
 * No email, hashed index or secret returned to the client.
 */
import {checkAdFree,subscriberHash} from "../../src/kofi-adfree.js";
import {ownerAuth} from "../../src/owner-access.js";
import {normalizeEmail} from "../../src/profile-email.js";
import {reply,originOK} from "../../src/member-auth.js";
const HEAD={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
export async function onRequestGet({request,env}){
 try{
  const s=await checkAdFree(request,env);
  return reply({adFree:s.adFree,authenticated:s.authenticated,verifiedEmail:s.verifiedEmail,
   paidUntil:s.adFree?s.paidUntil:null,matchingRule:"verified Ko-fi subscription email"});
 }catch(e){
  console.warn("Ad-free status check unavailable",String(e?.name||"error"));
  return reply({adFree:false,authenticated:false,verifiedEmail:false,unavailable:true},503);
 }
}
export async function onRequestPost({request,env}){
 if(!originOK(request)||!request.headers.get("Origin"))return reply({error:"Request origin rejected."},403);
 const authorization=await ownerAuth(request,env);
 if(authorization.error)return authorization.error;
 const length=Number(request.headers.get("Content-Length")||0);
 if(length>1400)return reply({error:"Request too large."},413);
 let d;
 try{d=await request.json()}catch{return reply({error:"Expected a small JSON request."},400)}
 if(JSON.stringify(d).length>1400)return reply({error:"Request too large."},413);
 const email=normalizeEmail(d.email);
 if(!email)return reply({error:"Enter the verified Ko-fi payment email."},400);
 if(!["grant","revoke"].includes(d.action))return reply({error:"Unknown action."},400);
 if(!env.KOFI_EMAIL_HASH_SECRET)return reply({error:"Ko-fi email matching is unavailable."},503);
 try{
  const hash=await subscriberHash(email,env);
  if(d.action==="revoke"){
   const r=await env.DB.prepare("DELETE FROM kofi_adfree_manual WHERE email_hash=?").bind(hash).run();
   return reply({ok:true,removed:Boolean(r.meta?.changes),notice:"Manual ad-free record removed. Verified automated subscriptions remain valid through their paid-through date."});
  }
  if(d.confirmedPayment!==true)return reply({error:"Confirm you independently checked the active monthly Ko-fi payment."},400);
  const date=String(d.paidThrough||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return reply({error:"Choose the confirmed paid-through date."},400);
  const until=Date.parse(date+"T23:59:59Z"),now=Date.now();
  if(!Number.isFinite(until)||until<=now||until>now+63*86400000)return reply({error:"Paid-through must be in the next 63 days."},400);
  await env.DB.prepare("INSERT INTO kofi_adfree_manual(email_hash,paid_until,verified_at) VALUES(?,?,unixepoch()) ON CONFLICT(email_hash) DO UPDATE SET paid_until=excluded.paid_until,verified_at=unixepoch()").bind(hash,Math.floor(until/1000)).run();
  return reply({ok:true,paidThrough:date,notice:"Ad-free Ko-fi subscription matched to this payment email until the verified date."});
 }catch(e){
  console.error("Ad-free owner action unavailable",String(e?.name||"error"));
  return reply({error:"Unable to update the subscription record. Retry later."},503);
 }
}
