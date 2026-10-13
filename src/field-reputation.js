// Public contribution reputation: recomputed from actual records, no paid perks.
const metrics=`SELECT p.id,p.handle,
 (SELECT COUNT(*) FROM community_comments c WHERE c.author_id=p.id AND c.status='visible') AS comments,
 (SELECT COUNT(*) FROM community_decks d WHERE d.owner_id=p.id) AS decks,
 (SELECT COUNT(*) FROM community_playtests t WHERE t.author_id=p.id) AS games,
 (SELECT COUNT(*) FROM field_evidence e WHERE e.author_id=p.id AND e.status IN ('active','featured')) AS findings,
 (SELECT COUNT(*) FROM field_evidence_votes v JOIN field_evidence e ON e.id=v.evidence_id WHERE e.author_id=p.id AND e.status IN ('active','featured')) AS endorsements,
 (SELECT COUNT(*) FROM community_entries en WHERE en.member_id=p.id) AS challenges
 FROM community_profiles p`;
export function reputation(row){
 const comments=Number(row.comments||0),decks=Number(row.decks||0),
  games=Number(row.games||0),findings=Number(row.findings||0),
  endorsements=Number(row.endorsements||0),challenges=Number(row.challenges||0);
 // Cap each activity: spam volume cannot dominate; peer-supported findings carry more weight.
 const points=Math.min(20,comments)+Math.min(10,decks)*4+Math.min(30,games)*2+
  Math.min(20,findings)*5+Math.min(50,endorsements)*2+Math.min(10,challenges)*3;
 const rank=points>=200?"Master Archivist":points>=100?"Deck Surgeon":points>=40?"Hidden Gem Hunter":points>=10?"Field Agent":"Rookie Investigator";
 const badges=[];
 if(findings>=1)badges.push("🔎 Case Researcher");
 if(endorsements>=3)badges.push("💎 Hidden Gem Hunter");
 if(decks>=1)badges.push("📚 Deck Brewer");
 if(comments>=5)badges.push("🩺 Deck Doctor");
 if(games>=3)badges.push("🎲 Field Tester");
 if(challenges>=1)badges.push("🏅 Challenge Contender");
 if(findings>=5&&endorsements>=10)badges.push("📜 Senior Investigator");
 return {id:row.id,handle:row.handle,points,rank,badges,comments,decks,games,findings,endorsements,challenges};
}
export async function getLeaderboard(db){
 const result=await db.prepare(metrics+" ORDER BY p.created_at DESC LIMIT 500").all();
 const rows=(result.results||[]).map(reputation).sort((a,b)=>b.points-a.points||a.handle.localeCompare(b.handle));
 return {leaders:rows.slice(0,20),profileCount:rows.length,limit:500,note:"Ranks reward documented research, publishing and playtests. Counts are community-submitted, not proof of deck strength."};
}
export async function getReputation(db,handle){
 if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle))return null;
 const r=await db.prepare(metrics+" WHERE p.handle=? COLLATE NOCASE").bind(handle).first();
 return r?reputation(r):null;
}
