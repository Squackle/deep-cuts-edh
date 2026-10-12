// Recovery-key deck vault. Token is 256-bit random secret; only SHA-256 hash is stored.
const head={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(x,code=200)=>new Response(JSON.stringify(x),{status:code,headers:head});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))))}
function validDeck(raw){
 if(!raw||!Array.isArray(raw.commanders)||!Array.isArray(raw.cards)||raw.commanders.length<1||raw.commanders.length>2||raw.cards.length>250)return null;
 const commanders=raw.commanders.filter(x=>typeof x==="string"&&x.length>=2&&x.length<=130);
 if(commanders.length!==raw.commanders.length)return null;
 const cards=raw.cards.map(x=>({name:String(x?.name||"").trim(),qty:Number(x?.qty)}));
 if(cards.some(x=>x.name.length<2||x.name.length>130||!Number.isInteger(x.qty)||x.qty<1||x.qty>250)||cards.reduce((n,x)=>n+x.qty,0)>250)return null;
 return {commanders,cards,targetBracket:Math.max(1,Math.min(5,Number(raw.targetBracket)||2))};
}
const parseKey=key=>{
 const m=/^dcvault1_([0-9a-f]{32})_([0-9a-f]{64})$/.exec(String(key||""));
 return m?{id:m[1],secret:m[2]}:null;
};
function safeOrigin(request){
 const origin=request.headers.get("Origin");if(!origin)return true;
 try{return new URL(origin).host===new URL(request.url).host}catch{return false}
}
export async function onRequestPost({request,env}){
 if(!safeOrigin(request))return reply({error:"Origin not allowed."},403);
 if(!env.DB||!env.TURNSTILE_SECRET)return reply({error:"Deck vault not configured."},503);
 if(Number(request.headers.get("content-length")||0)>40000)return reply({error:"Request too large."},413);
 let data;try{data=await request.json()}catch{return reply({error:"Invalid request."},400)}
 if(!data||typeof data!=="object"||JSON.stringify(data).length>40000)return reply({error:"Request too large."},413);
 const action=data.action;
 if(action==="create"){
  const deck=validDeck(data.deck);if(!deck)return reply({error:"Enter a valid Commander deck."},400);
  const address=request.headers.get("CF-Connecting-IP");if(!address)return reply({error:"Request source unavailable."},403);
  try{
   const ip=await sha("vault:limit:"+env.TURNSTILE_SECRET+":"+address);
   const date=new Date().toISOString().slice(0,10);
   const check=await env.DB.prepare("INSERT INTO deck_share_limits(ip_hash,day,attempts) VALUES(?,?,1) ON CONFLICT(ip_hash,day) DO UPDATE SET attempts=attempts+1 WHERE attempts<5 RETURNING attempts").bind(ip,date).first();
   if(!check)return reply({error:"Daily vault creation limit reached."},429);
   const id=hex(crypto.getRandomValues(new Uint8Array(16))),secret=hex(crypto.getRandomValues(new Uint8Array(32)));
   const key="dcvault1_"+id+"_"+secret;
   await env.DB.prepare("INSERT INTO deck_vaults(id,token_hash,content) VALUES(?,?,?)").bind(id,await sha(key),JSON.stringify(deck)).run();
   return reply({ok:true,key,message:"Save your recovery key securely."},201);
  }catch(e){console.error("Create vault failed",e);return reply({error:"Unable to create vault."},503)}
 }
 if(action!=="load"&&action!=="save")return reply({error:"Unknown operation."},400);
 const parsed=parseKey(data.key);if(!parsed)return reply({error:"Invalid recovery key."},400);
 try{
  const row=await env.DB.prepare("SELECT token_hash,content FROM deck_vaults WHERE id=?").bind(parsed.id).first();
  const digest=await sha(data.key);
  if(!row||row.token_hash!==digest)return reply({error:"Recovery key not found."},404);
  if(action==="load")return reply({ok:true,deck:JSON.parse(row.content)});
  const deck=validDeck(data.deck);if(!deck)return reply({error:"Invalid deck list."},400);
  await env.DB.prepare("UPDATE deck_vaults SET content=?,updated_at=datetime('now') WHERE id=?").bind(JSON.stringify(deck),parsed.id).run();
  return reply({ok:true,message:"Vault updated."});
 }catch(e){console.error("Vault operation failed",e);return reply({error:"Unable to access the vault right now."},503)}
}
