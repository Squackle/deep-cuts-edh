import {state} from "./community.js";
const $=id=>document.getElementById(id);
const node=(tag,value,cls)=>{const el=document.createElement(tag);if(value!=null)el.textContent=String(value);if(cls)el.className=cls;return el};
const card=(name,value)=>{const box=node("div",null,"passport-stat");box.append(node("strong",String(value)),node("span",name));return box};
let nonce=0,active=null;
async function json(url,headers,signal){
 const r=await fetch(url,{cache:"no-store",credentials:"same-origin",headers,signal});
 const d=await r.json().catch(()=>null);
 if(!r.ok||!d)throw Error("Your field records are temporarily unavailable.");
 return d;
}
function count(value){
 if(typeof value!=="number"&&(typeof value!=="string"||!value.trim()))throw Error("Missing record count");
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)throw Error("Invalid record count");
 return n;
}
function renderStats(stats,passport){
 if(passport?.verifiedSource!==true||!Array.isArray(passport.games?.daily)||!Array.isArray(passport.games?.arcane))
  throw Error("Verified record data was unavailable.");
 const all=[...passport.games.daily,...passport.games.arcane];
 const completed=all.reduce((n,r)=>n+count(r?.completed),0);
 const wins=all.reduce((n,r)=>n+count(r?.won),0);
 if(wins>completed)throw Error("Invalid game record count");
 const c=passport.community||{};
 stats.replaceChildren(
  card("Daily games completed",completed),
  card("Daily games solved",wins),
  card("Published decks",count(c.publishedDecks)),
  card("Rescue entries",count(c.challengeEntries)),
  card("Public findings",count(c.visibleContributions)),
  card("Playtest logs",count(c.playtests))
 );
}
function renderAwards(awards,results){
 if(!Array.isArray(results?.badges)||results.badges.some(b=>!b||typeof b.title!=="string"||!b.title.trim()))
  throw Error("Verified award data was unavailable.");
 awards.replaceChildren();
 if(!results.badges.length)awards.append(node("p","No verified game awards yet. Finish a daily puzzle while signed in to begin.","cm-note"));
 else for(const badge of results.badges.slice(0,24)){
  const item=node("article",null,"passport-award");
  item.append(node("strong",badge.title));
  if(badge.detail)item.append(node("span",badge.detail));
  if(badge.awardedAt){
   const epoch=Number(badge.awardedAt);
   const date=new Date(epoch>100000000000?epoch:epoch*1000);
   if(Number.isFinite(date.getTime()))item.append(node("small","Earned "+date.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})));
  }
  awards.append(item);
 }
}
async function refresh(){
 const p=state.me,stats=$("passportStats"),awards=$("passportAwards"),status=$("passportStatus");
 if(!stats||!awards||!status)return;
 // pageshow and the profile event may arrive together; share the pending read.
 if(p&&active?.profile===p)return;
 const seq=++nonce;
 active?.controller.abort();active=null;
 // Never display the previous investigator's numbers while a new read is pending.
 stats.replaceChildren();awards.replaceChildren();
 if(!p){status.textContent="Sign in to see your field records.";return}
 const controller=new AbortController();
 active={profile:p,controller};
 const timer=setTimeout(()=>controller.abort(),12000);
 status.textContent="Checking verified records for @"+p.handle+"…";
 const headers={};if(state.key)headers.Authorization="Bearer "+state.key;
 try{
  const [passport,results]=await Promise.allSettled([
   json("/api/community?action=passport",headers,controller.signal),
   json("/api/daily-games?action=badges&handle="+encodeURIComponent(p.handle),{},controller.signal)
  ]);
  if(seq!==nonce||state.me!==p)return;
  let statsOk=false,awardsOk=false;
  if(passport.status==="fulfilled"){
   try{renderStats(stats,passport.value);statsOk=true}catch{/* unavailable, not zero */}
  }
  if(results.status==="fulfilled"){
   try{renderAwards(awards,results.value);awardsOk=true}catch{/* unavailable, not zero */}
  }
  if(!statsOk)stats.append(node("p","Verified statistics are temporarily unavailable.","cm-note"));
  if(!awardsOk)awards.append(node("p","Verified game awards are temporarily unavailable.","cm-note"));
  status.textContent=statsOk&&awardsOk?"Passport updated from existing saved and verified records."
   :statsOk||awardsOk?"Some verified records are temporarily unavailable. Available records are shown below."
   :"Your field records are temporarily unavailable. Try refreshing the page.";
 }finally{
  clearTimeout(timer);
  if(seq===nonce)active=null;
 }
}
window.addEventListener("deepcuts:profile-change",refresh);
window.addEventListener("pageshow",refresh);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh,{once:true});
else refresh();
