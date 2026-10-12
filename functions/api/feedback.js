/* User feedback intake for Deep Cuts EDH. Human verification + per-IP limits. */
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,"0")).join("");
function goodOrigin(req){const origin=req.headers.get("Origin");if(!origin)return true;try{return new URL(origin).host===new URL(req.url).host}catch{return false}}
export async function onRequestPost({request,env}){
 if(!goodOrigin(request))return reply({error:"Invalid submission origin."},403);
 if(!env.DB||!env.TURNSTILE_SECRET)return reply({error:"Feedback service unavailable."},503);
 if(Number(request.headers.get("content-length")||0)>7000)return reply({error:"Submission too large."},413);
 let x;try{x=await request.json()}catch{return reply({error:"Invalid form submission."},400)}
 if(!x||JSON.stringify(x).length>7000)return reply({error:"Submission too large."},413);
 const category=x.category,message=String(x.message||"").trim(),page=String(x.page||"/").trim().slice(0,160),token=String(x.token||"");
 if(!["bug","feature"].includes(category)||message.length<15||message.length>2000||token.length<5||token.length>2500)return reply({error:"Select a category and write 15–2000 characters."},400);
 if(!page.startsWith("/")||page.startsWith("//"))return reply({error:"Invalid page."},400);
 const ip=request.headers.get("CF-Connecting-IP");if(!ip)return reply({error:"Unable to validate request."},403);
 try{
  const verification=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token,remoteip:ip})});
  if(!verification.ok)return reply({error:"Human verification unavailable."},503);
  const valid=await verification.json(),host=new URL(request.url).hostname;
  if(!valid.success||valid.hostname!==host)return reply({error:"Please complete the verification challenge."},400);
  const iphash=await hash("deepcuts-feedback:"+env.TURNSTILE_SECRET+":"+ip),day=new Date().toISOString().slice(0,10);
  const quota=await env.DB.prepare("INSERT INTO feedback_limits(visitor_hash,day,count) VALUES(?,?,1) ON CONFLICT(visitor_hash,day) DO UPDATE SET count=count+1 WHERE count<5 RETURNING count").bind(iphash,day).first();
  if(!quota)return reply({error:"Daily feedback limit reached. Please return tomorrow."},429);
  await env.DB.prepare("INSERT INTO site_feedback(category,message,page) VALUES(?,?,?)").bind(category,message,page).run();
  return reply({ok:true,message:"Thanks—your feedback is in our review queue."},201);
 }catch(e){console.error("Feedback submission failed",e);return reply({error:"Could not save your feedback. Try again later."},503)}
}
