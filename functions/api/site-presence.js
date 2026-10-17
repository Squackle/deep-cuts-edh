/* Public, anonymous browser-presence leases for Deep Cuts EDH only.
 * A single random browser ID is shared across its tabs; no account or IP data.
 * Lease expiry is a connection-loss safeguard, NOT an inactivity threshold.
 */
const TTL_SECONDS=180;
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[47][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const PAGE_NAMES=new Set(["Home","Card Library","Deep Cut Finder","Tools & Resources","Combo Finder","Set Watch","Arcade","Hive Run","Daily Games","Community","Rescue Reports","Nominations","Member Profiles","Members Lounge","Supporters","Other"]);
export const publicReply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
export function allowedOrigin(request){
 const origin=request.headers.get("Origin");
 if(origin){try{if(new URL(origin).origin!==new URL(request.url).origin)return false}catch{return false}}
 return request.headers.get("Sec-Fetch-Site")!=="cross-site";
}
export async function countPresence(kv){
 if(!kv)throw Error("Presence unavailable");
 const pages={},seen=new Set();let cursor=null,scans=0;
 do{
  const result=await kv.list({prefix:"browser:",limit:1000,...(cursor?{cursor}:{})});
  for(const item of result.keys||[]){
   if(seen.has(item.name))continue;
   seen.add(item.name);
   const page=PAGE_NAMES.has(item.metadata?.page)?item.metadata.page:"Other";
   pages[page]=(pages[page]||0)+1;
  }
  cursor=result.list_complete?null:result.cursor;
  scans++;
 }while(cursor&&scans<10);
 return {online:seen.size,pages,approximate:true,truncated:!!cursor,updatedAt:new Date().toISOString()};
}
export async function onRequestGet({env}){
 try{
  const {online,updatedAt,approximate,truncated}=await countPresence(env.SITE_PRESENCE);
  return publicReply({online,updatedAt,approximate,truncated});
 }catch{return publicReply({error:"Online count unavailable."},503)}
}
export async function onRequestPost({request,env}){
 if(!env.SITE_PRESENCE)return publicReply({error:"Online count unavailable."},503);
 if(!allowedOrigin(request))return publicReply({error:"Same-origin requests only."},403);
 if(Number(request.headers.get("Content-Length")||0)>1024)return publicReply({error:"Payload too large."},413);
 let data;try{data=await request.json()}catch{return publicReply({error:"Invalid request."},400)}
 if(typeof data?.id!=="string"||!ID.test(data.id)||!PAGE_NAMES.has(data.page))return publicReply({error:"Invalid browser session or page."},400);
 try{
  await env.SITE_PRESENCE.put("browser:"+data.id,"1",{expirationTtl:TTL_SECONDS,metadata:{page:data.page}});
  return publicReply({ok:true});
 }catch{return publicReply({error:"Online count unavailable."},503)}
}
