import {state} from "./community.js";
const $=id=>document.getElementById(id);
const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!=null)el.textContent=String(value);if(cls)el.className=cls;return el};
const card=(name,value)=>{const box=node("div",null,"passport-stat");box.append(node("strong",String(value)),node("span",name));return box};
let nonce=0;
async function json(url,headers){
 const r=await fetch(url,{cache:"no-store",credentials:"same-origin",headers});
 const d=await r.json().catch(()=>null);
 if(!r.ok||!d)throw Error(d?.error||"Your field records are temporarily unavailable.");
 return d;
}
async function refresh(){
 const seq=++nonce,p=state.me,stats=$("passportStats"),awards=$("passportAwards"),status=$("passportStatus");
 if(!stats||!awards||!status)return;
 if(!p){stats.replaceChildren();awards.replaceChildren();status.textContent="Sign in to see your field records.";return}
 status.textContent="Checking verified records for @"+p.handle+"…";
 const headers={};if(state.key)headers.Authorization="Bearer "+state.key;
 try{
  const [passport,results]=await Promise.all([
   json("/api/community?action=passport",headers),
   json("/api/daily-games?action=badges&handle="+encodeURIComponent(p.handle),{})
  ]);
  if(seq!==nonce||state.me?.handle!==p.handle)return;
  if(!passport.verifiedSource||!Array.isArray(results.badges))throw Error("Verified record data was unavailable.");
  const all=[...(passport.games?.daily||[]),...(passport.games?.arcane||[])];
  const completed=all.reduce((n,r)=>n+Math.max(0,Number(r.completed)||0),0);
  const wins=all.reduce((n,r)=>n+Math.max(0,Number(r.won)||0),0);
  const c=passport.community||{};
  stats.replaceChildren(
   card("Daily games completed",completed),
   card("Daily games solved",wins),
   card("Published decks",Number(c.publishedDecks)||0),
   card("Rescue entries",Number(c.challengeEntries)||0),
   card("Public findings",Number(c.visibleContributions)||0),
   card("Playtest logs",Number(c.playtests)||0)
  );
  awards.replaceChildren();
  if(!results.badges.length)awards.append(node("p","No verified game awards yet. Finish a daily puzzle while signed in to begin.","cm-note"));
  else for(const badge of results.badges.slice(0,24)){
   const item=node("article",null,"passport-award");
   item.append(node("strong",badge.title||"Investigator Award"));
   if(badge.detail)item.append(node("span",badge.detail));
   if(badge.awardedAt){
    const epoch=Number(badge.awardedAt);
    const date=new Date(epoch>100000000000?epoch:epoch*1000);
    if(Number.isFinite(date.getTime()))item.append(node("small","Earned "+date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})));
   }
   awards.append(item);
  }
  status.textContent="Passport updated from existing saved and verified records.";
 }catch(e){
  if(seq!==nonce)return;
  stats.replaceChildren();awards.replaceChildren();
  status.textContent=e?.message||"Passport data is temporarily unavailable.";
 }
}
window.addEventListener("deepcuts:profile-change",refresh);
window.addEventListener("pageshow",refresh);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});
else refresh();
