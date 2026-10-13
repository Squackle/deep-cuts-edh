// In-app notifications only. No email sending, tracking pixels or private data.
import {rnd,safe} from "./community-core.js";
const HANDLES=/@([A-Za-z][A-Za-z0-9_]{2,23})\b/g;
const kinds=new Set(["mention","deck_reply","case_update","follow","evidence_vote","challenge_vote","featured"]);
const localTarget=x=>typeof x==="string"&&/^community\.html\?(?:case|deck|profile|evidence)=[A-Za-z0-9_%-]+(?:&[A-Za-z0-9_%-]+)*$/.test(x)?x:"community.html#dispatches";
export async function createDispatch(db,recipient,actor,kind,headline,target,sourceId){
 if(!recipient||recipient===actor||!kinds.has(kind))return;
 try{
  await db.prepare("INSERT OR IGNORE INTO field_dispatches(id,recipient_id,actor_id,kind,headline,target,source_id) VALUES(?,?,?,?,?,?,?)")
   .bind(rnd(),recipient,actor||null,kind,safe(headline,170),localTarget(target),safe(sourceId,110)).run();
 }catch(e){console.error("Field dispatch write failed",String(e?.name||"error"))}
}
function mentions(text){
 const out=new Set();for(const m of String(text||"").matchAll(HANDLES)){if(m.index>0&&/[A-Za-z0-9_.]/.test(text[m.index-1]))continue;out.add(m[1]);if(out.size>=8)break}
 return [...out];
}
export async function notifyMentions(db,actor,text,target,sourceId,skip=[]){
 const handles=mentions(text);if(!handles.length)return;
 const q="SELECT id,handle FROM community_profiles WHERE handle COLLATE NOCASE IN ("+handles.map(()=>"?").join(",")+") LIMIT 8";
 const found=await db.prepare(q).bind(...handles).all();
 const hidden=new Set(skip);
 for(const p of found.results||[])if(!hidden.has(p.id))await createDispatch(db,p.id,actor.id,"mention","@"+actor.handle+" mentioned you",target,sourceId);
}
export async function notifyComment(db,actor,topic,body,sourceId){
 const isDeck=topic.startsWith("deck:"),target=isDeck?"community.html?deck="+topic.slice(5):"community.html?case="+topic.slice(5);
 let owner=null;
 if(isDeck){
  owner=await db.prepare("SELECT owner_id FROM community_decks WHERE id=?").bind(topic.slice(5)).first();
  if(owner)await createDispatch(db,owner.owner_id,actor.id,"deck_reply","@"+actor.handle+" left feedback on your deck",target,sourceId);
 }else{
  const watchers=await db.prepare("SELECT follower_id FROM community_follows WHERE target_type='commander' AND target=? AND follower_id<>? LIMIT 15").bind(topic.slice(5),actor.id).all();
  for(const p of watchers.results||[])await createDispatch(db,p.follower_id,actor.id,"case_update","New case evidence from @"+actor.handle,target,sourceId);
 }
 await notifyMentions(db,actor,body,target,sourceId,owner?[owner.owner_id]:[]);
}
export async function notifyEvidence(db,actor,item){
 const target="community.html?case="+item.case_slug+"&evidence="+item.id;
 const watchers=await db.prepare("SELECT follower_id FROM community_follows WHERE target_type='commander' AND target=? AND follower_id<>? LIMIT 15").bind(item.case_slug,actor.id).all();
 for(const p of watchers.results||[])await createDispatch(db,p.follower_id,actor.id,"case_update","@"+actor.handle+" filed a "+item.category+" finding",target,item.id);
 await notifyMentions(db,actor,item.title+" "+item.body,target,item.id);
}
export async function notifyNewFollow(db,actor,recipientId){
 await createDispatch(db,recipientId,actor.id,"follow","@"+actor.handle+" started following your investigations","community.html?profile="+encodeURIComponent(actor.handle),"follow:"+actor.id+":"+recipientId);
}
export async function notifyDeckVote(db,actor,deckId,challengeId){
 const row=await db.prepare("SELECT owner_id FROM community_decks WHERE id=?").bind(deckId).first();
 if(row)await createDispatch(db,row.owner_id,actor.id,"challenge_vote","Your Rescue Challenge deck received a vote","community.html?deck="+deckId,"vote:"+challengeId+":"+actor.id+":"+deckId);
}
