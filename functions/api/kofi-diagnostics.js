/* Private Ko-fi observability, separate credential from Ko-fi's signing token.
 * Responses contain only event type, status counters and rounded times.
 * No identity, email, amount, message ID, IP or complete request data. */
const H={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
const reply=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:H});
const equal=(a,b)=>{let delta=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)delta|=(a[i]||0)^(b[i]||0);return delta===0};
const sha=async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
export async function onRequestPost({request,env}){
 const o=request.headers.get("Origin");
 if(o){try{if(new URL(o).origin!==new URL(request.url).origin)return reply({error:"Access denied."},403)}catch{return reply({error:"Access denied."},403)}}
 if(Number(request.headers.get("content-length")||0)>1024)return reply({error:"Request too large."},413);
 if(!env.DB||!/^([0-9a-f]{64})$/.test(env.KOFI_ADMIN_DIAGNOSTICS_HASH||""))return reply({error:"Private diagnostics not configured."},503);
 const token=/^Bearer (dcdiag1_[0-9a-f]{64})$/.exec(request.headers.get("Authorization")||"")?.[1]||"";
 const expected=new Uint8Array(env.KOFI_ADMIN_DIAGNOSTICS_HASH.match(/.{2}/g).map(h=>parseInt(h,16)));
 if(!token||!equal(await sha(token),expected))return reply({error:"Access denied."},403);
 const since=Math.floor(Date.now()/1000)-86400;
 try{
  const [counts,verified,payments]=await env.DB.batch([
   env.DB.prepare("SELECT reason,SUM(events) AS count,MAX(hour_bucket) AS last_hour FROM kofi_webhook_diagnostics WHERE hour_bucket>=? GROUP BY reason ORDER BY reason").bind(since),
   env.DB.prepare("SELECT event_type,classification,received_at FROM kofi_webhook_audit WHERE received_at>=? ORDER BY id DESC LIMIT 12").bind(since),
   env.DB.prepare("SELECT COUNT(*) AS count FROM kofi_payment_events WHERE received_at>=?").bind(since)
  ]);
  return reply({ok:true,windowHours:24,memberKeysEnabled:false,
   counters:(counts.results||[]).map(x=>({reason:x.reason,count:Number(x.count),lastHourUTC:new Date(Number(x.last_hour)*1000).toISOString()})),
   verifiedEvents:(verified.results||[]).map(x=>({type:x.event_type,classification:x.classification,receivedUTC:new Date(Number(x.received_at)*1000).toISOString()})),
   qualifiedPayments:Number(payments.results?.[0]?.count||0)});
 }catch(e){console.error("Private Ko-fi diagnostic query failed",String(e));return reply({error:"Diagnostics temporarily unavailable."},503)}
}
export function onRequestGet(){return reply({error:"Use the private diagnostics dashboard."},405)}
