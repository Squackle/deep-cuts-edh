/* Public, constrained Scryfall batch lookup for Deep Cut Finder and Binder to Brew.
   Reuses the existing Cloudflare D1 IP quota, no new tables and no private data stored. */
import {send,fail,body,originOK,quota} from "../../src/community-core.js";
export async function onRequestPost({request,env}){
 if(!env.DB||!env.TURNSTILE_SECRET)return fail("Card lookup unavailable.",503);
 if(!request.headers.get("Origin")||!originOK(request))return fail("Origin rejected.",403);
 let data;try{data=await body(request)}catch{return fail("Invalid or oversized request.",400)}
 const names=data?.names;
 if(!Array.isArray(names)||!names.length||names.length>75||names.some(x=>typeof x!=="string"||x.trim().length<2||x.length>130||/[\x00-\x1f]/.test(x)))return fail("Provide 1–75 valid card names.",400);
 const unique=[...new Map(names.map(x=>[x.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g,""),x.trim()])).values()];
 if(unique.some(x=>!x))return fail("Invalid card name.",400);
 if(!await quota(env.DB,env,request,"tool:card-batch",70))return fail("Card lookup limit reached for today. Please try tomorrow.",429);
 try{
  const response=await fetch("https://api.scryfall.com/cards/collection",{
   method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","User-Agent":"DeepCutsEDH-Tools/1.0 (https://deep-cuts-edh.pages.dev)"},
   body:JSON.stringify({identifiers:unique.map(name=>({name}))}),signal:AbortSignal.timeout(13000)});
  if(!response.ok)return fail("Card database unavailable. Try again shortly.",503);
  const parsed=await response.json();
  return send({cards:(parsed.data||[]).map(c=>({
   name:c.name,type_line:c.type_line||"",oracle_text:c.oracle_text||c.card_faces?.map(f=>f.oracle_text||"").join(" // ")||"",
   cmc:c.cmc||0,mana_cost:c.mana_cost||c.card_faces?.[0]?.mana_cost||"",
   color_identity:c.color_identity||[],legalities:{commander:c.legalities?.commander||"unknown"},
   prices:{usd:c.prices?.usd||null},scryfall_uri:c.scryfall_uri||"",
   image:c.image_uris?.normal||c.card_faces?.find(f=>f.image_uris?.normal)?.image_uris?.normal||"",
   keywords:c.keywords||[]
  })),missing:(parsed.not_found||[]).map(n=>n.name||"Unknown").slice(0,75),
   provenance:"Scryfall current card data; lookup is not a complete ban-list or rules engine."});
 }catch(e){console.error("Tool card batch lookup",String(e?.name||"error"));return fail("Card data unavailable. Try again.",503)}
}
