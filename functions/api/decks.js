// Private-by-unguessable-link deck snapshots. No accounts; treat shared URLs as viewable by anyone who has them.
const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
async function sha(value){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))))}
function cleanDeck(input){
 if(!input||typeof input!=="object"||!Array.isArray(input.cards)||!Array.isArray(input.commanders))return null;
 const names=input.commanders.filter(x=>typeof x==="string"&&x.length>=2&&x.length<=130).slice(0,2);
 const cards=input.cards.map(x=>({name:String(x?.name||"").trim(),qty:Number(x?.qty)}));
 if(!names.length||cards.length>250||cards.some(x=>x.name.length<2||x.name.length>130||!Number.isInteger(x.qty)||x.qty<1||x.qty>250)||cards.reduce((n,x)=>n+x.qty,0)>250)return null;
 const title=String(input.title||"Deep Cuts Commander deck").trim().slice(0,90);
 return {title,commanders:names,cards,targetBracket:Math.max(1,Math.min(5,Number(input.targetBracket)||2))};
}
function sameOrigin(req){
 const val=req.headers.get("Origin");if(!val)return true;
 try{return new URL(val).host===new URL(req.url).host}catch{return false}
}
export async function onRequestGet({request,env}){
 const id=new URL(request.url).searchParams.get("id")||"";
 if(!/^[a-f0-9]{32}$/.test(id))return out({error:"Invalid share link."},400);
 if(!env.DB)return out({error:"Cloud storage unavailable."},503);
 try{
  const row=await env.DB.prepare("SELECT content,updated_at FROM shared_decks WHERE id=?").bind(id).first();
  if(!row)return out({error:"Deck link not found."},404);
  return out({ok:true,deck:JSON.parse(row.content),updatedAt:row.updated_at,readOnly:true});
 }catch(e){console.error(e);return out({error:"Unable to load shared deck."},503)}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return out({error:"Origin rejected."},403);
 if(!env.DB||!env.TURNSTILE_SECRET)return out({error:"Cloud storage or abuse protection is not configured."},503);
 if(Number(request.headers.get("content-length")||0)>40000)return out({error:"Deck is too large."},413);
 let parsed;try{parsed=await request.json()}catch{return out({error:"Invalid JSON."},400)}
 if(JSON.stringify(parsed).length>40000)return out({error:"Deck is too large."},413);
 const deck=cleanDeck(parsed.deck);
 if(!deck)return out({error:"Enter a valid commander and card list before sharing."},400);
 const address=request.headers.get("CF-Connecting-IP")||"";
 if(!address)return out({error:"Unable to verify request origin."},403);
 try{
  const ip=await sha("deck-share-v1:"+env.TURNSTILE_SECRET+":"+address);
  const date=new Date().toISOString().slice(0,10);
  const quota=await env.DB.prepare("INSERT INTO deck_share_limits(ip_hash,day,attempts) VALUES(?,?,1) ON CONFLICT(ip_hash,day) DO UPDATE SET attempts=attempts+1 WHERE attempts<8 RETURNING attempts").bind(ip,date).first();
  if(!quota)return out({error:"Daily share limit reached. Try again tomorrow."},429);
  const id=hex(crypto.getRandomValues(new Uint8Array(16)));
  await env.DB.prepare("INSERT INTO shared_decks(id,edit_hash,content) VALUES(?,?,?)").bind(id,"",JSON.stringify(deck)).run();
  return out({ok:true,id,url:new URL("/deck.html?shared="+id,request.url).toString(),readOnly:true},201);
 }catch(e){console.error("Share failed",e);return out({error:"Unable to save share link."},503)}
}
