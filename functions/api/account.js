/* D1 username/password accounts for optional cross-device Commander deck saves. */
const H={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const res=(value,code=200,extra={})=>new Response(JSON.stringify(value),{status:code,headers:{...H,...extra}});
const hex=a=>[...a].map(b=>b.toString(16).padStart(2,"0")).join("");
const random=n=>crypto.getRandomValues(new Uint8Array(n));
const sha=async s=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))));
async function hashPassword(password,salt){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:Uint8Array.from(salt.match(/../g),n=>parseInt(n,16)),iterations:180000,hash:"SHA-256"},key,256)));
}
function same(a,b){if(!a||!b||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function cookie(t,age){return "deepcuts_session="+t+"; HttpOnly; Secure; SameSite=Strict; Path=/api/account; Max-Age="+age}
const allowed=r=>{const o=r.headers.get("Origin");if(!o)return true;try{return new URL(o).host===new URL(r.url).host}catch{return false}};
const tokenFrom=r=>(r.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("deepcuts_session="))?.split("=")[1]||"";
async function account(r,env){
 const t=tokenFrom(r);if(!/^[a-f0-9]{64}$/.test(t))return null;
 return env.DB.prepare("SELECT a.id,a.username FROM deck_sessions s JOIN deck_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?").bind(await sha("deepcuts-session:"+t),Math.floor(Date.now()/1000)).first();
}
async function limit(r,env){
 const ip=r.headers.get("CF-Connecting-IP");if(!ip)return false;
 const h=await sha("deepcuts-auth:"+env.TURNSTILE_SECRET+":"+ip),d=new Date().toISOString().slice(0,10);
 return !!await env.DB.prepare("INSERT INTO account_auth_limits(ip_hash,day,attempts) VALUES(?,?,1) ON CONFLICT(ip_hash,day) DO UPDATE SET attempts=attempts+1 WHERE attempts<15 RETURNING attempts").bind(h,d).first();
}
async function verify(token,r,env){
 if(!token)return false;
 const x=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token,remoteip:r.headers.get("CF-Connecting-IP")})});
 if(!x.ok)return false;const y=await x.json();return !!(y.success&&y.hostname===new URL(r.url).hostname);
}
function clean(d){
 if(!d||!Array.isArray(d.cards)||!Array.isArray(d.commanders)||d.commanders.length<1||d.commanders.length>2||d.cards.length>250)return null;
 if(d.commanders.some(n=>typeof n!=="string"||n.length<2||n.length>130))return null;
 const cards=d.cards.map(c=>({name:String(c?.name||"").trim(),qty:Number(c?.qty)}));
 if(cards.some(c=>c.name.length<2||c.name.length>130||!Number.isInteger(c.qty)||c.qty<1||c.qty>250)||cards.reduce((a,c)=>a+c.qty,0)>250)return null;
 return {commanders:d.commanders,cards,targetBracket:Math.max(1,Math.min(5,Number(d.targetBracket)||2))};
}
async function session(user,env){
 const t=hex(random(32));
 await env.DB.prepare("INSERT INTO deck_sessions(token_hash,account_id,expires_at) VALUES(?,?,?)").bind(await sha("deepcuts-session:"+t),user.id,Math.floor(Date.now()/1000)+2592000).run();
 return res({ok:true,username:user.username},200,{"Set-Cookie":cookie(t,2592000)});
}
export async function onRequestGet({request,env}){
 if(!env.DB)return res({error:"Account storage unavailable."},503);
 try{const user=await account(request,env);if(!user)return res({authenticated:false});
 const q=await env.DB.prepare("SELECT name,updated_at FROM account_decks WHERE account_id=? ORDER BY updated_at DESC LIMIT 20").bind(user.id).all();
 return res({authenticated:true,username:user.username,decks:q.results||[]});}
 catch(e){console.error("Account read",e);return res({error:"Account service unavailable."},503)}
}
export async function onRequestPost({request,env}){
 if(!allowed(request))return res({error:"Submission origin rejected."},403);
 if(!env.DB||!env.TURNSTILE_SECRET)return res({error:"Account storage unavailable."},503);
 if(Number(request.headers.get("content-length")||0)>40000)return res({error:"Request too large."},413);
 let d;try{d=await request.json()}catch{return res({error:"Invalid JSON."},400)}
 if(!d||JSON.stringify(d).length>40000)return res({error:"Request too large."},413);
 const action=String(d.action||"");
 try{
  if(action==="register"||action==="login"){
   if(!await limit(request,env))return res({error:"Too many sign-in attempts. Try tomorrow."},429);
   const username=String(d.username||"").trim(),password=String(d.password||"");
   if(!/^[a-zA-Z0-9_-]{3,30}$/.test(username)||password.length<12||password.length>128)return res({error:"Use a 3–30 character username and a password of 12–128 characters."},400);
   if(action==="register"){
    if(!await verify(d.token,request,env))return res({error:"Complete human verification to create an account."},400);
    const id=hex(random(16)),salt=hex(random(16)),hashed=await hashPassword(password,salt);
    try{await env.DB.prepare("INSERT INTO deck_accounts(id,username,password_hash,salt) VALUES(?,?,?,?)").bind(id,username,hashed,salt).run()}
    catch{return res({error:"That username is unavailable."},409)}
    return session({id,username},env);
   }
   const user=await env.DB.prepare("SELECT id,username,password_hash,salt FROM deck_accounts WHERE username=?").bind(username).first();
   if(!user)return res({error:"Invalid username or password."},401);
   if(!same(await hashPassword(password,user.salt),user.password_hash))return res({error:"Invalid username or password."},401);
   return session(user,env);
  }
  const user=await account(request,env);if(!user)return res({error:"Sign in first."},401);
  if(action==="logout"){const t=tokenFrom(request);if(t)await env.DB.prepare("DELETE FROM deck_sessions WHERE token_hash=?").bind(await sha("deepcuts-session:"+t)).run();return res({ok:true},200,{"Set-Cookie":cookie("",0)})}
  const name=String(d.name||"").trim();if(name.length<1||name.length>75)return res({error:"Deck names must be 1–75 characters."},400);
  if(action==="save"){
   const deck=clean(d.deck);if(!deck)return res({error:"Enter a valid Commander deck first."},400);
   const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM account_decks WHERE account_id=?").bind(user.id).first();
   const duplicate=await env.DB.prepare("SELECT name FROM account_decks WHERE account_id=? AND name=?").bind(user.id,name).first();
   if(Number(count.n)>=20&&!duplicate)return res({error:"Your account can save up to 20 decks."},409);
   await env.DB.prepare("INSERT INTO account_decks(account_id,name,content) VALUES(?,?,?) ON CONFLICT(account_id,name) DO UPDATE SET content=excluded.content,updated_at=datetime('now')").bind(user.id,name,JSON.stringify(deck)).run();
   return res({ok:true});
  }
  if(action==="load"){const row=await env.DB.prepare("SELECT content,updated_at FROM account_decks WHERE account_id=? AND name=?").bind(user.id,name).first();return row?res({ok:true,deck:JSON.parse(row.content),updatedAt:row.updated_at}):res({error:"Deck not found."},404)}
  if(action==="delete"){await env.DB.prepare("DELETE FROM account_decks WHERE account_id=? AND name=?").bind(user.id,name).run();return res({ok:true})}
  return res({error:"Unknown action."},400);
 }catch(e){console.error("Account mutation",e);return res({error:"Account operation failed."},503)}
}
