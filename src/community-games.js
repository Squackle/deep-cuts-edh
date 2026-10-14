import {notifyDeckVote} from "./field-dispatches.js";
import {send,fail,safe,rnd,cleanDeck} from "./community-core.js";
import {publicChallenge,featuredDeckEligible,isOpenChallenge} from "./featured-case.js";
export async function gamesWrite(db,a,d){
 const action=d.action;
 if(action==="publish_deck"){
  const deck=cleanDeck(d.deck),title=safe(d.title,90);
  if(!deck||title.length<3)return fail("Enter a valid deck and a title with at least three characters.",400);
  const id=rnd();
  await db.batch([
   db.prepare("INSERT INTO community_decks(id,owner_id,title,commander,content) VALUES(?,?,?,?,?)").bind(id,a.id,title,deck.commanders.join(" & "),JSON.stringify(deck)),
   db.prepare("INSERT INTO community_deck_versions(deck_id,version,content,note) VALUES(?,?,?,?)").bind(id,1,JSON.stringify(deck),"Initial publication")
  ]);
  return send({ok:true,id},201);
 }
 if(action==="version"){
  const id=safe(d.id,32),deck=cleanDeck(d.deck),note=safe(d.note,180);
  if(!deck)return fail("Deck contents are invalid.",400);
  const old=await db.prepare("SELECT owner_id,version FROM community_decks WHERE id=?").bind(id).first();
  if(!old||old.owner_id!==a.id)return fail("Only the owner can update this deck.",403);
  if(old.version>=50)return fail("Version history is full.",409);
  const v=old.version+1;
  const result=await db.prepare("UPDATE community_decks SET content=?,commander=?,version=version+1,updated_at=datetime('now') WHERE id=? AND owner_id=? AND version=?").bind(JSON.stringify(deck),deck.commanders.join(" & "),id,a.id,old.version).run();
  if(!result.meta?.changes)return fail("Deck changed; reload and try again.",409);
  await db.prepare("INSERT INTO community_deck_versions(deck_id,version,content,note) VALUES(?,?,?,?)").bind(id,v,JSON.stringify(deck),note).run();
  return send({ok:true,version:v});
 }
 if(action==="playtest"){
  const id=safe(d.deck_id,32),commander=safe(d.commander,130),opponent=safe(d.opponent,70),result=safe(d.result,8),turns=Number(d.turns),note=safe(d.note,320);
  if(commander.length<3||opponent.length<2||!["win","loss","draw"].includes(result)||!Number.isInteger(turns)||turns<1||turns>60)return fail("Enter commander, opponent strategy, result and turns (1–60).",400);
  if(id&&!(await db.prepare("SELECT id FROM community_decks WHERE id=?").bind(id).first()))return fail("Deck not found.",404);
  await db.prepare("INSERT INTO community_playtests(id,author_id,deck_id,commander,opponent,result,turns,note) VALUES(?,?,?,?,?,?,?,?)").bind(rnd(),a.id,id||null,commander,opponent,result,turns,note).run();
  return send({ok:true},201);
 }
 if(action==="challenge_entry"||action==="vote"){
  const id=safe(d.deck_id,32),challengeId=safe(d.challenge_id,48);
  if(!/^[a-f0-9]{32}$/.test(id)||!/^[a-z0-9-]{3,48}$/.test(challengeId))return fail("Choose a valid published deck and challenge.",400);
  const rawChallenge=await db.prepare("SELECT * FROM community_challenges WHERE id=? AND status='active'").bind(challengeId).first();
  const ch=publicChallenge(rawChallenge);
  const now=new Date().toISOString().slice(0,19).replace("T"," ");
  if(!ch||now<ch.opens_at||now>ch.closes_at)return fail("This challenge isn't accepting entries or votes.",409);
  if(action==="challenge_entry"){
   const deck=await db.prepare("SELECT owner_id,commander,content FROM community_decks WHERE id=?").bind(id).first();
   if(!deck||deck.owner_id!==a.id)return fail("Choose one of your own published decks.",400);
   if(!isOpenChallenge(ch)&&!featuredDeckEligible(deck))return fail("The featured challenge only accepts decks with "+ch.commander+" as their sole commander. Use Open Build for other commanders.",400);
   await db.prepare("INSERT INTO community_entries(challenge_id,deck_id,member_id) VALUES(?,?,?) ON CONFLICT(challenge_id,member_id) DO UPDATE SET deck_id=excluded.deck_id").bind(ch.id,id,a.id).run();
   return send({ok:true});
  }
  const entry=await db.prepare("SELECT e.member_id,d.commander,d.content FROM community_entries e JOIN community_decks d ON d.id=e.deck_id WHERE e.challenge_id=? AND e.deck_id=?").bind(ch.id,id).first();
  if(entry&&!isOpenChallenge(ch)&&!featuredDeckEligible(entry))return fail("This entry no longer matches the current featured commander.",409);
  if(!entry||entry.member_id===a.id)return fail("Cannot vote for your own deck or a missing entry.",400);
  const existing=await db.prepare("SELECT deck_id FROM community_votes WHERE challenge_id=? AND voter_id=?").bind(ch.id,a.id).first();
  await db.prepare("INSERT INTO community_votes(challenge_id,voter_id,deck_id) VALUES(?,?,?) ON CONFLICT(challenge_id,voter_id) DO UPDATE SET deck_id=excluded.deck_id").bind(ch.id,a.id,id).run();
  if(existing?.deck_id!==id)try{await notifyDeckVote(db,a,id,ch.id)}catch(e){console.error("Challenge dispatch skipped",String(e?.name||"error"))}
  return send({ok:true});
 }
 return fail("Unknown game operation.",404);
}
