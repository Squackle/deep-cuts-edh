import {readDeck,saveDeck} from "./shared.js";
const $=id=>document.getElementById(id);
const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const tierNames={informant:"The Informant",detective:"The Detective",chief:"The Chief Investigator"};
const tierPower={informant:1,detective:2,chief:3};
let account=null,overview=null,versions=[];
async function api(url,body){
 const opts={credentials:"same-origin",cache:"no-store"};
 if(body!==undefined){opts.method="POST";opts.headers={"Content-Type":"application/json"};opts.body=JSON.stringify(body)}
 let res;try{res=await fetch(url,opts)}catch{throw Error("Cannot reach the Field Office service.")}
 let data;try{data=await res.json()}catch{throw Error("Could not read the server response.")}
 if(!res.ok)throw Error(data.error||"Member service returned "+res.status);
 return data;
}
function status(message,error=false){$("memberStatus").textContent=message;$("memberStatus").classList.toggle("error",error)}
function para(text){return mk("p",null,text)}
function show(target){const active=["dossier","research","lab","editorial","settings"].includes(target)?target:"dossier";
 document.querySelectorAll(".member-view").forEach(n=>{n.hidden=n.id!=="member-"+active});
 document.querySelectorAll(".member-tab").forEach(b=>{const yes=b.dataset.view===active;b.classList.toggle("active",yes);b.setAttribute("aria-selected",String(yes));b.tabIndex=yes?0:-1});
 history.replaceState(null,"","#"+active);
}
function fillText(target,msg){$(target).replaceChildren(para(msg))}
function cardItem(title,description,meta){
 const n=mk("article","member-item"),strong=mk("strong",null,title);
 n.append(strong,para(description||""));
 if(meta)n.append(mk("small",null,meta));
 return n;
}
function validDeck(){
 const d=readDeck();
 if(!Array.isArray(d.cards)||!d.commanders?.length)throw Error("Save a deck in the free Deck Workshop first.");
 return d;
}
function scrubKey(){const u=new URL(location.href);u.searchParams.delete("session_id");history.replaceState(null,"",u.pathname+u.search+u.hash)}
function markTier(){
 $("memberTierName").textContent=tierNames[account.tier]||"Member";
 $("memberDeviceCount").textContent=(account.devices?.length||0)+" / 2";
 const current=account.devices?.find(x=>x.id===account.deviceId);
 $("memberDeviceName").textContent=current?.label||"This device";
 const detective=tierPower[account.tier]>=2;
 $("detectiveLock").hidden=detective;$("detectiveTools").hidden=!detective;
 $("memberRequestType").querySelectorAll("option").forEach(o=>o.disabled=tierPower[account.tier]<({showcase:1,question:2,consultation:3,editorial:3,credit:3}[o.value]||1));
}
async function enter(){
 try{
  account=await api("/api/member");
  $("memberOffice").hidden=false;$("memberEntrance").hidden=true;
  markTier();
  status("Membership verified · "+(tierNames[account.tier]||account.tier));
  show(location.hash.slice(1)||"dossier");
  await Promise.allSettled([loadOverview(),loadDevices(),loadShowcase()]);
 }catch(e){
  account=null;$("memberOffice").hidden=true;$("memberEntrance").hidden=false;
  status(e.message||"Activate this device to continue.",true);
 }
}
document.querySelectorAll(".member-tab").forEach(button=>{
 button.addEventListener("click",()=>show(button.dataset.view));
 button.addEventListener("keydown",e=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;
  e.preventDefault();
  const buttons=[...document.querySelectorAll(".member-tab")];
  const idx=buttons.indexOf(button),target=e.key==="Home"?0:e.key==="End"?buttons.length-1:(idx+(e.key==="ArrowRight"?1:-1)+buttons.length)%buttons.length;
  buttons[target].focus();show(buttons[target].dataset.view);
 });
});
$("memberActivate").addEventListener("submit",async event=>{
 event.preventDefault();
 const button=event.target.querySelector("button");button.disabled=true;
 try{
  const key=$("memberKey").value.trim(),label=$("memberDeviceLabel").value.trim();
  await api("/api/member",{action:"activate",key,label});
  $("memberKey").value="";$("memberClaim").hidden=true;
  await enter();
 }catch(e){status(e.message,true)}finally{button.disabled=false}
});
$("replaceLostDevice").addEventListener("click",async()=>{
 if(!confirm("This replaces your oldest active device and signs it out. You can do this only once every 30 days. Continue?"))return;
 const button=$("replaceLostDevice");button.disabled=true;
 try{
  await api("/api/member",{action:"recover",key:$("memberKey").value.trim(),label:$("memberDeviceLabel").value.trim()});
  $("memberKey").value="";$("memberClaim").hidden=true;await enter();
 }catch(e){status(e.message,true)}finally{button.disabled=false}
});
$("copyMemberKey").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText($("memberNewKey").textContent);status("Membership key copied. Save it securely.")}catch{status("Clipboard unavailable. Select and copy the key.",true)}
});
async function claim(){
 const s=new URL(location.href).searchParams.get("session_id");
 if(!s)return;
 scrubKey();
 if(!/^cs_live_[A-Za-z0-9_]+$/.test(s)){status("Only a verified live membership checkout can issue a key.",true);return}
 try{
  const result=await api("/api/member",{action:"claim",sessionId:s});
  $("memberEntrance").hidden=false;$("memberClaim").hidden=false;
  $("memberClaimText").textContent="Your "+(tierNames[result.tier]||result.tier)+" membership was verified.";
  $("memberNewKey").textContent=result.key;
  $("memberKey").value=result.key;
  status("Checkout verified. Save your key and activate this device.");
 }catch(e){status(e.message,true)}
}
async function callDossier(){
 const button=$("runDossier");button.disabled=true;
 try{
  fillText("dossierOutput","Examining case evidence…");
  const {result:r}=await api("/api/member-lab",{action:"dossier",deck:validDeck()});
  window.DeepCutsGuide?.registerCardNames(validDeck().cards.map(c=>c.name));
  const out=$("dossierOutput");out.replaceChildren();
  const intro=mk("div","member-dossier-print");
  intro.append(mk("h3",null,"CONFIDENTIAL · CASE REPORT"));
  intro.append(para("SUBJECT: "+r.commanders.join(" + ")));
  intro.append(para("EVIDENCE LOG: "+r.count+" cards · "+r.counts.lands+" lands · avg. spell mana value "+r.curve));
  intro.append(para(r.legalSize?"Quantity check: 100 cards including commander(s).":"Quantity discrepancy: "+r.count+" cards. Correct your deck size."));
  if(r.unknown)intro.append(para(r.unknown+" cards lack resolved Scryfall metadata; role estimates may undercount."));
  intro.append(mk("h3",null,"ROLE BALANCE / EXPECTED TARGETS"));
  for(const item of Object.entries(r.counts))intro.append(para(item[0].toUpperCase()+": "+item[1]+" observed / "+r.targets[item[0]]+" suggested baseline"));
  intro.append(mk("h3",null,"RECOMMENDED INVESTIGATIONS"));
  if(!r.recommendations.length)intro.append(para("No obvious role shortages against the baseline; inspect synergy and card quality manually."));
  for(const fix of r.recommendations)intro.append(para(fix.role.toUpperCase()+" · "+fix.suggested+" additional card(s): "+fix.reason));
  intro.append(mk("h3",null,"HIGH-COST SUSPECTS"));
  if(!r.suspects.length)intro.append(para("No expensive nonland suspects identified."));
  for(const suspect of r.suspects)intro.append(para(suspect.name+" — "+suspect.reason));
  intro.append(para(r.disclaimer));
  out.append(intro);$("printDossier").disabled=false;status("Deck dossier ready. Print or save to PDF.");
 }catch(e){fillText("dossierOutput",e.message);status(e.message,true)}finally{button.disabled=false}
}
$("runDossier").addEventListener("click",callDossier);
$("printDossier").addEventListener("click",()=>{show("dossier");window.print()});
async function runProbability(){
 const btn=$("runProbability");btn.disabled=true;
 try{
  fillText("probabilityOutput","Shuffling and drawing hands…");
  const {result:r}=await api("/api/member-lab",{action:"probability",deck:validDeck(),commanderCost:Number($("memberManaCost").value)});
  if(r.error){fillText("probabilityOutput",r.error);return}
  const o=$("probabilityOutput");o.replaceChildren(mk("h3",null,"1,500 simulated hands"));
  o.append(para("Opening hands with 2–5 lands: "+r.keepable+"%"));
  o.append(para("Can produce "+r.commanderCost+" mana from lands by turn 3: "+r.turn3+"%"));
  o.append(para("By turn 4: "+r.turn4+"% · By turn 5: "+r.turn5+"%"));
  o.append(para("Opening-hand land distribution (0–7): "+r.landDistribution.join(" / ")));
  o.append(para(r.warning));
 }catch(e){fillText("probabilityOutput",e.message)}finally{btn.disabled=false}
}
$("runProbability").addEventListener("click",runProbability);
$("compareCollection").addEventListener("click",async()=>{
 try{
  const {result:r}=await api("/api/member-lab",{action:"collection",deck:validDeck(),owned:$("memberOwned").value});
  const out=$("collectionOutput");out.replaceChildren(mk("h3",null,r.ownedCards+" of "+r.totalCards+" copies matched"));
  const missing=mk("div","member-stack");
  for(const item of r.missing.slice(0,60))missing.append(para(item.qty+"× "+item.name));
  out.append(para("Missing by card name ("+r.missing.length+" distinct):"),missing,para(r.warning));
 }catch(e){fillText("collectionOutput",e.message)}
});
async function loadVersions(){
 try{
  const result=await api("/api/member-data?action=versions");versions=result.versions||[];
  const target=$("versionList");target.replaceChildren();
  if(!versions.length){target.append(para("No saved versions yet."));return}
  const current=readDeck(),base=new Map((current.cards||[]).map(c=>[c.name.toLowerCase(),c.qty]));
  for(const v of versions){
   const row=cardItem(v.title,new Date(v.created_at*1000).toLocaleString());
   const compare=mk("button",null,"COMPARE TO CURRENT");
   compare.addEventListener("click",()=>{
    const latest=new Map((v.deck.cards||[]).map(c=>[c.name.toLowerCase(),c.qty]));
    const changes=[];
    for(const k of new Set([...base.keys(),...latest.keys()])){
     const delta=(base.get(k)||0)-(latest.get(k)||0);
     if(delta)changes.push((delta>0?"+":"")+delta+" "+k);
    }
    const old=row.querySelector(".member-compare");if(old)old.remove();
    row.append(mk("p","member-compare",changes.slice(0,30).join(" · ")||"No card quantity differences."));
   });
   const restore=mk("button",null,"RESTORE TO WORKSHOP");
   restore.addEventListener("click",()=>{
    if(!confirm("Replace your current browser Workshop deck with this archived version? Save your current deck first if needed."))return;
    saveDeck(v.deck);status("Archived version restored to this browser's Workshop. Open the Workshop to analyze it.");
   });
   row.append(compare,restore);target.append(row);
  }
 }catch(e){fillText("versionList",e.message)}
}
$("refreshVersions").addEventListener("click",loadVersions);
$("saveMemberVersion").addEventListener("click",async()=>{
 try{
  const deck=validDeck();
  await api("/api/member-data",{action:"version",deck,title:deck.commanders.join(" + ")});
  status("Saved deck version.");await loadVersions();
 }catch(e){status(e.message,true)}
});
async function loadWatches(){
 try{
  const r=await api("/api/member-data?action=watches");
  const target=$("watchList");target.replaceChildren();
  if(!r.watches.length){target.append(para("No watched cards or commanders."));return}
  for(const item of r.watches){
   const row=cardItem(item.name,"Manual watchlist · no automatic notifications");
   const button=mk("button",null,"REMOVE");
   button.addEventListener("click",async()=>{try{await api("/api/member-data",{action:"unwatch",name:item.name});await loadWatches()}catch(e){status(e.message,true)}});
   row.append(button);target.append(row);
  }
 }catch(e){fillText("watchList",e.message)}
}
$("scanWatches").addEventListener("click",async()=>{
 const button=$("scanWatches");button.disabled=true;fillText("watchScanResult","Comparing tracked Scryfall card snapshots…");
 try{
  const r=await api("/api/member-data",{action:"scan"});
  const target=$("watchScanResult");target.replaceChildren(para(r.checked+" cards checked."));
  if(!r.findings?.length)target.append(para("No notable changes since the prior snapshot. Newly added watches establish a baseline first."));
  else for(const item of r.findings)target.append(para(item.name+": "+item.note));
  target.append(para(r.notice));
  await loadWatches();
 }catch(e){fillText("watchScanResult",e.message)}finally{button.disabled=false}
});
$("addWatch").addEventListener("click",async()=>{
 try{await api("/api/member-data",{action:"watch",name:$("watchName").value});$("watchName").value="";await loadWatches()}catch(e){status(e.message,true)}
});
async function loadOverview(){
 try{
  overview=await api("/api/member-data?action=overview");
  const other=$("alternateFiles"),news=$("newsletterFiles"),early=$("earlyFiles");other.replaceChildren();news.replaceChildren();early.replaceChildren();
  for(const item of overview.alternates||[]){
   const card=cardItem(item.commander+" · "+item.name,item.angle,item.focus);
   if(item.cards?.length){
    const detail=mk("details");const summary=mk("summary",null,"VIEW "+item.cards.length+" SUGGESTED CARDS");detail.append(summary);
    const list=mk("div","member-card-package");
    for(const name of item.cards)list.append(para("1 "+name));
    detail.append(list);card.append(detail);
    window.DeepCutsGuide?.registerCardNames(item.cards);
   }
   other.append(card);
  }
  for(const item of overview.newsletter||[]){
   const card=cardItem(item.title,item.intro,item.date);
   for(const s of item.sections||[])card.append(para(s.title+" — "+s.text));
   news.append(card);
  }
  if(!(overview.early||[]).length)early.append(cardItem("No advance file currently in the queue","When a new Rescue Report draft is ready, it will be available here before public release. This area doesn't imply an unpublished draft exists today."));
  else for(const item of overview.early)early.append(cardItem(item.title,item.text));
  const requests=$("memberRequests");requests.replaceChildren();
  if(!overview.requests?.length)requests.append(para("No submissions yet."));
  else for(const r of overview.requests)requests.append(cardItem(r.category.toUpperCase(),r.staff_reply?"EDITORIAL RESPONSE: "+r.staff_reply:"Status: "+r.status,"Submitted "+new Date(r.created_at*1000).toLocaleDateString()));
 }catch(e){status("Couldn't open editorial files: "+e.message,true)}
}
async function loadShowcase(){
 try{
  const r=await api("/api/member-data?action=showcase");
  const target=$("showcaseList");target.replaceChildren();
  if(!r.showcase?.length)target.append(para("No decks have been approved for the showcase yet."));
  else for(const s of r.showcase)target.append(cardItem("Supporter deck file",s.content,new Date(s.createdAt*1000).toLocaleDateString()));
 }catch(e){fillText("showcaseList",e.message)}
}
$("memberRequest").addEventListener("submit",async e=>{
 e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;
 try{
  await api("/api/member-data",{action:"request",category:$("memberRequestType").value,content:$("memberRequestBody").value});
  $("memberRequestBody").value="";status("Submitted for editorial review.");await loadOverview();
 }catch(err){status(err.message,true)}finally{b.disabled=false}
});
async function loadDevices(){
 if(!account)return;
 const target=$("deviceList");target.replaceChildren();
 for(const device of account.devices||[]){
  const own=device.id===account.deviceId;
  const item=cardItem(device.label+(own?" · This device":""),"Activated "+new Date(device.created_at*1000).toLocaleString());
  const revoke=mk("button",null,own?"DEACTIVATE THIS DEVICE":"RELEASE DEVICE SLOT");
  const wait=Number(account.canReplaceAt||0)*1000>Date.now();
  revoke.disabled=wait;
  if(wait)item.append(para("Next replacement: "+new Date(account.canReplaceAt*1000).toLocaleDateString()));
  revoke.addEventListener("click",async()=>{
   if(!confirm("Release this device slot? This counts as your one replacement for 30 days."))return;
   try{
    await api("/api/member",{action:"revoke",deviceId:device.id});
    if(own)await enter();else{account=await api("/api/member");markTier();await loadDevices()}
   }catch(e){status(e.message,true)}
  });
  item.append(revoke);target.append(item);
 }
}
$("memberTheme").addEventListener("change",()=>{
 const choice=$("memberTheme").value;
 if(!["classic","noir","parchment","laboratory"].includes(choice))return;
 document.querySelector(".member-page").className="member-page"+(choice==="classic"?"":" member-"+choice);
 try{localStorage.setItem("deepcuts-member-theme",choice)}catch{}
});
try{const saved=localStorage.getItem("deepcuts-member-theme");if(saved&&["classic","noir","parchment","laboratory"].includes(saved)){$("memberTheme").value=saved;$("memberTheme").dispatchEvent(new Event("change"))}}catch{}
window.addEventListener("hashchange",()=>{if(account)show(location.hash.slice(1))});
// Claim first so a Stripe success session is never lost to tab navigation.
const checkoutSession=new URL(location.href).searchParams.get("session_id");
if(checkoutSession){
 await claim();
 if(!$("memberClaim").hidden){$("memberOffice").hidden=true;$("memberEntrance").hidden=false}
 else await enter();
}else{
 await enter();
}
if(account?.tier&&tierPower[account.tier]>=2){await Promise.allSettled([loadVersions(),loadWatches()])}
