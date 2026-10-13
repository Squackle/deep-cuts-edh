/* Verified Ko-fi monthly subscriptions -> advertising entitlement.
 * Uses existing Field Network authentication and verified private email.
 * The email is decrypted only inside a trusted server runtime, then HMAC'd
 * with the same purpose-domain as the Ko-fi webhook; no plaintext is stored.
 */
import {auth,hex} from "./community-core.js";
import {decryptEmail,normalizeEmail} from "./profile-email.js";
const encoder=new TextEncoder();
export async function subscriberHash(email,env){
 if(!env.KOFI_EMAIL_HASH_SECRET||typeof env.KOFI_EMAIL_HASH_SECRET!=="string")throw Error("Ko-fi membership matching not configured");
 const normalized=normalizeEmail(email);
 if(!normalized)throw Error("Subscriber email invalid");
 const key=await crypto.subtle.importKey("raw",encoder.encode(env.KOFI_EMAIL_HASH_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const signature=await crypto.subtle.sign("HMAC",key,encoder.encode("ko-fi-member-v1:"+normalized));
 return hex(new Uint8Array(signature));
}
export async function checkAdFree(request,env){
 if(!env.DB||!env.KOFI_EMAIL_HASH_SECRET)throw Error("Subscription verification unavailable");
 const profile=await auth(request,env.DB);
 if(!profile)return {authenticated:false,verifiedEmail:false,adFree:false,paidUntil:null};
 const linked=await env.DB.prepare("SELECT email_cipher FROM community_profile_emails WHERE profile_id=? AND verified_at>0")
  .bind(profile.id).first();
 if(!linked)return {authenticated:true,verifiedEmail:false,adFree:false,paidUntil:null};
 const address=normalizeEmail(await decryptEmail(linked.email_cipher,env));
 if(!address)throw Error("Verified email cannot be read");
 const digest=await subscriberHash(address,env);
 const now=Math.floor(Date.now()/1000);
 // Existing known-tier renewals are also included for backward compatibility.
 const result=await env.DB.prepare(`SELECT MAX(paid_until) AS paid_until FROM (
   SELECT paid_until FROM kofi_adfree_renewals WHERE email_hash=?
   UNION ALL SELECT paid_until FROM kofi_renewals WHERE email_hash=?
   UNION ALL SELECT paid_until FROM kofi_adfree_manual WHERE email_hash=?
 )`).bind(digest,digest,digest).first();
 const until=Number(result?.paid_until)||0;
 return {authenticated:true,verifiedEmail:true,adFree:until>now,paidUntil:until>now?until:null};
}
