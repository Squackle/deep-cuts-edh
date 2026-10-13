/* Ko-fi sends payment events (not cancellation events). This endpoint does not
 * issue member keys or turn payments into entitlements. No public subscriber data.
 * Configure Ko-fi verification and HMAC secrets in Cloudflare Pages. */
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
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
 if(!env.DB||!env.KOFI_VERIFICATION_TOKEN||!env.KOFI_EMAIL_HASH_SECRET)
  return response({error:"Ko-fi webhook not configured."},503);
 if(Number(request.headers.get("content-length")||0)>16000)return response({error:"Payload too large."},413);
 const ct=request.headers.get("content-type")||"";
 if(!ct.toLowerCase().includes("application/x-www-form-urlencoded"))return response({error:"Expected Ko-fi form data."},415);
 let obj;
 try{
  const body=await request.text();
  if(body.length>16000)throw Error("Large payload");
  const data=new URLSearchParams(body).get("data");
  if(!data||data.length>15000)throw Error("Missing payload");
  obj=JSON.parse(data);
 }catch{return response({error:"Malformed Ko-fi payload."},400)}
 if(!obj||typeof obj!=="object"||typeof obj.verification_token!=="string")return response({error:"Invalid token."},403);
 if(!await tokenOK(obj.verification_token,env.KOFI_VERIFICATION_TOKEN))return response({error:"Invalid token."},403);
 // A Ko-fi webhook also reports one-time donations, shop orders and commissions.
 // None of those grants a recurring membership.
 if(obj.type!=="Subscription"||obj.is_subscription_payment!==true)return response({ok:true,ignored:"not a subscription payment"});
 const name=String(obj.tier_name||"").trim().toLowerCase().replace(/\s+/g," ");
 const tier=tiers[name];
 const cents=Math.round(Number(obj.amount)*100);
 if(!tier||obj.currency!=="USD"||!Number.isSafeInteger(cents)||cents<tier.minimum)
  return response({ok:true,ignored:"unknown membership tier or amount"});
 const email=String(obj.email||"").trim().toLowerCase(),id=String(obj.message_id||"").trim();
 const date=new Date(String(obj.timestamp||"")),paidAt=Math.floor(date.getTime()/1000),now=Math.floor(Date.now()/1000);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>250||id.length<8||id.length>128||!/^[\x21-\x7e]+$/.test(id)||!Number.isFinite(paidAt)||paidAt<now-7776000||paidAt>now+300)
  return response({error:"Incomplete or out-of-range Ko-fi payment event."},400);
 const emailHash=toHex(await digest(env.KOFI_EMAIL_HASH_SECRET,"ko-fi-member-v1:"+email));
 const paidUntil=addMonth(date);
 try{
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO kofi_payment_events(message_id,email_hash,tier,paid_at,paid_until,amount_cents) VALUES(?,?,?,?,?,?)").bind(id,emailHash,tier.id,paidAt,paidUntil,cents).run();
  if((inserted.meta?.changes||0)===0)return response({ok:true,duplicate:true});
  await env.DB.prepare(`INSERT INTO kofi_renewals(email_hash,tier,last_paid_at,paid_until) VALUES(?,?,?,?)
    ON CONFLICT(email_hash) DO UPDATE SET tier=CASE WHEN excluded.last_paid_at>=kofi_renewals.last_paid_at THEN excluded.tier ELSE kofi_renewals.tier END,
    last_paid_at=MAX(kofi_renewals.last_paid_at,excluded.last_paid_at),
    paid_until=MAX(kofi_renewals.paid_until,excluded.paid_until)`).bind(emailHash,tier.id,paidAt,paidUntil).run();
  return response({ok:true,recorded:true});
 }catch(e){console.error("Ko-fi payment record failed",String(e));return response({error:"Unable to record payment; retry later."},503)}
}
