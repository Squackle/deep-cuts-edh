/* Premium authentication helpers. No password identity, no client-side entitlement source of truth. */
export const H={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
export const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:H});
export const hex=b=>Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");
export const random=(len=32)=>hex(crypto.getRandomValues(new Uint8Array(len)));
export async function sha(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(s)))));}
export function originOK(request){const o=request.headers.get("Origin");if(!o)return true;try{return new URL(o).origin===new URL(request.url).origin}catch{return false}}
/* Ko-fi payment intake is staged; member entitlement verification
 * remains locked until an authenticated redemption flow is tested. */
// Ko-fi is payment-only: reconcile access against the latest VERIFIED renewal on EVERY request.
// A stale key cannot outlive its paid-through date, and owner revocations take effect immediately.
export async function sync(account,env){
 if(!env.DB)throw Error("Membership storage unavailable.");
 const now=Math.floor(Date.now()/1000);
 if(account.status!=="active")return {...account,status:"inactive",paid_until:0};
 // Complimentary keys remain operational independently of Ko-fi onboarding.
 const grant=await env.DB.prepare("SELECT tier,expires_at,revoked_at FROM member_complimentary_grants WHERE member_id=?").bind(account.id).first();
 if(grant){
  const active=grant.revoked_at==null&&Number(grant.expires_at)>now;
  return {...account,tier:grant.tier,paid_until:active?Number(grant.expires_at):0,status:active?"active":"inactive",access_source:"complimentary"};
 }
 // Paid subscriptions cannot be activated until their end-to-end verification is enabled.
 if(env.KOFI_MEMBER_ACCESS_READY!=="true")return {...account,status:"inactive",paid_until:0,access_source:"kofi"};
 const row=await env.DB.prepare("SELECT l.revoked_at,r.tier,r.paid_until,r.last_paid_at FROM member_kofi_links l LEFT JOIN kofi_renewals r ON r.email_hash=l.email_hash WHERE l.member_id=?").bind(account.id).first();
 if(!row||row.revoked_at!=null||!Number.isInteger(Number(row.paid_until))||Number(row.paid_until)<=now||!["informant","detective","chief"].includes(row.tier))
  return {...account,status:"inactive",paid_until:0,access_source:"kofi"};
 return {...account,tier:row.tier,paid_until:Number(row.paid_until),status:"active",access_source:"kofi"};
}
export const tierPower={informant:1,detective:2,chief:3};
export async function authorize(request,env,minTier="informant"){
 if(!env.DB)return {error:reply({error:"Membership storage is unavailable."},503)};
 const bearer=request.headers.get("Authorization")||"";
 const m=/^Bearer (dcdevice1_[0-9a-f]{64})$/.exec(bearer);
 const cookie=/(?:^|;\s*)dc_member_device=(dcdevice1_[0-9a-f]{64})(?:;|$)/.exec(request.headers.get("Cookie")||"");
 if(!m&&!cookie)return {error:reply({error:"Activate this device with your member key first."},401)};
 const digest=await sha(m?.[1]||cookie[1]);
 const row=await env.DB.prepare("SELECT a.*,d.id AS device_id,d.label AS device_label FROM member_devices d JOIN member_accounts a ON a.id=d.member_id WHERE d.token_hash=? AND d.revoked_at IS NULL").bind(digest).first();
 if(!row)return {error:reply({error:"This device isn't activated or has been removed."},401)};
 let account;try{account=await sync(row,env)}catch{return {error:reply({error:"Could not verify membership access right now."},503)}}
 if(account.status!=="active")return {error:reply({error:"Membership inactive or expired. Complimentary keys require renewal by the site owner; Ko-fi keys require a verified active subscription."},403)};
 if(tierPower[account.tier]<tierPower[minTier])return {error:reply({error:"This feature requires the "+minTier+" tier."},403)};
 await env.DB.prepare("UPDATE member_devices SET last_seen_at=? WHERE id=? AND (last_seen_at=0 OR last_seen_at<?)").bind(Math.floor(Date.now()/1000),row.device_id,Math.floor(Date.now()/1000)-3600).run();
 return {account,deviceId:row.device_id};
}
export async function json(request,limit=15000){
 if(Number(request.headers.get("content-length")||0)>limit)throw new Error("Request too large.");
 const data=await request.json();
 if(JSON.stringify(data).length>limit)throw new Error("Request too large.");
 return data;
}
