/* Premium authentication helpers. No password identity, no client-side entitlement source of truth. */
export const H={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
export const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:H});
export const hex=b=>Array.from(b,v=>v.toString(16).padStart(2,"0")).join("");
export const random=(len=32)=>hex(crypto.getRandomValues(new Uint8Array(len)));
export async function sha(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(s)))));}
export function originOK(request){const o=request.headers.get("Origin");if(!o)return true;try{return new URL(o).origin===new URL(request.url).origin}catch{return false}}
export async function stripe(path,env){
 if(!env.STRIPE_SECRET_KEY||!env.STRIPE_SECRET_KEY.startsWith("sk_live_"))throw Error("Live Stripe verification is not configured.");
 const res=await fetch("https://api.stripe.com/v1/"+path,{headers:{"Authorization":"Bearer "+env.STRIPE_SECRET_KEY,"Accept":"application/json"},signal:AbortSignal.timeout(8500)});
 if(!res.ok)throw Error("Stripe verification failed ("+res.status+")");
 return res.json();
}
export const tierFromPrice=(price,env)=>price&&([
 ["informant",env.STRIPE_PRICE_INFORMANT],["detective",env.STRIPE_PRICE_DETECTIVE],["chief",env.STRIPE_PRICE_CHIEF]
].find(([name,id])=>id&&id===price)?.[0]||null);
export const tierPower={informant:1,detective:2,chief:3};
export async function sync(account,env){
 const now=Math.floor(Date.now()/1000);
 if(Number(account.checked_at||0)>now-300)return account;
 const sub=await stripe("subscriptions/"+encodeURIComponent(account.stripe_subscription),env);
 const status=String(sub.status||"");
 const price=sub.items?.data?.[0]?.price?.id||"";
 const tier=tierFromPrice(price,env);
 const permitted=["active","trialing"].includes(status)&&Boolean(tier)&&sub.livemode===true;
 const safeTier=tier||account.tier;
 await env.DB.prepare("UPDATE member_accounts SET status=?,tier=?,checked_at=? WHERE id=?").bind(permitted?"active":status||"inactive",safeTier,now,account.id).run();
 return {...account,status:permitted?"active":status||"inactive",tier:safeTier,checked_at:now};
}
export async function authorize(request,env,minTier="informant"){
 if(!env.DB||!env.STRIPE_SECRET_KEY)return {error:reply({error:"Premium access isn't configured yet."},503)};
 const bearer=request.headers.get("Authorization")||"";
 const m=/^Bearer (dcdevice1_[0-9a-f]{64})$/.exec(bearer);
 const cookie=/(?:^|;\s*)dc_member_device=(dcdevice1_[0-9a-f]{64})(?:;|$)/.exec(request.headers.get("Cookie")||"");
 if(!m&&!cookie)return {error:reply({error:"Activate this device with your member key first."},401)};
 const digest=await sha(m?.[1]||cookie[1]);
 const row=await env.DB.prepare("SELECT a.*,d.id AS device_id,d.label AS device_label FROM member_devices d JOIN member_accounts a ON a.id=d.member_id WHERE d.token_hash=? AND d.revoked_at IS NULL").bind(digest).first();
 if(!row)return {error:reply({error:"This device isn't activated or has been removed."},401)};
 let account;try{account=await sync(row,env)}catch{return {error:reply({error:"Could not confirm your Stripe membership right now. Please retry."},503)}}
 if(account.status!=="active")return {error:reply({error:"Membership inactive. Manage your billing through Stripe."},403)};
 if(tierPower[account.tier]<tierPower[minTier])return {error:reply({error:"This feature requires the "+minTier+" tier."},403)};
 return {account,deviceId:row.device_id};
}
export async function json(request,limit=15000){
 if(Number(request.headers.get("content-length")||0)>limit)throw new Error("Request too large.");
 const data=await request.json();
 if(JSON.stringify(data).length>limit)throw new Error("Request too large.");
 return data;
}
