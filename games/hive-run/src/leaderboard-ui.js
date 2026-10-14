import {profileLink} from "./integration.js";
const el=(d,t,text,cls)=>{const x=d.createElement(t);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
export function renderLeaderboard(root,data){
 if(!root)return;
 const doc=root.ownerDocument;root.replaceChildren();
 const entries=Array.isArray(data?.entries)?data.entries:[];
 if(!entries.length){root.append(el(doc,"p","No ranked runs yet. The first verified replay takes the lead!","board-empty"));return}
 for(let i=0;i<entries.length;i++){
  const row=entries[i],r=el(doc,"div",undefined,"board-row");
  r.append(el(doc,"span",String(i+1).padStart(2,"0"),"rank"));
  const player=el(doc,"div",undefined,"board-player");
  player.append(el(doc,"strong",row.alias||"Anonymous Hunter"));
  // A guest-entered handle is not account ownership. Link verified profiles only.
  if(row.profileVerified&&row.profileHandle){
   const href=profileLink(row.profileHandle);
   if(href){
    const a=el(doc,"a","↗ @"+row.profileHandle+" · VERIFIED","board-profile");
    a.href=href;a.target="_blank";a.rel="noopener noreferrer";
    a.title="Verified Field Network account linked through sign-in.";
    player.append(a);
   }
  }
  r.append(player);
  const stats=el(doc,"div",undefined,"board-stat");
  stats.append(el(doc,"strong",Number(row.score||0).toLocaleString()));
  stats.append(el(doc,"small",(data.mode==="classic"?"BROOD TRAIL":Number(row.kills||0)+" CAPTURES")+" · "+Number(row.evolutions||0)+" EVO"));
  r.append(stats);root.append(r);
 }
}
export function updateSubmission(panel,run,ranked){
 if(!panel)return;
 panel.hidden=!run||!["over","won"].includes(run.status);
 if(!panel.hidden){
  panel.querySelector(".submit-explanation").textContent=ranked?
   "Enter exactly three initials. The server verifies your replay and automatically links your signed-in profile.":
   "Practice run: server-verified ranking was unavailable when this game started.";
  panel.querySelector("button[type=submit]").disabled=!ranked;
 }
}
