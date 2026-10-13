import {relevantSets,validCode,publicPreview,isoDay} from "../../src/set-watch.js";
/* Cloudflare Pages Function: automatically refreshed upcoming set calendar + revealed cards.
 * Data provenance: Scryfall public API. No rumors, scraping or hardcoded release calendar.
 */
const ROOT="https://api.scryfall.com";
const CACHE_TTL=4*60*60;
const json=(data,maxAge=300,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"public, max-age="+Math.min(maxAge,600)+", s-maxage="+maxAge,
  "X-Content-Type-Options":"nosniff"}
});
async function fromScryfall(path){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
 try{
  const r=await fetch(ROOT+path,{headers:{"Accept":"application/json","User-Agent":"DeepCutsEDH/1.0 (+https://deep-cuts-edh.pages.dev)","Cache-Control":"no-cache"},signal:controller.signal});
  if(r.status===404)return null;
  if(!r.ok)throw Error("Scryfall unavailable ("+r.status+")");
  return await r.json();
 }finally{clearTimeout(timer)}
}
export async function onRequestGet({request}){
 const u=new URL(request.url),code=String(u.searchParams.get("set")||"").toLowerCase();
 const pageNumber=Number(u.searchParams.get("page")||1);
 if(code&&!validCode(code))return json({error:"Invalid set code."},0,400);
 if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>8)return json({error:"Invalid page."},0,400);
 if(!code&&u.searchParams.has("page"))return json({error:"Select a set to page through cards."},0,400);
 const cache=typeof caches!=="undefined"?caches.default:null;
 const key=new Request(new URL("/api/set-previews"+(code?"?set="+code+"&page="+pageNumber:""),u.origin).toString());
 try{
  const existing=cache?await cache.match(key):null;
  if(existing)return existing;
 }catch{}
 try{
  const list=await fromScryfall("/sets");
  if(!Array.isArray(list?.data))throw Error("Set catalog temporarily unavailable.");
  const today=isoDay(new Date()),all=relevantSets(list.data,new Date());
  if(!code){
   const upcoming=all.filter(x=>x.upcoming).slice(0,15);
   const recent=all.filter(x=>!x.upcoming).reverse().slice(0,8);
   const result=json({updated_at:new Date().toISOString(),source:"Scryfall",upcoming,recent},CACHE_TTL);
   try{if(cache)await cache.put(key,result.clone())}catch{}
   return result;
  }
  const set=all.find(x=>x.code===code);
  if(!set)return json({error:"That set is outside the current preview window."},300,404);
  const search=new URLSearchParams({q:"set:"+code,unique:"cards",order:"set",dir:"asc",page:String(pageNumber)});
  const payload=await fromScryfall("/cards/search?"+search.toString());
  const cards=Array.isArray(payload?.data)?payload.data.map(x=>publicPreview(x,today)).filter(Boolean):[];
  const result=json({set,source:"Scryfall",cards,page:pageNumber,
    total_known:Number.isFinite(payload?.total_cards)?payload.total_cards:cards.length,
    has_more:!!payload?.has_more,updated_at:new Date().toISOString()},CACHE_TTL);
  try{if(cache)await cache.put(key,result.clone())}catch{}
  return result;
 }catch(e){
  console.error("Set Watch upstream failure:",e);
  return json({error:"Set data is temporarily unavailable. Try again shortly."},0,502);
 }
}
