const JSON_HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const normalized=s=>s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
const digest=async s=>{
  const data=new TextEncoder().encode(s);
  const arr=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
  return Array.from(arr,x=>x.toString(16).padStart(2,"0")).join("");
};
async function verifyHuman(token,secret,expectedHost,ip){
  if(!secret||!token)return false;
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({secret,response:token,remoteip:ip})
  });
  if(!r.ok)return false;
  const result=await r.json();
  return result.success===true&&result.hostname===expectedHost;
}
export async function onRequestGet({env}){
  if(!env.DB)return json({error:"Nominations database not configured"},503);
  try{
    const data=await env.DB.prepare(`
      SELECT n.id,n.name,COUNT(v.visitor_hash) AS votes
      FROM nominations n LEFT JOIN nomination_votes v ON v.nomination_id=n.id
      WHERE n.status='approved'
      GROUP BY n.id
      ORDER BY votes DESC, n.created_at ASC, n.id ASC
      LIMIT 50
    `).all();
    const candidates=data.results.map(x=>({id:Number(x.id),name:x.name,votes:Number(x.votes)}));
    const total=candidates.reduce((a,x)=>a+x.votes,0);
    const leader=candidates.find(x=>x.votes>0)||null;
    return json({candidates,leader,totalVotes:total,method:"Community nominations (moderated)"});
  }catch(e){console.error("Nominations GET failed",e);return json({error:"Unable to load nominations right now"},503)}
}
export async function onRequestPost({request,env}){
  if(!env.DB||!env.TURNSTILE_SECRET)return json({error:"Nominations are not enabled on this deployment yet."},503);
  const origin=request.headers.get("Origin");
  const host=new URL(request.url).hostname;
  if(origin&&new URL(origin).host!==new URL(request.url).host)return json({error:"Origin rejected"},403);
  const length=Number(request.headers.get("content-length")||0);
  if(length>5000)return json({error:"Submission too large"},413);
  let body;
  try{body=await request.json()}catch{return json({error:"Invalid JSON body"},400)}
  if(!body||typeof body!=="object"||JSON.stringify(body).length>5000)return json({error:"Submission too large"},413);
  const name=String(body.commander||"").trim().replace(/\s+/g," ");
  const reason=String(body.reason||"").trim();
  const strategy=String(body.strategy||"").trim();
  const cards=String(body.cards||"").trim();
  const budget=String(body.budget||"$100");
  const visitorId=String(body.visitorId||"");
  const challenge=String(body.turnstileToken||"");
  const slug=normalized(name);
  if(name.length<3||name.length>100||slug.length<3||slug.length>120||
     reason.length<10||reason.length>500||strategy.length>500||cards.length>200||
     !["$50","$100","$250","Any"].includes(budget)||!/^[-0-9a-f]{36}$/i.test(visitorId)||
     challenge.length>2500)return json({error:"Please check the nomination form."},400);
  const ip=request.headers.get("CF-Connecting-IP");
  if(!ip)return json({error:"Unable to verify request source"},403);
  try{
    const human=await verifyHuman(challenge,env.TURNSTILE_SECRET,host,ip);
    if(!human)return json({error:"Human verification failed. Please try again."},403);
    const salt=env.TURNSTILE_SECRET;
    const visitorHash=await digest("visitor:"+salt+":"+visitorId);
    const ipHash=await digest("rate:"+salt+":"+ip);
    const day=new Date().toISOString().slice(0,10);
    const limit=await env.DB.prepare(`
      INSERT INTO nomination_limits(ip_hash,date_key,attempts) VALUES(?,?,1)
      ON CONFLICT(ip_hash,date_key) DO UPDATE SET attempts=attempts+1
      WHERE attempts < 12 RETURNING attempts
    `).bind(ipHash,day).first();
    if(!limit)return json({error:"Daily nomination limit reached. Try again tomorrow."},429);
    await env.DB.prepare(`
      INSERT OR IGNORE INTO nominations(slug,name,rationale,strategy,cards,budget,status)
      VALUES(?,?,?,?,?,?,'pending')
    `).bind(slug,name,reason,strategy,cards,budget).run();
    const target=await env.DB.prepare("SELECT id,name,status FROM nominations WHERE slug=?").bind(slug).first();
    if(!target||["rejected","retired"].includes(target.status))return json({error:"This nomination is not accepting new support."},409);
    const vote=await env.DB.prepare("INSERT OR IGNORE INTO nomination_votes(nomination_id,visitor_hash) VALUES(?,?)").bind(target.id,visitorHash).run();
    const count=await env.DB.prepare("SELECT COUNT(*) AS votes FROM nomination_votes WHERE nomination_id=?").bind(target.id).first();
    const recorded=!!vote.meta?.changes;
    return json({ok:true,name:target.name,status:target.status,votes:Number(count.votes),recorded,
      message:!recorded?"You already nominated this commander.":target.status==="pending"?
      "Nomination saved! A new commander needs approval before appearing on the public board.":
      "Nomination counted! The leaderboard has been updated."},recorded?201:200);
  }catch(e){console.error("Nominations POST failed",e);return json({error:"Unable to save nomination. Please try again."},503)}
}
