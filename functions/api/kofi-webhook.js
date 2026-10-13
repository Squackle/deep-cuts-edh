/* Ko-fi sends payment events (not cancellation events). This endpoint does not
 * issue member keys or turn payments into entitlements. No public subscriber data.
 * Configure Ko-fi verification and HMAC secrets in Cloudflare Pages. */
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
/* Privacy-safe reception counters. These do not log payloads, IPs, emails,
 * verification tokens, or names. Failed authentication stays failed. */
async function diagnostic(env,reason){
 if(!env.DB)return;
 try {
  const hour=Math.floor(Date.now()/3600000)*3600;
  await env.DB.prepare("INSERT INTO kofi_webhook_diagnostics(hour_bucket,reason,events) VALUES(?,?,1) ON CONFLICT(hour_bucket,reason) DO UPDATE SET events=events+1").bind(hour,reason).run();
 }catch(e){console.error("Ko-fi diagnostics write failed",String(e))}
}

/* Public liveness check: never advertises private secret state. */
export function onRequestGet(){
 return response({ok:true,provider:"Ko-fi",memberKeyDeliveryReady:false});
}
async function digest(secret,data){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),"HMAC",false,["sign"]);
 return new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(data)));
}
function eq(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
async function tokenOK(got,expected){
 const a=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(got));
 const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(expected));
 return eq(new Uint8Array(a),new Uint8Array(b));
}
/* Enforce a size limit while reading; a missing Content-Length does not
 * allow a very large form body to be buffered into memory. */
async function readLimited(request,max=16000){
 if(!request.body)return "";
 const reader=request.body.getReader(),parts=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>max){await reader.cancel();throw Error("Request body too large")}
   parts.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
  return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
 }finally{reader.releaseLock()}
}
const toHex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
const tiers={
 "the informant":{id:"informant",minimum:500},
 "the detective":{id:"detective",minimum:1000},
 "the chief investigator":{id:"chief",minimum:2500}
};
function addMonth(date){
 const d=new Date(date),day=d.getUTCDate();
 d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
 const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,end));return Math.floor(d.getTime()/1000);
}
export async function onRequestPost({request,env}){
 await diagnostic(env,"post_received");
 if(!env.DB||!env.KOFI_VERIFICATION_TOKEN||!env.KOFI_EMAIL_HASH_SECRET){
  await diagnostic(env,"secrets_missing");
  return response({error:"Ko-fi webhook not configured."},503);
 }
 if(Number(request.headers.get("content-length")||0)>16000){await diagnostic(env,"too_large");return response({error:"Payload too large."},413)}
 const ct=request.headers.get("content-type")||"";
 if(!ct.toLowerCase().includes("application/x-www-form-urlencoded")){await diagnostic(env,"wrong_content_type");return response({error:"Expected Ko-fi form data."},415)}
 let obj;
 try{
  const body=await readLimited(request,16000);
  const data=new URLSearchParams(body).get("data");
  if(!data||data.length>15000)throw Error("Missing payload");
  obj=JSON.parse(data);
 }catch(e){if(e?.message==="Request body too large"){await diagnostic(env,"too_large");return response({error:"Payload too large."},413)}await diagnostic(env,"malformed_payload");return response({error:"Malformed Ko-fi payload."},400)}
 if(!obj||typeof obj!=="object"||typeof obj.verification_token!=="string"){await diagnostic(env,"token_missing");return response({error:"Invalid token."},403)}
 if(!await tokenOK(obj.verification_token,env.KOFI_VERIFICATION_TOKEN)){await diagnostic(env,"token_mismatch");return response({error:"Invalid token."},403)}
 await diagnostic(env,"token_verified");
 // Record only the fact that a properly authenticated event arrived.
 // No email, name, message ID, card data or entire payload is logged.
 const classification=obj.type==="Subscription"&&obj.is_subscription_payment===true?"subscription_payment":"non_subscription_payment";
 const eventType=["Subscription","Tip","Shop Order","Commission"].includes(String(obj.type))?String(obj.type):"other";
 try {
  await env.DB.batch([
   env.DB.prepare("INSERT INTO kofi_webhook_audit(event_type,classification) VALUES(?,?)").bind(eventType,classification),
   env.DB.prepare("DELETE FROM kofi_webhook_audit WHERE received_at<unixepoch()-2592000")
  ]);
 }catch(e){console.error("Unable to audit verified Ko-fi event",String(e));return response({error:"Unable to record Ko-fi delivery."},503)}

 // Ko-fi also reports tips, shop orders and commissions.
 // None of those grants a recurring membership.
 if(obj.type!=="Subscription"||obj.is_subscription_payment!==true){await diagnostic(env,"valid_non_subscription");return response({ok:true,ignored:"not a subscription payment"})}
 const name=String(obj.tier_name||"").trim().toLowerCase().replace(/\s+/g," ");
 const tier=tiers[name];
 const cents=Math.round(Number(obj.amount)*100);
 if(!tier||obj.currency!=="USD"||!Number.isSafeInteger(cents)||cents<tier.minimum){
  await diagnostic(env,"unknown_tier_or_amount");
  return response({ok:true,ignored:"unknown membership tier or amount"});
 }
 const email=String(obj.email||"").trim().toLowerCase(),id=String(obj.message_id||"").trim();
 const date=new Date(String(obj.timestamp||"")),paidAt=Math.floor(date.getTime()/1000),now=Math.floor(Date.now()/1000);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>250||id.length<8||id.length>128||!/^[\x21-\x7e]+$/.test(id)||!Number.isFinite(paidAt)||paidAt<now-7776000||paidAt>now+300)
 {
  // A valid Ko-fi token means delivery itself succeeded, even if this is a
  // simulated or malformed subscription example. Never grant access based
  // on these details. 200 prevents automatic retry storms of the same test.
  await diagnostic(env,"invalid_subscription_details");
  return response({ok:true,ignored:"subscription event lacks valid payment details"});
 }
 const emailHash=toHex(await digest(env.KOFI_EMAIL_HASH_SECRET,"ko-fi-member-v1:"+email));
 const paidUntil=addMonth(date);
 try{
  const result=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO kofi_payment_events(message_id,email_hash,tier,paid_at,paid_until,amount_cents) VALUES(?,?,?,?,?,?)").bind(id,emailHash,tier.id,paidAt,paidUntil,cents),
    // Renewals can only be attached to the matching immutable payment event.
    // A duplicate message_id with changed identity or tier must never renew anyone.
    env.DB.prepare(`INSERT INTO kofi_renewals(email_hash,tier,last_paid_at,paid_until)
       SELECT email_hash,tier,paid_at,paid_until FROM kofi_payment_events
       WHERE message_id=? AND email_hash=? AND tier=? AND paid_at=? AND amount_cents=?
       ON CONFLICT(email_hash) DO UPDATE SET
         tier=CASE WHEN excluded.last_paid_at>=kofi_renewals.last_paid_at THEN excluded.tier ELSE kofi_renewals.tier END,
         last_paid_at=MAX(kofi_renewals.last_paid_at,excluded.last_paid_at),
         paid_until=MAX(kofi_renewals.paid_until,excluded.paid_until)`).bind(id,emailHash,tier.id,paidAt,cents)
   ]);
  if((result?.[0]?.meta?.changes||0)!==1){
   await diagnostic(env,"duplicate_subscription_event");
   return response({ok:true,duplicate:true});
  }
  await diagnostic(env,"subscription_recorded");
  return response({ok:true,recorded:true});
 }catch(e){console.error("Ko-fi payment record failed",String(e));await diagnostic(env,"subscription_db_error");return response({error:"Unable to record payment; retry later."},503)}
}
