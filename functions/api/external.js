// Public Commander Spellbook bridge. Only fixed upstream endpoints, no generic fetch proxy.
// Spellbook documents /card-list-from-url, /find-my-combos, /estimate-bracket.
// Keep requests sparse to respect the community-maintained service.
const BASE="https://backend.commanderspellbook.com";
const HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const result=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:HEADERS});
const validName=name=>typeof name==="string"&&name.length>0&&name.length<=130;
const allowedHosts=new Set(["moxfield.com","www.moxfield.com","archidekt.com","www.archidekt.com","deckstats.net","www.deckstats.net","tappedout.net","www.tappedout.net"]);
function sameOrigin(request){
 const value=request.headers.get("Origin");if(!value)return true;
 try{return new URL(value).host===new URL(request.url).host}catch{return false}
}
async function upstream(url,{method="GET",body}={}){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),18000);
 try{
  const response=await fetch(url,{method,signal:ctrl.signal,headers:{"Accept":"application/json","User-Agent":"DeepCutsEDH/1.1 (+https://deep-cuts-edh.pages.dev; Commander Spellbook integration)",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,redirect:"error"});
  if(!response.ok)throw new Error(response.status===429?"Combo service is busy; wait before retrying.":"Spellbook returned HTTP "+response.status+".");
  const len=Number(response.headers.get("content-length")||0);
  if(len>1_500_000)throw new Error("Upstream response too large");
  const txt=await response.text();if(txt.length>1_500_000)throw new Error("Upstream response too large");
  return JSON.parse(txt);
 }finally{clearTimeout(timeout)}
}
export async function onRequestPost({request,env}){
 if(!sameOrigin(request))return result({error:"Cross-origin submissions are not accepted."},403);
 if(Number(request.headers.get("content-length")||0)>20000)return result({error:"Deck request too large."},413);
 let input;try{input=await request.json()}catch{return result({error:"Invalid JSON."},400)}
 if(!input||typeof input!=="object"||JSON.stringify(input).length>20000)return result({error:"Deck request too large."},413);
 if(env?.DB&&env?.TURNSTILE_SECRET){
  const ip=request.headers.get("CF-Connecting-IP");if(!ip)return result({error:"Request source unavailable."},403);
  try{
   const bytes=new TextEncoder().encode("spellbook-proxy:"+env.TURNSTILE_SECRET+":"+ip);
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
   const date=new Date().toISOString().slice(0,10);
   const quota=await env.DB.prepare("INSERT INTO nomination_limits(ip_hash,date_key,attempts) VALUES(?,?,1) ON CONFLICT(ip_hash,date_key) DO UPDATE SET attempts=attempts+1 WHERE attempts<20 RETURNING attempts").bind(hash,date).first();
   if(!quota)return result({error:"Daily import/combo request limit reached."},429);
  }catch(e){console.error("Quota failed",e);return result({error:"Unable to verify rate limit."},503)}
 }
 if(input.action==="import"){
  let url;try{url=new URL(input.url)}catch{return result({error:"Enter a valid public deck URL."},400)}
  if(url.protocol!=="https:"||!allowedHosts.has(url.hostname)||url.username||url.password)return result({error:"Supported URL sites: Moxfield, Archidekt, Deckstats, and TappedOut."},400);
  try{
   const data=await upstream(BASE+"/card-list-from-url?url="+encodeURIComponent(url.toString()));
   return result({ok:true,source:url.hostname,data});
  }catch(e){console.error("Deck source import",e);return result({error:"Unable to import this deck. It may be private or its host may block retrieval. Paste/export its text instead. "+e.message},502)}
 }
 if(input.action!=="combos")return result({error:"Unknown operation."},400);
 const raw=input.deck||{};
 const cmd=Array.isArray(raw.commanders)?raw.commanders.filter(validName).slice(0,2):[];
 const cards=Array.isArray(raw.cards)?raw.cards:[],
   safe=cards.filter(x=>validName(x.name)&&Number.isInteger(Number(x.qty))&&Number(x.qty)>0&&Number(x.qty)<=250).slice(0,250);
 if(!cmd.length||safe.length!==cards.length||safe.reduce((a,x)=>a+Number(x.qty),0)>250)return result({error:"Provide a commander and a valid deck (up to 250 cards)."},400);
 const payload={commanders:cmd.map(card=>({card,quantity:1})),main:safe.map(x=>({card:x.name,quantity:Number(x.qty)}))};
 try{
  const [combo,bracket]=await Promise.allSettled([
   upstream(BASE+"/find-my-combos",{method:"POST",body:payload}),
   upstream(BASE+"/estimate-bracket",{method:"POST",body:payload})
  ]);
  if(combo.status!=="fulfilled"&&bracket.status!=="fulfilled")return result({error:"Combo service is unavailable right now. Please try again later."},503);
  return result({ok:true,combo:combo.status==="fulfilled"?combo.value:null,bracket:bracket.status==="fulfilled"?bracket.value:null,
    warnings:[combo.status!=="fulfilled"?"Combo lookups unavailable.":null,bracket.status!=="fulfilled"?"Bracket signals unavailable.":null].filter(Boolean),
    provider:"Commander Spellbook",source:"https://commanderspellbook.com/"});
 }catch(e){return result({error:"Spellbook is temporarily unavailable."},502)}
}
