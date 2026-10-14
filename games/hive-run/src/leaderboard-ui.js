import {profileLink} from "./integration.js";
const el=(d,t,text,cls)=>{const x=d.createElement(t);if(text!==undefined)x.textContent=String(text);if(cls)x.className=cls;return x};
const ordinal=n=>{
 if(n%100>=11&&n%100<=13)return n+"TH";
 return n+(n%10===1?"ST":n%10===2?"ND":n%10===3?"RD":"TH");
};
export function renderLeaderboard(root,data){
 if(!root)return;
 const doc=root.ownerDocument;root.replaceChildren();
 const entries=Array.isArray(data?.entries)?data.entries.slice(0,10):[];
 if(!entries.length){root.append(el(doc,"p","NO HIGH SCORES YET — BE THE FIRST IN THE HIVE.","board-empty"));return}
 for(let i=0;i<entries.length;i++){
  const entry=entries[i],r=el(doc,"div",undefined,"board-row"+(entry.isYou?" is-you":""));
  r.append(el(doc,"span",ordinal(i+1),"rank"));
  const player=el(doc,"div",undefined,"board-player");
  player.append(el(doc,"strong",entry.alias||"???"));
  if(entry.rulesVersion&&entry.rulesVersion!==data.rulesVersion){
   const legacy=el(doc,"small","OLD","board-legacy");
   legacy.title="Verified score from an earlier Hive Run ruleset";
   player.append(legacy);
  }
  if(entry.profileVerified&&entry.profileHandle){
   const href=profileLink(entry.profileHandle);
   if(href){
    const a=el(doc,"a","↗","board-profile");
    a.href=href;a.target="_blank";a.rel="noopener noreferrer";
    a.title="View verified Field Network profile @"+entry.profileHandle;
    a.setAttribute?.("aria-label","View verified Field Network profile @"+entry.profileHandle);
    player.append(a);
   }
  }
  r.append(player);
  const score=el(doc,"div",undefined,"board-stat");
  score.append(el(doc,"strong",Number(entry.score||0).toLocaleString("en-US")));
  r.append(score);root.append(r);
 }
}
export function renderPersonalBest(root,data,localBest=0){
 if(!root)return;
 const verified=!!(data?.profile&&data?.personalBest);
 const value=verified?Number(data.personalBest.score||0):Math.max(0,Number(localBest)||0);
 const label=root.querySelector("#personalRecordContext");
 const score=root.querySelector("#personalRecordScore");
 const rank=root.querySelector("#personalRecordRank");
 const identity=root.querySelector("#personalRecordIdentity");
 root.classList?.toggle("is-ranked",verified);
 if(label)label.textContent=verified?"VERIFIED PERSONAL BEST":value>0?"LOCAL PERSONAL BEST":"YOUR PERSONAL BEST";
 if(score)score.textContent=value.toLocaleString("en-US").padStart(6,"0");
 if(rank)rank.textContent=verified?"RANK "+ordinal(Number(data.personalBest.position)):value>0?"LOCAL RECORD":"NOT RANKED";
 if(identity){
  identity.replaceChildren();
  if(verified){
   identity.append(el(root.ownerDocument,"span",String(data.personalBest.alias||"???")+" · ","personal-record-initials"));
   if(data.personalBest.rulesVersion&&data.personalBest.rulesVersion!==data.rulesVersion)
    identity.append(el(root.ownerDocument,"small","LEGACY RULES · ","personal-record-legacy"));
   const href=profileLink(data.profile.handle);
   if(href){
    const link=el(root.ownerDocument,"a","@"+data.profile.handle+" ↗","personal-record-account");
    link.href=href;link.target="_blank";link.rel="noopener noreferrer";
    identity.append(link);
   }
  }else{
   identity.textContent=data?.profile?
    "Only replay-verified submissions receive a rank. Local scores remain on this device.":
    "Saved on this device · Sign in and submit a replay to receive a rank.";
  }
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
