import {setupFeatures,refreshFeatures} from "./community-features.js";
import {initializeRecovery,refreshEmailStatus,offerEmail} from "./community-recovery.js";
export const $=id=>document.getElementById(id);
export const state={key:"",me:null,remembered:false,legacyStored:false,caseSlug:"chainer-dementia-master",deck:null,editing:"",myDecks:[]};
export const el=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined&&content!==null)n.textContent=String(content);if(cls)n.className=cls;return n};
export function clear(node){node.replaceChildren()}
export function msg(t,isError=false){const n=$("cmStatus");n.textContent=t||"";n.dataset.error=isError?"true":"false"}
export const avatarUrl=name=>"https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name)+"&format=image&version=art_crop";
// Face-close-up portraits use a true clipped zoom so BOTH focal sliders work.
// object-position alone cannot move landscape art vertically in a square frame.
const focal={
 "Chainer, Dementia Master":[51,32],
 "Commander Mustard":[50,29],
 "Alena, Kessig Trapper":[51,23],
 "Gilanra, Caller of Wirewood":[51,27],
 "Ekthi, Contaminator Priest":[51,28]
};
const DEFAULT_ZOOM=2.8;
function positionImage(img,focus,zoom=DEFAULT_ZOOM){
 const x=Math.max(0,Math.min(100,Number(focus?.[0])||0)),
       y=Math.max(0,Math.min(100,Number(focus?.[1])||0)),
       scale=Math.max(1.8,Math.min(4.2,Number(zoom)||DEFAULT_ZOOM));
 // After scaling, translate the requested focal point to the frame center.
 // Clamp translation so no empty space appears at the circle's edges.
 const limit=(scale-1)*50;
 const dx=Math.max(-limit,Math.min(limit,(50-x)*scale));
 const dy=Math.max(-limit,Math.min(limit,(50-y)*scale));
 img.style.transform="translate("+dx.toFixed(2)+"%, "+dy.toFixed(2)+"%) scale("+scale.toFixed(2)+")";
 img.style.objectPosition="center";
}
export const avatarImage=(name,small=false,focus=null,zoom=DEFAULT_ZOOM)=>{
 const img=el("img");img.src=avatarUrl(name);img.alt="Art portrait: "+name;
 img.loading="lazy";img.decoding="async";img.className=small?"cm-avatar-small":"cm-avatar-crop";
 positionImage(img,focus||focal[name]||[50,30],zoom);
 img.onerror=()=>{img.removeAttribute("src");img.alt="Commander art unavailable";};
 if(!small)return img;
 const window=el("span",null,"cm-avatar-small-frame");
 window.append(img);return window;
};
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
// Convert plain-text @Handle references to first-party profile links.
 // Build real text nodes/anchors (never untrusted HTML) to avoid injection.
export function appendProfileMentions(target,value){
 const str=String(value??""),pattern=/@([A-Za-z][A-Za-z0-9_]{2,23})\b/g;
 let cursor=0,match;
 while((match=pattern.exec(str))){
  const pos=match.index;
  if(pos>0&&/[A-Za-z0-9_.]/.test(str[pos-1]))continue;
  target.append(document.createTextNode(str.slice(cursor,pos)));
  const href="community.html?profile="+encodeURIComponent(match[1]);
  const a=el("a",match[0],"cm-profile-mention");a.href=href;
  a.title="View @"+match[1]+"'s investigator profile";
  target.append(a);cursor=pos+match[0].length;
 }
 target.append(document.createTextNode(str.slice(cursor)));
 return target;
}
export function card(title,body,meta){
 const n=el("article",null,"cm-card"),h=el("header");
 const heading=el("strong"),metadata=el("span",null,"cm-meta"),copy=el("p");
 appendProfileMentions(heading,title);
 appendProfileMentions(metadata,meta||"");
 appendProfileMentions(copy,body||"");
 h.append(heading,metadata);n.append(h,copy);return n;
}
export function empty(target,text){clear(target);target.append(el("p",text,"cm-empty"))}
export function setTab(tab){
 const subtitles={
  cases:"FIND YOUR FELLOW BREWERS",
  decks:"SHOW YOUR DECK TECH",
  challenge:"JOIN THE RESCUE CHALLENGE",
  lab:"TEST THE UNEXPECTED",
  network:"FOLLOW THE INVESTIGATION",
  account:"YOUR INVESTIGATOR DOSSIER"
 };
 const tagline=document.querySelector(".site-header .wordmark-copy small");
 if(tagline)tagline.textContent=subtitles[tab]||subtitles.cases;
 const panels=document.querySelectorAll("[data-panel]");panels.forEach(n=>n.hidden=n.dataset.panel!==tab);
 document.querySelectorAll("[data-tab]").forEach(n=>n.setAttribute("aria-current",n.dataset.tab===tab?"page":"false"));
 history.replaceState(null,"",location.pathname+(tab==="cases"?"?case="+encodeURIComponent(state.caseSlug):"#"+tab));
 if(tab==="cases")loadCase();
 if(tab==="network")loadNetwork();
 if(["decks","challenge","lab"].includes(tab))refreshFeatures(tab);
 if(tab==="account")updateIdentity();
}
export function portrait(p){
 const n=el("div",null,"cm-portrait"),wrap=el("div",null,"cm-portrait-art");
 const frame=el("a",null,"cm-avatar-link");frame.href="https://scryfall.com/search?q="+encodeURIComponent('!"'+p.avatar+'"');
 frame.target="_blank";frame.rel="noopener noreferrer";frame.title="View the original full card and illustrator credit";
 frame.append(avatarImage(p.avatar,false,[p.focus_x??50,p.focus_y??30],p.focus_zoom??DEFAULT_ZOOM));wrap.append(frame);
 wrap.append(el("small","View full card / artist ↗","cm-art-credit"));
 const details=el("div",null,"cm-portrait-details");
 const handle=el("h3"),handleLink=link("@"+p.handle,"community.html?profile="+encodeURIComponent(p.handle));
 handleLink.className="cm-profile-handle";handle.append(handleLink);
 const description=el("p",null,"cm-portrait-bio");
 if(p.bio_emoji)description.append(el("span",p.bio_emoji,"cm-bio-emoji"),document.createTextNode(" "));
 appendProfileMentions(description,p.bio||"No biography yet.");
 details.append(handle,description);
 n.append(wrap,details);return n;
}
export function updateIdentity(){
 $("identitySummary").replaceChildren(state.me?portrait(state.me):el("p","No profile signed in."));
 $("accountLoggedOut").hidden=!!state.me;$("accountLoggedIn").hidden=!state.me;
 if(state.me){
  $("ownProfile").replaceChildren(portrait(state.me),el("p","Save your recovery key somewhere private. This profile is public; your credential is not.","cm-note"));
  $("editProfileForm").elements.bio.value=state.me.bio||"";
  $("editProfileForm").elements.bioEmoji.value=state.me.bio_emoji||"";
  $("editProfileForm").elements.avatar.value=state.me.avatar;
  $("editProfileForm").elements.focusX.value=state.me.focus_x??50;
  $("editProfileForm").elements.focusY.value=state.me.focus_y??30;
  $("editProfileForm").elements.focusZoom.value=state.me.focus_zoom??DEFAULT_ZOOM;
  renderEditAvatarPreview();
  const notice=$("deviceSessionStatus");if(notice)notice.textContent=state.remembered
    ?"This device is remembered with a secure, revocable cookie for up to 90 days. Sign out to forget it."
    :state.legacyStored
     ?"An older saved profile key is still stored here. Choose Remember This Device to upgrade to a secure cookie, or sign out to erase it."
     :"This sign-in ends when you close the browser. You can remember this device below.";
  const rememberButton=$("rememberThisDevice");if(rememberButton)rememberButton.hidden=state.remembered||!state.key;
  refreshEmailStatus();
 }
}
const LEGACY_KEY="dc-profile-key";
async function deviceRequest(action,key=""){
 const headers={"Content-Type":"application/json"};
 if(key)headers.Authorization="Bearer "+key;
 const r=await fetch("/api/profile-device",{method:"POST",headers,credentials:"same-origin",cache:"no-store",body:JSON.stringify({action})});
 let d;try{d=await r.json()}catch{throw Error("Device sign-in service is unavailable.")}
 if(!r.ok||!d.ok)throw Error(d.error||"Unable to remember this device.");
 return d;
}
function forgetLegacyStorage(){
 try{sessionStorage.removeItem(LEGACY_KEY);localStorage.removeItem(LEGACY_KEY)}catch{}
}
export async function restore(){
 let ephemeral="",legacy="";
 try{ephemeral=sessionStorage.getItem(LEGACY_KEY)||"";legacy=localStorage.getItem(LEGACY_KEY)||""}catch{}
 const oldKey=ephemeral||legacy;
 if(oldKey){
  state.key=oldKey;
  try{
   const d=await api("me");state.me=d.profile;
   if(!ephemeral&&legacy){
    // Migrate existing "remember me" keys to a revocable HttpOnly cookie.
    try{await deviceRequest("remember",legacy);forgetLegacyStorage();state.key="";state.remembered=true}
    catch{state.remembered=false;state.legacyStored=true} // Older browser keys still work until successfully migrated.
   }
  }catch{state.key="";forgetLegacyStorage()}
 }
 if(!state.me){
  state.key="";
  try{const d=await api("me");state.me=d.profile;state.remembered=true}catch{}
 }
 updateIdentity();
}
export async function saveSession(key,remember=true){
 const previous={key:state.key,me:state.me,remembered:state.remembered};
 state.key=key;
 let data;try{data=await api("me")}catch(e){Object.assign(state,previous);throw e}
 // Preserve the visible one-time recovery key box, but do not persist that
 // powerful key in localStorage. Remember devices using a revocable cookie.
 if(remember){
  try{
   await deviceRequest("remember",key);
   forgetLegacyStorage();
   state.key="";state.remembered=true;state.legacyStored=false;
  }catch{
   state.key=key;state.remembered=false;state.legacyStored=false;
   try{sessionStorage.setItem(LEGACY_KEY,key);localStorage.removeItem(LEGACY_KEY)}catch{}
   msg("Signed in for this tab. Device remembering failed; you may need to sign in again after closing the browser.",true);
  }
 }else{
  try{await deviceRequest("forget")}catch(e){Object.assign(state,previous);throw e}
  state.key=key;state.remembered=false;state.legacyStored=false;
  try{localStorage.removeItem(LEGACY_KEY);sessionStorage.setItem(LEGACY_KEY,key)}catch{}
 }
 state.me=data.profile;updateIdentity();
 if(state.remembered)msg("Signed in as "+state.me.handle+". This device will be remembered for up to 90 days.");
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
  const author=n.querySelector("header strong");if(author){author.className="cm-card-author";author.prepend(avatarImage(c.avatar,true,[c.focus_x??50,c.focus_y??30],c.focus_zoom??DEFAULT_ZOOM));}
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
function formZoom(f){return Number(f.elements.focusZoom?.value)||DEFAULT_ZOOM}
function makePreviewWindow(form){
 const window=el("span",null,"cm-avatar-preview-window");
 window.append(avatarImage(form.elements.avatar.value,false,
  [Number(form.elements.focusX.value),Number(form.elements.focusY.value)],formZoom(form)));
 return window;
}
function updateExistingPreview(form,dest){
 const name=form.elements.avatar.value;
 const img=dest.querySelector(".cm-avatar-preview-window img");
 if(!img||dest.dataset.avatar!==name)return false;
 positionImage(img,[Number(form.elements.focusX.value),Number(form.elements.focusY.value)],formZoom(form));
 const zoomLabel=dest.querySelector(".cm-zoom-readout");
 if(zoomLabel)zoomLabel.textContent=formZoom(form).toFixed(1)+"× close-up";
 return true;
}
function renderAvatarChoice(){
 const f=$("registerForm"),dest=$("avatarPreview");if(!f||!dest)return;
 if(updateExistingPreview(f,dest))return;
 const name=f.elements.avatar.value;
 const row=el("div",null,"cm-portrait-preview");
 row.append(makePreviewWindow(f));
 const meta=el("div");
 meta.append(el("strong",name),el("small","Tight face crop · aim for roughly 70% face"));
 meta.append(el("small",formZoom(f).toFixed(1)+"× close-up","cm-zoom-readout"));
 const source=link("View original card and illustrator ↗","https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"'));
 source.target="_blank";source.rel="noopener noreferrer";meta.append(source);row.append(meta);
 dest.dataset.avatar=name;dest.replaceChildren(row);
}
function renderEditAvatarPreview(){
 const f=$("editProfileForm"),dest=$("editAvatarPreview");
 if(!f||!dest)return;
 if(updateExistingPreview(f,dest))return;
 const row=el("div",null,"cm-portrait-preview");
 row.append(makePreviewWindow(f));
 const note=el("div");
 note.append(el("strong",formZoom(f).toFixed(1)+"× close-up","cm-zoom-readout"),
  el("small","Drag up/down and left/right to center the face. Zoom until the face fills around 70% of the circle."));
 row.append(note);dest.dataset.avatar=f.elements.avatar.value;dest.replaceChildren(row);
}
function bindAccount(){
 $("registerForm").elements.avatar.addEventListener("change",()=>{
  const v=focal[$("registerForm").elements.avatar.value]||[50,30];
  $("registerForm").elements.focusX.value=v[0];$("registerForm").elements.focusY.value=v[1];
  $("registerForm").elements.focusZoom.value=DEFAULT_ZOOM;renderAvatarChoice();
 });
 ["focusX","focusY","focusZoom"].forEach(k=>$("registerForm").elements[k].addEventListener("input",renderAvatarChoice));
 $("editProfileForm").elements.avatar.addEventListener("change",()=>{
  const v=focal[$("editProfileForm").elements.avatar.value]||[50,30];
  $("editProfileForm").elements.focusX.value=v[0];$("editProfileForm").elements.focusY.value=v[1];
  $("editProfileForm").elements.focusZoom.value=DEFAULT_ZOOM;renderEditAvatarPreview();
 });
 ["focusX","focusY","focusZoom"].forEach(k=>$("editProfileForm").elements[k].addEventListener("input",renderEditAvatarPreview));
 renderAvatarChoice();
 $("registerForm").addEventListener("submit",async ev=>{ev.preventDefault();const f=ev.currentTarget;
 const token=f.querySelector('input[name="cf-turnstile-response"]')?.value||"";
 const recoveryEmail=f.elements.recoveryEmail?.value.trim()||"";
 const r=await attempt(()=>write({action:"register",handle:f.elements.handle.value,bio:f.elements.bio.value,bioEmoji:f.elements.bioEmoji.value,avatar:f.elements.avatar.value,focusX:Number(f.elements.focusX.value),focusY:Number(f.elements.focusY.value),focusZoom:formZoom(f),token},false));
 if(!r)return;
 $("newKeyBox").hidden=false;$("newKey").value=r.key;
 await saveSession(r.key,true);$("accountLoggedIn").prepend($("newKeyBox"));$("newKeyBox").hidden=false;$("newKeyBox").scrollIntoView({block:"center",behavior:"smooth"});
 window.turnstile?.reset();f.reset();msg("Profile created. Save the one-time recovery key displayed below.");
 if(recoveryEmail)await offerEmail(recoveryEmail);
 });
 $("copyKey").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("newKey").value);msg("Recovery key copied. Save it privately.")}catch{msg("Select and copy the recovery key manually.",true)}});
 $("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget,key=f.elements.key.value.trim();
  const result=await attempt(()=>saveSession(key,f.elements.remember.checked));
  if(result!==null){f.reset();if(state.remembered)msg("Welcome back. This device is remembered for up to 90 days.");else msg("Signed in for this browser session.")}
 });
 $("editProfileForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const r=await attempt(()=>write({action:"update_profile",bio:f.elements.bio.value,bioEmoji:f.elements.bioEmoji.value,avatar:f.elements.avatar.value,focusX:Number(f.elements.focusX.value),focusY:Number(f.elements.focusY.value),focusZoom:formZoom(f)}),"Profile saved.");if(r){state.me.bio=f.elements.bio.value.trim();state.me.bio_emoji=f.elements.bioEmoji.value;state.me.avatar=f.elements.avatar.value;state.me.focus_x=Number(f.elements.focusX.value);state.me.focus_y=Number(f.elements.focusY.value);state.me.focus_zoom=formZoom(f);updateIdentity()}});
 $("rememberThisDevice").addEventListener("click",async()=>{
  if(!state.key)return msg("Sign in again to remember this browser.",true);
  const r=await attempt(()=>deviceRequest("remember",state.key));
  if(!r)return;
  forgetLegacyStorage();state.key="";state.remembered=true;state.legacyStored=false;updateIdentity();
  msg("This browser is now remembered for up to 90 days.");
 });
 async function signOutDevice(){
  try{await deviceRequest("forget")}catch(e){msg("Could not revoke the remembered device. Check your connection and try again.",true);return false}
  state.key="";state.me=null;state.remembered=false;state.legacyStored=false;forgetLegacyStorage();
  $("newKeyBox").hidden=true;$("newKey").value="";
  $("profileRecoveryKeyBox").hidden=true;$("profileRecoveryKey").value="";
  updateIdentity();msg("Signed out. This browser's remembered access was revoked.");
  return true;
 }
 $("signOut").addEventListener("click",signOutDevice);
 $("deleteAccount").addEventListener("click",async()=>{
  const phrase=prompt("This permanently deletes your free community profile and all your public contributions. Type DELETE MY PROFILE to proceed.");
  if(phrase!=="DELETE MY PROFILE")return;
  const r=await attempt(()=>write({action:"delete_profile",confirm:phrase}));
  if(r){await signOutDevice();msg("Your community profile was deleted.")}
 });
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
 bindAccount();bindCases();setupFeatures();initializeRecovery();
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
