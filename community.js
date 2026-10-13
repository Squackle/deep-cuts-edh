import {setupFeatures,refreshFeatures} from "./community-features.js";
export const $=id=>document.getElementById(id);
export const state={key:"",me:null,caseSlug:"chainer-dementia-master",deck:null,editing:"",myDecks:[]};
export const el=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined&&content!==null)n.textContent=String(content);if(cls)n.className=cls;return n};
export function clear(node){node.replaceChildren()}
export function msg(t,isError=false){const n=$("cmStatus");n.textContent=t||"";n.dataset.error=isError?"true":"false"}
export const avatarUrl=name=>"https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name)+"&format=image&version=normal";
export function badge(t){return el("span",t,"cm-tag")}
export function button(label,fn,outline=false){const n=el("button",label,"cm-btn"+(outline?" cm-outline":""));n.type="button";n.addEventListener("click",fn);return n}
export function link(label,url){const a=el("a",label);a.href=url;return a}
export async function api(action,q={}){
 const url=new URL("/api/community",location.href);url.searchParams.set("action",action);
 Object.entries(q).forEach(([k,v])=>url.searchParams.set(k,String(v)));
 const headers={};if(state.key)headers.Authorization="Bearer "+state.key;
 const r=await fetch(url,{headers,cache:"no-store"});const d=await r.json();
 if(!r.ok)throw Error(d.error||"Could not load data.");return d;
}
export async function write(d,useKey=true){
 const headers={"Content-Type":"application/json"};if(useKey&&state.key)headers.Authorization="Bearer "+state.key;
 const r=await fetch("/api/community",{method:"POST",headers,body:JSON.stringify(d)});
 const v=await r.json();if(!r.ok)throw Error(v.error||"Unable to save.");return v;
}
export async function attempt(task,success){try{const x=await task();if(success)msg(success);return x}catch(e){msg(e.message,true);return null}}
export function card(title,body,meta){
 const n=el("article",null,"cm-card"),h=el("header");h.append(el("strong",title),el("span",meta||"","cm-meta"));
 n.append(h,el("p",body||""));return n;
}
export function empty(target,text){clear(target);target.append(el("p",text,"cm-empty"))}
export function setTab(tab){
 const panels=document.querySelectorAll("[data-panel]");panels.forEach(n=>n.hidden=n.dataset.panel!==tab);
 document.querySelectorAll("[data-tab]").forEach(n=>n.setAttribute("aria-current",n.dataset.tab===tab?"page":"false"));
 history.replaceState(null,"",location.pathname+(tab==="cases"?"?case="+encodeURIComponent(state.caseSlug):"#"+tab));
 if(tab==="cases")loadCase();
 if(tab==="network")loadNetwork();
 if(["decks","challenge","lab"].includes(tab))refreshFeatures(tab);
 if(tab==="account")updateIdentity();
}
export function portrait(p){
 const n=el("div",null,"cm-portrait"),img=el("img");img.src=avatarUrl(p.avatar);img.alt="Commander portrait: "+p.avatar;img.loading="lazy";
 const text=el("div");text.append(el("h3",p.handle),el("p",p.bio||"No biography yet."));n.append(img,text);return n;
}
export function updateIdentity(){
 $("identitySummary").replaceChildren(state.me?portrait(state.me):el("p","No profile signed in."));
 $("accountLoggedOut").hidden=!!state.me;$("accountLoggedIn").hidden=!state.me;
 if(state.me){
  $("ownProfile").replaceChildren(portrait(state.me),el("p","Save your recovery key somewhere private. This profile is public; your credential is not.","cm-note"));
  $("editProfileForm").elements.bio.value=state.me.bio||"";
  $("editProfileForm").elements.avatar.value=state.me.avatar;
 }
}
export async function restore(){
 try{state.key=sessionStorage.getItem("dc-profile-key")||localStorage.getItem("dc-profile-key")||""}catch{}
 if(state.key){const res=await attempt(()=>api("me"));if(res?.profile)state.me=res.profile;else{state.key="";try{sessionStorage.removeItem("dc-profile-key");localStorage.removeItem("dc-profile-key")}catch{}}}
 updateIdentity();
}
export async function saveSession(key,remember=false){
 const previousKey=state.key;state.key=key;let data;try{data=await api("me")}catch(e){state.key=previousKey;throw e}state.me=data.profile;
 try{if(remember){localStorage.setItem("dc-profile-key",key);sessionStorage.removeItem("dc-profile-key")}else{sessionStorage.setItem("dc-profile-key",key);localStorage.removeItem("dc-profile-key")}}catch{}
 updateIdentity();msg("Signed in as "+state.me.handle+".");
 await reloadFollows();
}
async function reloadFollows(){if(!state.me)return;await attempt(()=>api("follows"))}
async function loadHome(){
 const x=await attempt(()=>api("home"));if(!x)return;
 $("countUsers").textContent=x.counts.investigators;
 $("countDecks").textContent=x.counts.decks;
 $("countTests").textContent=x.counts.tests;
}
export async function showComments(target,topic){
 if(!target)return;const x=await attempt(()=>api("comments",{topic}));if(!x)return;
 clear(target);
 if(!x.comments.length)return empty(target,"No evidence filed yet. You could be the first.");
 for(const c of x.comments){
  const n=card("@"+c.handle,c.body,c.created_at+(c.kind==="doctor"?" · Deck Doctor":""));
  const footer=el("div",null,"cm-actions");
  footer.append(button("♥ "+c.likes,async()=>{const r=await attempt(()=>write({action:"react",id:c.id}));if(r)showComments(target,topic)},true));
  footer.append(button("REPORT",async()=>{if(!state.me){msg("Sign in to report content.",true);return}const reason=prompt("Briefly explain what violates the community rules (10+ characters):");if(reason){const r=await attempt(()=>write({action:"report",comment_id:c.id,reason}),"Report sent to moderation.");if(r)msg("Report sent to moderation.")}},true));
  if(state.me?.handle===c.handle)footer.append(button("DELETE",async()=>{if(confirm("Hide your comment?")){const r=await attempt(()=>write({action:"delete_comment",id:c.id}));if(r)showComments(target,topic)}},true));
  n.append(footer);target.append(n);
 }
}
export async function loadCase(){
 const slug=state.caseSlug;$("caseSelect").value=slug;$("openReport").href="reports/"+slug+".html";
 await showComments($("caseComments"),"case:"+slug);
 const names={"chainer-dementia-master":"Chainer, Dementia Master","alena-and-gilanra":"Alena, Kessig Trapper","commander-mustard":"Commander Mustard","ekthi-contaminator-priest":"Ekthi, Contaminator Priest"};
 const tests=await attempt(()=>api("tests",{commander:names[slug]}));if(tests){const count=Number(tests.summary?.games||0);$("caseEvidence").textContent=count+" self-reported field test"+(count===1?"":"s")+" on record. Not independently verified.";}
 const f=state.me?await attempt(()=>api("follows")):null;
 const followed=f?.follows?.some(x=>x.target_type==="commander"&&x.target===slug);
 $("followCase").textContent=followed?"★ FOLLOWING CASE":"☆ FOLLOW THIS CASE";
}
async function loadNetwork(){
 if(!state.me){empty($("watchlist"),"Sign in to follow profiles and case files.");empty($("activityFeed"),"Your watchlist feed appears here.");return}
 const [f,x]=await Promise.all([attempt(()=>api("follows")),attempt(()=>api("feed"))]);
 if(f){clear($("watchlist"));if(!f.follows.length)empty($("watchlist"),"No follows yet.");
  f.follows.forEach(i=>{const n=card(i.target_type==="commander"?"Case file":"Investigator",i.target,i.target_type);n.append(button("UNFOLLOW",async()=>{const r=await attempt(()=>write({action:"follow",type:i.target_type,target:i.target}));if(r)loadNetwork()},true));$("watchlist").append(n)})}
 if(x){clear($("activityFeed"));if(!x.activity.length)empty($("activityFeed"),"No new activity from followed investigations.");
 x.activity.forEach(i=>{const n=card("@"+i.handle,i.body,i.created_at);n.append(link("OPEN DISCUSSION ↗",i.topic.startsWith("case:")?"community.html?case="+encodeURIComponent(i.topic.slice(5)):"community.html?deck="+i.topic.slice(5)));$("activityFeed").append(n)})}
}
async function showProfile(handle){
 const x=await attempt(()=>api("profile",{handle}));if(!x)return;
 const n=$("publicProfile");n.hidden=false;clear(n);n.append(portrait(x.profile));
 n.append(el("p",x.counts.comments+" findings · "+x.counts.tests+" playtests · "+x.counts.followers+" followers","cm-note"));
 for(const b of x.badges)n.append(badge(b));
 if(state.me&&state.me.id!==x.profile.id)n.append(button("FOLLOW / UNFOLLOW INVESTIGATOR",async()=>{const r=await attempt(()=>write({action:"follow",type:"profile",target:x.profile.id}));if(r)msg(r.following?"Following investigator.":"Unfollowed investigator.")}));
 x.decks.forEach(d=>n.append(el("p",null),link(d.title+" ↗","community.html?deck="+d.id)));
}
function bindAccount(){
 $("registerForm").addEventListener("submit",async ev=>{ev.preventDefault();const f=ev.currentTarget;
 const token=f.querySelector('input[name="cf-turnstile-response"]')?.value||"";
 const r=await attempt(()=>write({action:"register",handle:f.elements.handle.value,bio:f.elements.bio.value,avatar:f.elements.avatar.value,token},false));
 if(!r)return;
 $("newKeyBox").hidden=false;$("newKey").value=r.key;
 await saveSession(r.key,false);$("accountLoggedIn").prepend($("newKeyBox"));$("newKeyBox").hidden=false;$("newKeyBox").scrollIntoView({block:"center",behavior:"smooth"});
 window.turnstile?.reset();f.reset();msg("Profile created. Save the one-time recovery key displayed below.");
 });
 $("copyKey").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("newKey").value);msg("Recovery key copied. Save it privately.")}catch{msg("Select and copy the recovery key manually.",true)}});
 $("loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const key=f.elements.key.value.trim();const result=await attempt(()=>saveSession(key,f.elements.remember.checked));if(result!==null){f.reset();msg("Your profile is ready.")}});
 $("editProfileForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const r=await attempt(()=>write({action:"update_profile",bio:f.elements.bio.value,avatar:f.elements.avatar.value}),"Profile saved.");if(r){state.me.bio=f.elements.bio.value.trim();state.me.avatar=f.elements.avatar.value;updateIdentity()}});
 $("signOut").addEventListener("click",()=>{state.key="";state.me=null;try{sessionStorage.removeItem("dc-profile-key");localStorage.removeItem("dc-profile-key")}catch{}$("newKeyBox").hidden=true;updateIdentity();msg("Signed out on this device.")});
 $("deleteAccount").addEventListener("click",async()=>{const phrase=prompt("This permanently deletes your free community profile and all your public contributions. Type DELETE MY PROFILE to proceed.");if(phrase!=="DELETE MY PROFILE")return;const r=await attempt(()=>write({action:"delete_profile",confirm:phrase}));if(r){$("signOut").click();msg("Your community profile was deleted.")}});
}
function bindCases(){
 $("caseSelect").addEventListener("change",e=>{state.caseSlug=e.target.value;loadCase();history.replaceState(null,"",location.pathname+"?case="+state.caseSlug)});
 $("caseCommentForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const r=await attempt(()=>write({action:"comment",topic:"case:"+state.caseSlug,body:f.elements.body.value}),"Case note posted.");if(r){f.reset();loadCase()}});
 $("followCase").addEventListener("click",async()=>{const r=await attempt(()=>write({action:"follow",type:"commander",target:state.caseSlug}));if(r)loadCase()});
 $("findProfile").addEventListener("click",()=>showProfile($("profileSearch").value.trim()));
 $("profileSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();showProfile(e.target.value.trim())}});
}
async function boot(){
 document.querySelectorAll("[data-tab]").forEach(n=>n.addEventListener("click",()=>setTab(n.dataset.tab)));
 bindAccount();bindCases();setupFeatures();
 await restore();await loadHome();
 const p=new URL(location.href).searchParams;
 if(p.has("case")&&["chainer-dementia-master","alena-and-gilanra","commander-mustard","ekthi-contaminator-priest"].includes(p.get("case")))state.caseSlug=p.get("case");
 const tab=p.has("deck")||p.has("publish")?"decks":p.has("profile")?"network":location.hash.slice(1)||"cases";
 setTab(["cases","decks","challenge","lab","network","account"].includes(tab)?tab:"cases");
 if(p.has("profile")){$("profileSearch").value=p.get("profile");showProfile(p.get("profile"))}
 if(p.has("deck")){const id=p.get("deck");if(/^[a-f0-9]{32}$/.test(id))window.DeepCutsOpenDeck?.(id)}
 if(p.has("publish"))$("fromWorkshop").click();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
