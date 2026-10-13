/* Field Network expansion: case evidence, collections, reputation and dispatches.
   All account mutation requires existing recovery-key/device-cookie auth. */
import {send,fail,auth,body,originOK,quota,safe,rnd,CASES} from "../../src/community-core.js";
import {getLeaderboard,getReputation} from "../../src/field-reputation.js";
import {notifyEvidence,createDispatch} from "../../src/field-dispatches.js";
import {ownerAuth} from "../../src/owner-access.js";
const CATEGORIES=new Set(["synergy","combo","budget","weakness","matchup"]);
const cardKey=x=>String(x||"").toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g,"");
const validCard=x=>typeof x==="string"&&x.trim().length>=2&&x.trim().length<=130&&!/[\u0000-\u001f]/.test(x);
const validId=x=>typeof x==="string"&&/^[a-f0-9]{32}$/.test(x);
const own=async(request,db)=>auth(request,db);
const parseEntries=items=>{
 if(!Array.isArray(items)||items.length<1||items.length>100)throw Error("Import between 1 and 100 card names per batch.");
 const found=new Map();
 for(const entry of items){
  if(!validCard(entry?.name))throw Error("A card name is invalid.");
  const name=entry.name.trim(),key=cardKey(name),qty=Number(entry.quantity??entry.qty);
  if(!key||key.length>130||!Number.isInteger(qty)||qty<1||qty>999)throw Error("Every card needs a valid name and quantity (1–999).");
  if(found.has(key))throw Error("Duplicate card: "+name+". Merge duplicate lines before import.");
  found.set(key,{name,key,qty});
 }
 return [...found.values()];
};
export async function onRequestGet({request,env}){
 if(!env.DB)return fail("Field Network database unavailable.",503);
 try{
  const u=new URL(request.url),action=u.searchParams.get("action")||"evidence";
  if(action==="evidence"){
   const slug=u.searchParams.get("case")||CASES[0];
   if(!CASES.includes(slug))return fail("Unknown case file.",400);
   const account=await own(request,env.DB);
   const sort=u.searchParams.get("sort")==="new"?"new":"top";
   const order=sort==="new"?"e.created_at DESC":"CASE WHEN e.status='featured' THEN 1 ELSE 0 END DESC, votes DESC, e.created_at DESC";
   const q=`SELECT e.id,e.case_slug,e.category,e.title,e.body,e.card_name,e.status,e.created_at,
     p.handle,p.bio_emoji,(SELECT COUNT(*) FROM field_evidence_votes v WHERE v.evidence_id=e.id) AS votes
     FROM field_evidence e JOIN community_profiles p ON p.id=e.author_id
     WHERE e.case_slug=? AND e.status IN ('active','featured') ORDER BY `+order+" LIMIT 75";
   const result=await env.DB.prepare(q).bind(slug).all();
   let mine=[];
   if(account){const votes=await env.DB.prepare("SELECT evidence_id FROM field_evidence_votes WHERE voter_id=? AND evidence_id IN (SELECT id FROM field_evidence WHERE case_slug=?)").bind(account.id,slug).all();mine=(votes.results||[]).map(x=>x.evidence_id)}
   return send({items:result.results||[],voted:mine,viewerId:account?.id||null,case:slug,sort});
  }
  if(action==="collection"){
   const account=await own(request,env.DB);if(!account)return fail("Sign in to view your private card collection.",401);
   const x=await env.DB.prepare("SELECT name,quantity,updated_at FROM field_collection WHERE profile_id=? ORDER BY name COLLATE NOCASE LIMIT 2500").bind(account.id).all();
   const summary=await env.DB.prepare("SELECT COUNT(*) AS distinct_cards,COALESCE(SUM(quantity),0) AS total_cards FROM field_collection WHERE profile_id=?").bind(account.id).first();
   return send({cards:x.results||[],summary,privacy:"Only your signed-in account can read your card collection."});
  }
  if(action==="dispatches"){
   const a=await own(request,env.DB);if(!a)return fail("Sign in to see your Field Dispatches.",401);
   const [items,count]=await Promise.all([
    env.DB.prepare("SELECT id,kind,headline,target,created_at,read_at FROM field_dispatches WHERE recipient_id=? ORDER BY created_at DESC LIMIT 60").bind(a.id).all(),
    env.DB.prepare("SELECT COUNT(*) AS unread FROM field_dispatches WHERE recipient_id=? AND read_at IS NULL").bind(a.id).first()]);
   return send({items:items.results||[],unread:Number(count?.unread||0)});
  }
  if(action==="leaderboard")return send(await getLeaderboard(env.DB));
  if(action==="reputation"){
   const handle=safe(u.searchParams.get("handle"),24);
   const p=await getReputation(env.DB,handle);
   return p?send({profile:p}):fail("Investigator not found.",404);
  }
  return fail("Unknown Field Network action.",404);
 }catch(e){console.error("field expansion GET",String(e?.name||"error"));return fail("Unable to load Field Network data.",503)}
}
async function cardDetails(names){
 const cards=[],missing=[];
 for(let start=0;start<names.length;start+=75){
  if(start)await new Promise(r=>setTimeout(r,650));
  const identifiers=names.slice(start,start+75).map(name=>({name}));
  const r=await fetch("https://api.scryfall.com/cards/collection",{
   method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json","User-Agent":"DeepCutsEDH-CommunityResearch/1.0 (https://deep-cuts-edh.pages.dev)"},
   body:JSON.stringify({identifiers}),signal:AbortSignal.timeout(12000)
  });
  if(!r.ok)throw Error("Scryfall temporarily unavailable ("+r.status+").");
  const data=await r.json();
  for(const c of data.data||[]){
   const oracle=(c.oracle_text||c.card_faces?.map(x=>x.oracle_text||"").join(" // ")||"").slice(0,950);
   cards.push({name:c.name,type:c.type_line||"",cmc:c.cmc||0,price:c.prices?.usd?Number(c.prices.usd):null,
    oracle,commanderLegal:c.legalities?.commander||"unknown",color_identity:c.color_identity||[],scryfall:c.scryfall_uri||""});
  }
  for(const x of data.not_found||[])missing.push(x.name||"Unknown card");
 }
 return {cards,missing,currency:"USD",note:"Scryfall's reference-printing USD prices are estimates, not guaranteed cheapest listings. Unknown cards and unpriced cards are excluded from totals."};
}
export async function onRequestPost({request,env}){
 if(!env.DB||!env.TURNSTILE_SECRET)return fail("Field Network unavailable.",503);
 if(!request.headers.get("Origin")||!originOK(request))return fail("Origin rejected.",403);
 let d;try{d=await body(request)}catch{return fail("Invalid request or payload too large.",400)}
 const action=String(d?.action||"");
 try{
  if(action==="feature_evidence"){
   const admin=await ownerAuth(request,env);
   if(admin.error)return admin.error;
   if(!validId(d.id)||!["active","featured","hidden"].includes(d.status))return fail("Invalid evidence or moderation status.",400);
   const previous=await env.DB.prepare("SELECT author_id,case_slug,status FROM field_evidence WHERE id=?").bind(d.id).first();
   if(!previous)return fail("Finding not found.",404);
   const r=await env.DB.prepare("UPDATE field_evidence SET status=? WHERE id=?").bind(d.status,d.id).run();
   if(d.status==="featured"&&previous.status!=="featured"){
    await createDispatch(env.DB,previous.author_id,null,"featured","Your case finding was featured by the Deep Cuts editors","community.html?case="+previous.case_slug+"&evidence="+d.id,"featured:"+d.id);
   }
   return send({ok:true,changed:r.meta?.changes||0});
  }
  const a=await own(request,env.DB);if(!a)return fail("Sign in to use this Field Network feature.",401);
  const caps={evidence_post:4,evidence_vote:35,evidence_withdraw:8,collection_import:35,collection_edit:80,collection_clear:3,dispatch_read:60,prices:25};
  if(!Object.hasOwn(caps,action))return fail("Unknown Field Network operation.",404);
  if(!await quota(env.DB,env,request,"field:"+action,caps[action],a))return fail("Daily limit reached. Try again tomorrow.",429);
  if(action==="evidence_post"){
   const caseSlug=String(d.case||""),category=String(d.category||""),title=safe(d.title,100),text=safe(d.body,1200),cardName=safe(d.cardName,130);
   if(!CASES.includes(caseSlug)||!CATEGORIES.has(category)||title.length<8||text.length<20||cardName.length>130)return fail("Provide a case, finding type, 8+ character title and 20+ character research note.",400);
   if(cardName&& !validCard(cardName))return fail("Invalid supporting card name.",400);
   const id=rnd();
   await env.DB.prepare("INSERT INTO field_evidence(id,author_id,case_slug,category,title,body,card_name) VALUES(?,?,?,?,?,?,?)").bind(id,a.id,caseSlug,category,title,text,cardName).run();
   try{await notifyEvidence(env.DB,a,{id,case_slug:caseSlug,category,title,body:text})}catch(e){console.error("Evidence notification skipped",String(e?.name||"error"))}
   return send({ok:true,id},201);
  }
  if(action==="evidence_vote"){
   if(!validId(d.id))return fail("Invalid finding.",400);
   const item=await env.DB.prepare("SELECT author_id,status FROM field_evidence WHERE id=?").bind(d.id).first();
   if(!item||item.status==="hidden")return fail("Finding not found.",404);
   if(item.author_id===a.id)return fail("You cannot endorse your own finding.",400);
   const old=await env.DB.prepare("SELECT 1 FROM field_evidence_votes WHERE evidence_id=? AND voter_id=?").bind(d.id,a.id).first();
   if(old)await env.DB.prepare("DELETE FROM field_evidence_votes WHERE evidence_id=? AND voter_id=?").bind(d.id,a.id).run();
   else {
    await env.DB.prepare("INSERT OR IGNORE INTO field_evidence_votes(evidence_id,voter_id) VALUES(?,?)").bind(d.id,a.id).run();
    await createDispatch(env.DB,item.author_id,a.id,"evidence_vote","@"+a.handle+" endorsed your case finding","community.html?case="+(await env.DB.prepare("SELECT case_slug FROM field_evidence WHERE id=?").bind(d.id).first()).case_slug+"&evidence="+d.id,"evidence:"+d.id+":"+a.id);
   }
   const tally=await env.DB.prepare("SELECT COUNT(*) AS total FROM field_evidence_votes WHERE evidence_id=?").bind(d.id).first();
   return send({ok:true,voted:!old,votes:tally.total});
  }
  if(action==="evidence_withdraw"){
   if(!validId(d.id))return fail("Invalid finding.",400);
   const r=await env.DB.prepare("UPDATE field_evidence SET status='hidden' WHERE id=? AND author_id=?").bind(d.id,a.id).run();
   return r.meta?.changes?send({ok:true}):fail("Only the author can withdraw a visible finding.",403);
  }
  if(action==="collection_import"){
   let entries;try{entries=parseEntries(d.cards)}catch(e){return fail(e.message,400)}
   const mode=d.mode==="replace"?"replace":"merge";
   if(mode!=="replace"){
    const total=await env.DB.prepare("SELECT COUNT(*) AS n FROM field_collection WHERE profile_id=?").bind(a.id).first();
    if(total.n+entries.length>2500)return fail("Collection limit is 2,500 distinct cards. Remove cards before importing more.",409);
   }
   const statements=[];
   if(mode==="replace")statements.push(env.DB.prepare("DELETE FROM field_collection WHERE profile_id=?").bind(a.id));
   for(const item of entries)statements.push(env.DB.prepare("INSERT INTO field_collection(profile_id,name_key,name,quantity,updated_at) VALUES(?,?,?,?,unixepoch()) ON CONFLICT(profile_id,name_key) DO UPDATE SET name=excluded.name,quantity=excluded.quantity,updated_at=unixepoch()").bind(a.id,item.key,item.name,item.qty));
   await env.DB.batch(statements);
   return send({ok:true,processed:entries.length,mode});
  }
  if(action==="collection_edit"){
   const name=safe(d.name,130),key=cardKey(name),qty=Number(d.quantity);
   if(!validCard(name)||!key||!Number.isInteger(qty)||qty<0||qty>999)return fail("Enter a valid card and quantity from 0–999.",400);
   if(qty===0){
    await env.DB.prepare("DELETE FROM field_collection WHERE profile_id=? AND name_key=?").bind(a.id,key).run();
   }else{
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM field_collection WHERE profile_id=?").bind(a.id).first();
    const exists=await env.DB.prepare("SELECT 1 FROM field_collection WHERE profile_id=? AND name_key=?").bind(a.id,key).first();
    if(count.n>=2500&&!exists)return fail("2,500-card collection limit reached.",409);
    await env.DB.prepare("INSERT INTO field_collection(profile_id,name_key,name,quantity,updated_at) VALUES(?,?,?,?,unixepoch()) ON CONFLICT(profile_id,name_key) DO UPDATE SET name=excluded.name,quantity=excluded.quantity,updated_at=unixepoch()").bind(a.id,key,name,qty).run();
   }
   return send({ok:true});
  }
  if(action==="collection_clear"){
   if(d.confirm!=="ERASE COLLECTION")return fail("Type ERASE COLLECTION to confirm.",400);
   await env.DB.prepare("DELETE FROM field_collection WHERE profile_id=?").bind(a.id).run();
   return send({ok:true});
  }
  if(action==="dispatch_read"){
   if(d.all===true)await env.DB.prepare("UPDATE field_dispatches SET read_at=unixepoch() WHERE recipient_id=? AND read_at IS NULL").bind(a.id).run();
   else if(validId(d.id))await env.DB.prepare("UPDATE field_dispatches SET read_at=unixepoch() WHERE recipient_id=? AND id=? AND read_at IS NULL").bind(a.id,d.id).run();
   else return fail("Select a dispatch or mark all as read.",400);
   return send({ok:true});
  }
  if(action==="prices"){
   if(!Array.isArray(d.names)||d.names.length>150||d.names.length<1)return fail("Request 1–150 card names.",400);
   const names=[...new Map(d.names.map(x=>{if(!validCard(x))throw Error("Invalid card name.");return [cardKey(x),x.trim()]})).values()];
   if(names.length>150)return fail("Too many unique cards.",400);
   try{return send(await cardDetails(names))}catch(e){console.error("Scryfall pricing error",String(e?.name||"error"));return fail("Card pricing unavailable. Try again later.",503)}
  }
 }catch(e){console.error("Field expansion POST error",String(e?.name||"error"));return fail("Unable to save Field Network data.",503)}
 return fail("Unknown action.",404);
}
