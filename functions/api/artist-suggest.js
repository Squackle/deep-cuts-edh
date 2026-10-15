/* Server-side cached Scryfall catalog, returned as <=8 ranked suggestions.
 * Never send the complete catalog to each visitor or query Scryfall per keypress.
 */
import {artistSuggestions} from "../../src/artist-search.js";
const SOURCE="https://api.scryfall.com/catalog/artist-names";
const TTL=12*60*60*1000;
let names=null,until=0,pending=null;
const json=(value,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{"Content-Type":"application/json; charset=utf-8",
  "Cache-Control":status===200?"public, max-age=120":"no-store",
  "X-Content-Type-Options":"nosniff"}
});
async function catalog(context){
 if(names&&Date.now()<until)return names;
 if(pending)return pending;
 pending=(async()=>{
  const cache=typeof caches==="undefined"?null:caches.default;
  const cacheKey=new Request(new URL("/__internal/artist-catalog-v1",context.request.url));
  if(cache){
   try{
    const previous=await cache.match(cacheKey);
    if(previous?.ok){
     const data=await previous.json();
     if(Array.isArray(data)&&data.length>=100){
      names=data;until=Date.now()+TTL;return names;
     }
    }
   }catch{}
  }
  try{
   const res=await fetch(SOURCE,{headers:{"Accept":"application/json","User-Agent":"DeepCutsEDH/1.0 (artist search; https://deep-cuts-edh.pages.dev)"},
    signal:AbortSignal.timeout(8500)});
   if(!res.ok)throw Error("Scryfall artist catalog unavailable");
   const body=await res.json();
   if(body?.object!=="catalog"||!Array.isArray(body.data)||body.data.length<100||body.data.length>40000)
    throw Error("Unexpected artist catalog");
   const safe=[...new Set(body.data.filter(n=>typeof n==="string"&&n.length>=2&&n.length<=100))];
   if(safe.length<100)throw Error("Artist catalog was incomplete");
   names=safe;until=Date.now()+TTL;
   if(cache){
    const saved=new Response(JSON.stringify(safe),{headers:{"Content-Type":"application/json",
      "Cache-Control":"public, max-age=43200"}});
    const store=cache.put(cacheKey,saved).catch(()=>{});
    if(context.waitUntil)context.waitUntil(store);
   }
   return names;
  }catch(error){
   if(names?.length){until=Date.now()+60*1000;return names}
   throw error;
  }
 })();
 try{return await pending}finally{pending=null}
}
export async function onRequestGet(context){
 const query=new URL(context.request.url).searchParams.get("q")||"";
 if(query.length>80)return json({error:"Search is too long."},400);
 if(query.trim().length<2)return json({suggestions:[]});
 try{
  const all=await catalog(context);
  return json({suggestions:artistSuggestions(all,query,8)});
 }catch{
  return json({error:"Artist suggestions are temporarily unavailable."},503);
 }
}
