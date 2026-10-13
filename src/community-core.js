// Shared community helpers. Secrets are hashed and never returned except at first registration.
export const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
export const send=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:HEAD});
export const fail=(msg,status=400)=>send({error:msg},status);
export const hex=x=>Array.from(x,v=>v.toString(16).padStart(2,"0")).join("");
export const rnd=(n=16)=>hex(crypto.getRandomValues(new Uint8Array(n)));
export const hash=async x=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(x)))));
export const safe=(s,max=500)=>typeof s==="string"?s.trim().slice(0,max):"";
export const AVATARS=["Chainer, Dementia Master","Commander Mustard","Alena, Kessig Trapper","Gilanra, Caller of Wirewood","Ekthi, Contaminator Priest"];
export const CASES=["chainer-dementia-master","alena-and-gilanra","commander-mustard","ekthi-contaminator-priest"];
export const publicProfile=p=>p&&({id:p.id,handle:p.handle,bio:p.bio,avatar:p.avatar,focus_x:p.focus_x,focus_y:p.focus_y,focus_zoom:p.focus_zoom??2.8,created_at:p.created_at});
export const topicOK=s=>/^case:(chainer-dementia-master|alena-and-gilanra|commander-mustard|ekthi-contaminator-priest)$/.test(s)||/^deck:[a-f0-9]{32}$/.test(s);
export function originOK(req){const val=req.headers.get("Origin");if(!val)return true;try{return new URL(val).origin===new URL(req.url).origin}catch{return false}}
export async function body(req){
 if(Number(req.headers.get("content-length")||0)>42000)throw Error("Request too large.");
 const t=await req.text();if(t.length>42000)throw Error("Request too large.");
 return JSON.parse(t);
}
// The primary recovery key is used only to enroll a trusted browser. Once a
// device cookie has been issued the original key need not live in localStorage.
export const PROFILE_DEVICE_COOKIE="__Host-dc_device";
export function deviceToken(req){
 const cookies=req.headers.get("Cookie")||"";
 const found=cookies.match(/(?:^|; *)__Host-dc_device=(dcdevice1_[a-f0-9]{64})(?:;|$)/);
 return found?.[1]||"";
}
export async function auth(req,db){
 const header=req.headers.get("Authorization");
 if(header){
  const m=/^Bearer (dcprofile1_([a-f0-9]{32})_[a-f0-9]{64})$/.exec(header);
  if(!m)return null; // Never fall back to a cookie after an invalid bearer key.
  return db.prepare("SELECT id,handle,bio,avatar,focus_x,focus_y,focus_zoom,created_at FROM community_profiles WHERE id=? AND key_hash=?").bind(m[2],await hash(m[1])).first();
 }
 const token=deviceToken(req);
 if(!token)return null;
 return db.prepare(`SELECT p.id,p.handle,p.bio,p.avatar,p.focus_x,p.focus_y,p.focus_zoom,p.created_at
  FROM community_device_sessions d JOIN community_profiles p ON p.id=d.profile_id
  WHERE d.token_hash=? AND d.expires_at>unixepoch() LIMIT 1`).bind(await hash(token)).first();
}
export async function quota(db,env,req,action,max,member){
 const ip=req.headers.get("CF-Connecting-IP");if(!ip||!env.TURNSTILE_SECRET)return false;
 const subject=await hash("community:v1:"+env.TURNSTILE_SECRET+":"+ip);
 const date=new Date().toISOString().slice(0,10);
 const sql="INSERT INTO community_limits(subject,date_key,action,attempts) VALUES(?,?,?,1) ON CONFLICT(subject,date_key,action) DO UPDATE SET attempts=attempts+1 WHERE attempts<? RETURNING attempts";
 const first=await db.prepare(sql).bind(subject,date,action,max).first();if(!first)return false;
 if(member){const second=await db.prepare(sql).bind(member.id,date,action,max).first();if(!second)return false}
 return true;
}
export function cleanDeck(d){
 if(!d||!Array.isArray(d.commanders)||!Array.isArray(d.cards)||d.commanders.length<1||d.commanders.length>2||d.cards.length>250)return null;
 const commanders=d.commanders.map(x=>safe(x,130));
 const cards=d.cards.map(c=>({name:safe(c?.name,130),qty:Number(c?.qty)}));
 if(commanders.some(x=>x.length<2)||cards.some(c=>c.name.length<2||!Number.isInteger(c.qty)||c.qty<1||c.qty>250)||cards.reduce((n,c)=>n+c.qty,0)>250)return null;
 return {commanders,cards,targetBracket:Math.min(5,Math.max(1,Number(d.targetBracket)||2))};
}
export async function verifyHuman(env,token,req){
 if(!env.TURNSTILE_SECRET||!token)return false;
 const f=new FormData();f.append("secret",env.TURNSTILE_SECRET);f.append("response",token);f.append("remoteip",req.headers.get("CF-Connecting-IP")||"");
 const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:f});
 return (await r.json()).success===true;
}
