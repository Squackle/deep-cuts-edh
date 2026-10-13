import {send,fail,safe,auth,publicProfile,topicOK} from "./community-core.js";
export async function communityRead(req,db){
 const q=new URL(req.url).searchParams,action=q.get("action")||"home";
 if(action==="me"){const a=await auth(req,db);return a?send({profile:publicProfile(a)}):fail("Sign in with your profile recovery key.",401)}
 if(action==="profile"){
  const handle=safe(q.get("handle"),24);
  const p=await db.prepare("SELECT id,handle,bio,avatar,focus_x,focus_y,created_at FROM community_profiles WHERE handle=? COLLATE NOCASE").bind(handle).first();
  if(!p)return fail("Profile not found.",404);
  const decks=await db.prepare("SELECT id,title,commander,version,updated_at FROM community_decks WHERE owner_id=? ORDER BY updated_at DESC LIMIT 25").bind(p.id).all();
  const counts=await db.prepare("SELECT (SELECT COUNT(*) FROM community_comments WHERE author_id=? AND status='visible') comments,(SELECT COUNT(*) FROM community_playtests WHERE author_id=?) tests,(SELECT COUNT(*) FROM community_follows WHERE target_type='profile' AND target=?) followers").bind(p.id,p.id,p.id).first();
  const badges=[];
  if(counts.comments>0)badges.push("Case Contributor");
  if(counts.comments>=10)badges.push("Field Researcher");
  if(counts.tests>=3)badges.push("Playtest Investigator");
  if(decks.results.length)badges.push("Deck Brewer");
  return send({profile:publicProfile(p),decks:decks.results,counts,badges});
 }
 if(action==="comments"){
  const topic=safe(q.get("topic"),90);if(!topicOK(topic))return fail("Invalid discussion.",400);
  const r=await db.prepare("SELECT c.id,c.topic,c.kind,c.body,c.created_at,p.handle,p.avatar,p.focus_x,p.focus_y,(SELECT COUNT(*) FROM community_reactions r WHERE r.comment_id=c.id) likes FROM community_comments c JOIN community_profiles p ON p.id=c.author_id WHERE c.topic=? AND c.status='visible' ORDER BY c.created_at DESC LIMIT 60").bind(topic).all();
  return send({comments:r.results});
 }
 if(action==="decks"){
  const r=await db.prepare("SELECT d.id,d.title,d.commander,d.version,d.updated_at,p.handle,(SELECT COUNT(*) FROM community_comments c WHERE c.topic='deck:'||d.id AND c.status='visible') comments FROM community_decks d JOIN community_profiles p ON p.id=d.owner_id ORDER BY d.updated_at DESC LIMIT 45").all();
  return send({decks:r.results});
 }
 if(action==="deck"){
  const id=safe(q.get("id"),32);if(!/^[a-f0-9]{32}$/.test(id))return fail("Invalid deck.",400);
  const d=await db.prepare("SELECT d.*,p.handle FROM community_decks d JOIN community_profiles p ON p.id=d.owner_id WHERE d.id=?").bind(id).first();
  if(!d)return fail("Deck not found.",404);
  const versions=await db.prepare("SELECT version,note,created_at FROM community_deck_versions WHERE deck_id=? ORDER BY version DESC LIMIT 50").bind(id).all();
  return send({deck:{id:d.id,owner_id:d.owner_id,title:d.title,commander:d.commander,content:JSON.parse(d.content),version:d.version,handle:d.handle},versions:versions.results});
 }
 if(action==="version"){
  const id=safe(q.get("id"),32),version=Number(q.get("version"));
  if(!/^[a-f0-9]{32}$/.test(id)||!Number.isInteger(version)||version<1||version>50)return fail("Invalid deck version.",400);
  const r=await db.prepare("SELECT v.content,v.note,v.created_at FROM community_deck_versions v JOIN community_decks d ON d.id=v.deck_id WHERE v.deck_id=? AND v.version=?").bind(id,version).first();
  return r?send({version,deck:JSON.parse(r.content),note:r.note,created_at:r.created_at}):fail("Version not found.",404);
 }
 if(action==="challenges"){
  const sql="SELECT ch.id,ch.title,ch.commander,ch.format,ch.opens_at,ch.closes_at,(SELECT COUNT(*) FROM community_entries e WHERE e.challenge_id=ch.id) entrants FROM community_challenges ch WHERE ch.status='active' ORDER BY ch.opens_at DESC, ch.id ASC LIMIT 12";
  const r=await db.prepare(sql).all();
  return send({challenges:r.results||[]});
 }
 if(action==="challenge"){
  const id=safe(q.get("id"),48);
  if(id&&!/^[a-z0-9-]{3,48}$/.test(id))return fail("Invalid challenge.",400);
  const ch=id?await db.prepare("SELECT * FROM community_challenges WHERE id=? AND status='active'").bind(id).first():await db.prepare("SELECT * FROM community_challenges WHERE status='active' ORDER BY opens_at DESC LIMIT 1").first();
  if(!ch)return send({challenge:null,entries:[]});
  const r=await db.prepare("SELECT e.deck_id,d.title,d.commander,p.handle,(SELECT COUNT(*) FROM community_votes v WHERE v.challenge_id=e.challenge_id AND v.deck_id=e.deck_id) votes FROM community_entries e JOIN community_decks d ON d.id=e.deck_id JOIN community_profiles p ON p.id=e.member_id WHERE e.challenge_id=? ORDER BY votes DESC,d.title ASC LIMIT 50").bind(ch.id).all();
  return send({challenge:ch,entries:r.results||[]});
 }
 if(action==="tests"){
  const commander=safe(q.get("commander"),130);if(commander.length<3)return fail("Choose a commander.",400);
  const summary=await db.prepare("SELECT COUNT(*) games,SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) wins,SUM(CASE WHEN result='loss' THEN 1 ELSE 0 END) losses,ROUND(AVG(turns),1) avg_turns FROM community_playtests WHERE commander=? COLLATE NOCASE").bind(commander).first();
  const matches=await db.prepare("SELECT opponent,COUNT(*) games,SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) wins FROM community_playtests WHERE commander=? COLLATE NOCASE GROUP BY opponent ORDER BY games DESC LIMIT 12").bind(commander).all();
  const logs=await db.prepare("SELECT t.result,t.turns,t.opponent,t.note,t.created_at,p.handle FROM community_playtests t JOIN community_profiles p ON p.id=t.author_id WHERE t.commander=? COLLATE NOCASE ORDER BY t.created_at DESC LIMIT 12").bind(commander).all();
  return send({summary,matches:matches.results,logs:logs.results,note:"Community-submitted games are not independently verified."});
 }
 if(action==="follows"||action==="feed"){
  const a=await auth(req,db);if(!a)return fail("Sign in first.",401);
  if(action==="follows"){
   const r=await db.prepare("SELECT target_type,target FROM community_follows WHERE follower_id=? ORDER BY created_at DESC LIMIT 60").bind(a.id).all();
   return send({follows:r.results});
  }
  const r=await db.prepare("SELECT c.topic,c.body,c.kind,c.created_at,p.handle FROM community_comments c JOIN community_profiles p ON p.id=c.author_id WHERE c.status='visible' AND (EXISTS(SELECT 1 FROM community_follows f WHERE f.follower_id=? AND f.target_type='profile' AND f.target=p.id) OR EXISTS(SELECT 1 FROM community_follows f WHERE f.follower_id=? AND f.target_type='commander' AND c.topic='case:'||f.target)) ORDER BY c.created_at DESC LIMIT 30").bind(a.id,a.id).all();
  return send({activity:r.results});
 }
 if(action==="home"){
  const r=await db.prepare("SELECT c.topic,c.body,c.created_at,p.handle FROM community_comments c JOIN community_profiles p ON p.id=c.author_id WHERE c.status='visible' ORDER BY c.created_at DESC LIMIT 8").all();
  const counts=await db.prepare("SELECT (SELECT COUNT(*) FROM community_profiles) investigators,(SELECT COUNT(*) FROM community_decks) decks,(SELECT COUNT(*) FROM community_playtests) tests").first();
  return send({activity:r.results,counts});
 }
 return fail("Unknown action.",404);
}
