/* Stripe webhook updates member status; signed payload only, never query params. */
import {reply,tierFromPrice} from "../../src/member-auth.js";
const equal=(a,b)=>{if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a[i]^b[i];return v===0};
function unhex(h){return new Uint8Array(h.match(/.{2}/g).map(v=>parseInt(v,16)))}
export async function onRequestPost({request,env}){
 if(!env.DB||!env.STRIPE_WEBHOOK_SECRET)return reply({error:"Webhook not configured."},503);
 const signature=request.headers.get("Stripe-Signature")||"";
 const timestamp=/\bt=(\d+)\b/.exec(signature)?.[1];
 const digests=[...signature.matchAll(/\bv1=([a-f0-9]{64})\b/g)].map(x=>x[1]);
 if(!timestamp||!digests.length||Math.abs(Date.now()/1000-Number(timestamp))>300)return reply({error:"Invalid signature."},400);
 const payload=await request.text();if(payload.length>60000)return reply({error:"Event too large."},413);
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+payload)));
 if(!digests.some(x=>equal(sig,unhex(x))))return reply({error:"Invalid signature."},400);
 let event;try{event=JSON.parse(payload)}catch{return reply({error:"Invalid event."},400)}
 if(!event.livemode)return reply({ok:true,ignored:"test event"});
 if(event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
  const sub=event.data?.object;
  if(sub?.id&&sub.livemode){
   const tier=tierFromPrice(sub.items?.data?.[0]?.price?.id,env);
   const status=["active","trialing"].includes(sub.status)&&tier?"active":sub.status||"inactive";
   if(tier)await env.DB.prepare("UPDATE member_accounts SET status=?,tier=?,checked_at=? WHERE stripe_subscription=?").bind(status,tier,Math.floor(Date.now()/1000),sub.id).run();
   else await env.DB.prepare("UPDATE member_accounts SET status='unrecognized_tier',checked_at=? WHERE stripe_subscription=?").bind(Math.floor(Date.now()/1000),sub.id).run();
  }
 }
 return reply({ok:true});
}
