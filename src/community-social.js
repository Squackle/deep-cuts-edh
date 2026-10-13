import {send,fail,safe,rnd,hash,AVATARS,CASES,topicOK,verifyHuman,quota} from "./community-core.js";
export async function register(req,db,env,d){
 const handle=safe(d.handle,24),bio=safe(d.bio,240),avatar=safe(d.avatar,130);
 const x=Number(d.focusX??50),y=Number(d.focusY??30),zoom=Number(d.focusZoom??2.8);
 if(!Number.isInteger(x)||x<0||x>100||!Number.isInteger(y)||y<0||y>100||
    !Number.isFinite(zoom)||zoom<1.8||zoom>4.2)
  return fail("Portrait position or zoom is invalid.",400);
 if(!/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/.test(handle)||!AVATARS.includes(avatar))return fail("Handle must be 3–24 letters, digits or underscores; select a listed portrait.",400);
 if(!(await verifyHuman(env,d.token,req)))return fail("Human verification failed.",403);
 if(!(await quota(db,env,req,"register",3)))return fail("Daily registration limit reached.",429);
 const id=rnd(),key="dcprofile1_"+id+"_"+rnd(32);
 try{await db.prepare("INSERT INTO community_profiles(id,handle,key_hash,bio,avatar,focus_x,focus_y,focus_zoom) VALUES(?,?,?,?,?,?,?,?)").bind(id,handle,await hash(key),bio,avatar,x,y,zoom).run()}
 catch(e){if(String(e).includes("UNIQUE"))return fail("That handle is taken.",409);throw e}
 return send({ok:true,key,profile:{id,handle,bio,avatar,focus_x:x,focus_y:y,focus_zoom:zoom},warning:"Save this key. No password or email recovery exists. Premium memberships are separate."},201);
}
export async function socialWrite(db,a,d){
 const action=d.action;
 if(action==="update_profile"){
  const bio=safe(d.bio,240),avatar=safe(d.avatar,130);if(!AVATARS.includes(avatar))return fail("Choose a listed portrait.",400);
  const x=Number(d.focusX),y=Number(d.focusY),zoom=Number(d.focusZoom??2.8);
  if(!Number.isInteger(x)||x<0||x>100||!Number.isInteger(y)||y<0||y>100||
     !Number.isFinite(zoom)||zoom<1.8||zoom>4.2)return fail("Invalid portrait position or zoom.",400);
  await db.prepare("UPDATE community_profiles SET bio=?,avatar=?,focus_x=?,focus_y=?,focus_zoom=? WHERE id=?").bind(bio,avatar,x,y,zoom,a.id).run();return send({ok:true});
 }
 if(action==="comment"){
  const topic=safe(d.topic,90),kind=d.kind==="doctor"?"doctor":"discussion",body=safe(d.body,1200);
  if(!topicOK(topic)||body.length<5)return fail("A valid discussion and 5–1200 characters are required.",400);
  if(topic.startsWith("deck:")&&!(await db.prepare("SELECT id FROM community_decks WHERE id=?").bind(topic.slice(5)).first()))return fail("Deck not found.",404);
  await db.prepare("INSERT INTO community_comments(id,author_id,topic,kind,body) VALUES(?,?,?,?,?)").bind(rnd(),a.id,topic,kind,body).run();return send({ok:true},201);
 }
 if(action==="react"){
  const id=safe(d.id,32);
  if(!(await db.prepare("SELECT id FROM community_comments WHERE id=? AND status='visible'").bind(id).first()))return fail("Comment not found.",404);
  const liked=!!(await db.prepare("SELECT 1 FROM community_reactions WHERE comment_id=? AND member_id=?").bind(id,a.id).first());
  if(liked)await db.prepare("DELETE FROM community_reactions WHERE comment_id=? AND member_id=?").bind(id,a.id).run();
  else await db.prepare("INSERT OR IGNORE INTO community_reactions(comment_id,member_id) VALUES(?,?)").bind(id,a.id).run();
  return send({ok:true,liked:!liked});
 }
 if(action==="follow"){
  const type=d.type==="profile"?"profile":d.type==="commander"?"commander":"",target=safe(d.target,130);
  if(!type)return fail("Unknown target.",400);
  if(type==="profile"){
   if(!/^[a-f0-9]{32}$/.test(target)||target===a.id)return fail("Invalid profile.",400);
   if(!(await db.prepare("SELECT id FROM community_profiles WHERE id=?").bind(target).first()))return fail("Profile not found.",404);
  }else if(!CASES.includes(target))return fail("Unknown case.",400);
  const following=!!(await db.prepare("SELECT 1 FROM community_follows WHERE follower_id=? AND target_type=? AND target=?").bind(a.id,type,target).first());
  if(following)await db.prepare("DELETE FROM community_follows WHERE follower_id=? AND target_type=? AND target=?").bind(a.id,type,target).run();
  else await db.prepare("INSERT OR IGNORE INTO community_follows(follower_id,target_type,target) VALUES(?,?,?)").bind(a.id,type,target).run();
  return send({ok:true,following:!following});
 }
 if(action==="report"){
  const id=safe(d.comment_id,32),reason=safe(d.reason,240);if(reason.length<10)return fail("Explain the report (10–240 characters).",400);
  const item=await db.prepare("SELECT id,author_id FROM community_comments WHERE id=? AND status='visible'").bind(id).first();
  if(!item||item.author_id===a.id)return fail("Comment cannot be reported.",400);
  await db.prepare("INSERT OR IGNORE INTO community_reports(id,reporter_id,comment_id,reason) VALUES(?,?,?,?)").bind(rnd(),a.id,id,reason).run();
  return send({ok:true,message:"Moderation report received."});
 }
 if(action==="delete_comment"){
  await db.prepare("UPDATE community_comments SET status='hidden' WHERE id=? AND author_id=?").bind(safe(d.id,32),a.id).run();return send({ok:true});
 }
 if(action==="delete_deck"){
  await db.prepare("DELETE FROM community_decks WHERE id=? AND owner_id=?").bind(safe(d.id,32),a.id).run();return send({ok:true});
 }
 if(action==="delete_profile"){
  if(d.confirm!=="DELETE MY PROFILE")return fail("Type DELETE MY PROFILE to confirm.",400);
  await db.prepare("DELETE FROM community_profiles WHERE id=?").bind(a.id).run();return send({ok:true});
 }
 return fail("Unknown social operation.",404);
}
