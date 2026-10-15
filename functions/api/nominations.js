import {findExistingNomination,nominationKey,editDistance} from "../../src/nomination-names.js";
const JSON_HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const normalized=s=>s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
const digest=async s=>{
  const data=new TextEncoder().encode(s);
  const arr=new Uint8Array(await crypto.subtle.digest("SHA-256",data));
  return Array.from(arr,x=>x.toString(16).padStart(2,"0")).join("");
};
// Scryfall is a best-effort spelling reference for brand-new commander nominations.
// Never treat an external fuzzy match as authoritative without a strong name match.
async function correctedCardName(input){
 try{
  const response=await fetch("https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(input),{
   headers:{"Accept":"application/json"},signal:AbortSignal.timeout(2500)
  });
  if(!response.ok)return input;
  const card=await response.json();
  const official=typeof card?.name==="string"?card.name.trim():"";
  if(!official||official.length>100)return input;
  const original=nominationKey(input),candidate=nominationKey(official);
  const limit=original.length<8?1:original.length<15?2:3;
  if(original===candidate||(
   editDistance(original,candidate,limit)<=limit&&
   editDistance(original,candidate,limit)/Math.max(original.length,5)<=0.18
  ))return official;
 }catch{/* Continue accepting community input if the external reference is unavailable. */}
 return input;
}
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
    const pending=await env.DB.prepare("SELECT COUNT(*) AS count FROM nominations WHERE status='pending'").first();
    const candidates=data.results.map(x=>({id:Number(x.id),name:x.name,votes:Number(x.votes)}));
    // Count both approved and pending nominations in the aggregate.
    const counted=await env.DB.prepare("SELECT COUNT(*) AS count FROM nomination_votes v JOIN nominations n ON n.id=v.nomination_id WHERE n.status IN ('pending','approved')").first();
    const total=Number(counted?.count||0);
    const leader=candidates.find(x=>x.votes>0)||null;
    return json({candidates,leader,pendingCount:Number(pending?.count||0),totalVotes:total,method:"Community nominations (moderated)"});
  }catch(e){console.error("Nominations GET failed",e);return json({error:"Unable to load nominations right now"},503)}
}
export async function onRequestPost({request,env}){
  if(!env.DB||!env.TURNSTILE_SECRET)return json({error:"Nominations are not enabled on this deployment yet."},503);
  const currentFlag=await env.DB.prepare("SELECT enabled FROM owner_feature_flags WHERE flag=?").bind("public_nominations").first();
  if(currentFlag?.enabled===0)return json({error:"New nominations and votes are temporarily paused. Please try later."},503);
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
    // Resolve accepted commander aliases BEFORE insertion. This prevents a separate
    // pending row from stealing votes from an approved community nominee.
    const active=await env.DB.prepare("SELECT id,slug,name,status FROM nominations WHERE status IN ('pending','approved') LIMIT 250").all();
    let match=findExistingNomination(name,active.results||[]);
    let canonicalName=name;
    if(!match){
      canonicalName=await correctedCardName(name);
      match=findExistingNomination(canonicalName,active.results||[]);
    }
    let target=match?.record||null;
    if(!target){
      const canonicalSlug=normalized(canonicalName);
      await env.DB.prepare(`
        INSERT OR IGNORE INTO nominations(slug,name,rationale,strategy,cards,budget,status)
        VALUES(?,?,?,?,?,?,'pending')
      `).bind(canonicalSlug,canonicalName,reason,strategy,cards,budget).run();
      target=await env.DB.prepare("SELECT id,name,status FROM nominations WHERE slug=?").bind(canonicalSlug).first();
    }
    if(!target||["rejected","retired","featured"].includes(target.status))return json({error:"This commander already has a Rescue Report or is not accepting votes."},409);
    const vote=await env.DB.prepare("INSERT OR IGNORE INTO nomination_votes(nomination_id,visitor_hash) VALUES(?,?)").bind(target.id,visitorHash).run();
    const count=await env.DB.prepare("SELECT COUNT(*) AS votes FROM nomination_votes WHERE nomination_id=?").bind(target.id).first();
    const recorded=!!vote.meta?.changes;
    const corrected=nominationKey(name)!==nominationKey(target.name);
    const credited=corrected?" Your vote was credited to "+target.name+".":"";
    return json({ok:true,name:target.name,status:target.status,votes:Number(count.votes),recorded,corrected,
      message:!recorded?"You already supported "+target.name+"; this vote was not counted twice.":target.status==="pending"?
      "Nomination saved! A new commander needs approval before appearing on the public board."+credited:
      "Nomination counted! The leaderboard has been updated."+credited},recorded?201:200);
  }catch(e){console.error("Nominations POST failed",e);return json({error:"Unable to save nomination. Please try again."},503)}
}
