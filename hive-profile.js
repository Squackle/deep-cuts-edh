
// Dossiers are discovered from persisted, server-verified Arcade evolution
// milestones, NOT unverified local claims or proof of defeating a boss.
export const HIVE_CODEX=Object.freeze([
 {id:"stalker",at:2,name:"BURROW STALKER",title:"THE AMBUSH BELOW",ability:"BURROW DASH",captures:2,tip:"Watch its marked escape tile. Close paths with your body."},
 {id:"warden",at:4,name:"HATCHERY WARDEN",title:"GUARDIAN OF THE BROOD",ability:"BROOD SEAL",captures:3,tip:"Keep a retreat lane around the sealing tiles."},
 {id:"weaver",at:6,name:"TUNNEL WEAVER",title:"THE SILKEN SNARE",ability:"WEB SNARE",captures:2,tip:"Avoid webbed tiles while closing the trap."},
 {id:"guardian",at:8,name:"RIFT GUARDIAN",title:"THE FRACTURED DEPTH",ability:"RIFT PULSE",captures:3,tip:"Watch the warning tiles and plan a path out."}
]);
export function discoveredDossiers(records){
 // Only the server-authorized /api/hive-profile response is passed here.
 const max=Math.max(0,...records.filter(x=>x.mode==="hunt").map(x=>Number(x.bestEvolution)||0));
 return HIVE_CODEX.map(x=>({...x,discovered:max>=x.at}));
}
export function appendHiveCodex(root,records){
 if(!root||root.id!=="ownProfile")return;
 const panel=document.createElement("section");panel.className="cm-paper hive-codex";
 const heading=document.createElement("h3");heading.textContent="HIVE CODEX · ENCOUNTER DOSSIERS";panel.append(heading);
 const intro=document.createElement("p");intro.className="cm-note";
 intro.textContent="Discover each boss by reaching its evolution milestone in a server-verified Predator Hunt Arcade run. Records persist on your profile. Discovery does not claim the boss was defeated.";
 panel.append(intro);
 for(const entry of discoveredDossiers(records)){
  const card=document.createElement("article");card.className="hive-codex-entry";
  const title=document.createElement("strong");title.textContent=entry.discovered?entry.name:"UNDISCOVERED · EVOLUTION "+entry.at;
  const status=document.createElement("p");status.className="cm-note";
  status.textContent=entry.discovered?"DISCOVERED · VERIFIED EVOLUTION "+entry.at:"LOCKED · REACH EVOLUTION "+entry.at+" IN RANKED PREDATOR HUNT";
  card.append(title,status);
  if(entry.discovered){
   const body=document.createElement("p");
   body.textContent=entry.title+" · "+entry.ability+" · "+entry.captures+" captures to defeat. "+entry.tip;
   card.append(body);
  }
  panel.append(card);
 }
 root.append(panel);
}
export async function attachHiveRecords(root,handle){
 const panel=document.createElement('section');panel.className='cm-paper';
 const heading=document.createElement('h3');heading.textContent='HIVE RUN · VERIFIED RECORDS';panel.append(heading);root.append(panel);
 try{
  const response=await fetch('/api/hive-profile?handle='+encodeURIComponent(handle),{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('unavailable');const data=await response.json();
  if(root.id==="ownProfile")appendHiveCodex(root,data.records);
  for(const record of data.records){const p=document.createElement('p');p.textContent=(record.mode==='classic'?'Brood Trail':'Predator Hunt')+' · '+String(record.rulesVersion||'legacy').replace('hive-','')+': '+Number(record.bestScore).toLocaleString()+' points · evolution '+record.bestEvolution+' in that run · '+record.rankedRuns+' ranked runs';panel.append(p)}
  if(!data.records.length){const p=document.createElement('p');p.className='cm-note';p.textContent='No verified Hive Run scores yet. Open the game on this site after signing in and remembering your device; earlier guest scores remain unverified.';panel.append(p)}
  const a=document.createElement('a');a.href='/games/hive-run/';a.textContent='ENTER THE HIVE ↗';panel.append(a);
 }catch{panel.remove()}
}
