/* Public, editorially approved showcase and opt-in supporter credits. */
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff"};
export async function onRequestGet({env}){
 if(!env.DB)return new Response(JSON.stringify({error:"Gallery unavailable"}),{status:503,headers});
 try{
  const rows=await env.DB.prepare("SELECT category,content,created_at FROM member_requests WHERE category IN ('showcase','credit') AND status='approved' ORDER BY created_at DESC LIMIT 30").all();
  return new Response(JSON.stringify({ok:true,entries:(rows.results||[]).map(r=>({category:r.category,description:String(r.content).slice(0,700),date:r.created_at}))}),{headers});
 }catch{return new Response(JSON.stringify({error:"Gallery unavailable"}),{status:503,headers})}
}
