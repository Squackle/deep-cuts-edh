import {key,CASES,parseCollection,roleOf,validCommander,allowed,draftFromOwned,synergySignal} from "./deep-tools-core.js";
import {saveDeck,compactCard} from "./shared.js";
const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const scUrl=name=>"https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"');
const cardLink=(name,url)=>{const a=node("a",name);a.href=url?.startsWith("https://scryfall.com/")?url:scUrl(name);a.target="_blank";a.rel="noopener noreferrer";return a};
const money=v=>v==null?"PRICE UNKNOWN":"$"+Number(v).toFixed(2);
function status(id,value,error=false){const el=$(id);if(el){el.textContent=value;el.dataset.error=error?"true":"false"}}
async function jsonReq(url,opts={}){
 const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...opts});
 let data;try{data=await r.json()}catch{throw Error("Card service returned an unreadable response.")}
 if(!r.ok)throw Error(data.error||data.details||"Card lookup failed ("+r.status+").");
 return data;
}
async function commanderLookup(name){
 const card=await jsonReq("https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(name),{credentials:"omit"});
 if(!validCommander(card))throw Error("Choose a Commander-legal legendary creature or a card that explicitly can be your commander.");
 return card;
}
async function batchCards(names,progress){
 const unique=[...new Map(names.filter(Boolean).map(x=>[key(x),x])).values()],all=[],missing=[];
 for(let i=0;i<unique.length;i+=75){
  if(i)await sleep(700);
  if(progress)progress(Math.min(i+75,unique.length),unique.length);
  const d=await jsonReq("/api/tool-cards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({names:unique.slice(i,i+75)})});
  all.push(...(d.cards||[]));missing.push(...(d.missing||[]));
 }
 return {cards:all,missing};
}
function download(filename,content){
 const link=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
let inventory=[];
async function loadAccountCollection(){
 const d=await jsonReq("/api/field-expansion?action=collection");
 inventory=(d.cards||[]).map(x=>({name:x.name,quantity:x.quantity}));
 return inventory;
}
function renderFinder(){
 if(!$("finderResults"))return;
 const results=$("finderResults");results.replaceChildren();
 const role=$("finderRole").value,type=$("finderType").value,amount=$("finderMaxPrice").value,maximum=amount!==""?Number(amount):null,
 owned=$("finderOwned").checked,sort=$("finderSort").value;
 let candidates=(window.__finderCandidates||[]).filter(x=>(role==="all"||x.role===role)&&(type==="all"||x.type_line.includes(type))&&
 (maximum===null||(x.prices?.usd!=null&&Number(x.prices.usd)<=maximum))&&(!owned||inventory.some(o=>key(o.name)===key(x.name)&&Number(o.quantity)>0)));
 if(sort==="price")candidates.sort((a,b)=>(Number(a.prices?.usd??1e12)-Number(b.prices?.usd??1e12))||a.name.localeCompare(b.name));
 if(sort==="name")candidates.sort((a,b)=>a.name.localeCompare(b.name));
 if(!candidates.length){results.append(node("p",window.__finderCandidates?.length?"No cards match these filters. Try widening the search.":"Search a Commander to see recommendations.","dt-empty"));return}
 results.append(node("p",candidates.length+" matching cards · estimated prices where available","dt-count"));
 for(const c of candidates){
  const art=node("div",undefined,"dt-card-art");
  if(c.image){const img=node("img");img.src=c.image;img.alt=c.name+" card art";img.loading="lazy";img.decoding="async";art.append(img)}
  const info=node("div",undefined,"dt-card-copy");
  const top=node("div",undefined,"dt-card-overline");top.append(node("span",c.curated?"EDITORIAL / CURATED":"RULE-TEXT CANDIDATE"),node("span",c.role.toUpperCase()));
  const name=node("h3");name.append(cardLink(c.name,c.scryfall_uri));
  info.append(top,name,node("p",c.explanation,"dt-card-reason"));
  info.append(node("small",(c.mana_cost||"NO MANA COST")+" · "+c.type_line+" · "+money(c.prices?.usd),"dt-card-meta"));
  const actions=node("div",undefined,"dt-card-actions"),add=node("button","ADD TO DECK +","dt-button dt-small");add.type="button";
  add.addEventListener("click",()=>{import("./shared.js").then(({addCard})=>{
   if(addCard(c,1))status("finderStatus",c.name+" added to your local Deck Workshop list.");
   else status("finderStatus","Could not save to this browser.",true);
  })});
  actions.append(add);if(inventory.some(o=>key(o.name)===key(c.name)))actions.append(node("span","IN YOUR BINDER","dt-owned-mark"));
  info.append(actions);const item=node("article",undefined,"dt-card");item.append(art,info);results.append(item);
 }
}
function runFinder(){
 let busy=false;
 const load=document.querySelectorAll("#finderRole,#finderType,#finderMaxPrice,#finderOwned,#finderSort");
 load.forEach(e=>e.addEventListener("change",renderFinder));
 $("finderForm").addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;busy=true;const button=e.currentTarget.querySelector("button");button.disabled=true;
  const name=$("finderCommander").value.trim();status("finderStatus","Investigating "+name+"…");$("finderResults").replaceChildren();$("finderIdentity").hidden=true;window.__finderCandidates=[];
  try{
   const cmd=await commanderLookup(name),editorial=CASES[key(cmd.name)]||null,sig=synergySignal(cmd);
   const identity=$("finderIdentity");identity.replaceChildren();identity.append(node("strong",cmd.name),node("span","COLOR IDENTITY · "+(cmd.color_identity?.join(" / ")||"COLORLESS")));
   if(editorial)identity.append(node("small","Featured rescue: "+editorial.theme));
   identity.hidden=false;
   const source=[];
   if(editorial){
    const d=await batchCards(editorial.cards.map(x=>x[0]));
    for(const c of d.cards){const copy=editorial.cards.find(x=>key(x[0])===key(c.name));if(!copy||!allowed(c,cmd))continue;
     source.push({...c,role:roleOf(c),curated:true,explanation:copy[1]})}
   }
   const colors=(cmd.color_identity||[]).join("").toLowerCase();
   const q=["legal:commander",colors?"id<="+colors:"id:c",sig.query].join(" ");
   const url="https://api.scryfall.com/cards/search?"+new URLSearchParams({q,unique:"cards",order:"cmc",dir:"asc"});
   try{
    const d=await jsonReq(url,{credentials:"omit"});
    for(const c of (d.data||[]).slice(0,38)){
     if(!allowed(c,cmd)||key(c.name)===key(cmd.name)||source.some(x=>key(x.name)===key(c.name)))continue;
     source.push({...c,image:c.image_uris?.normal||c.card_faces?.find(f=>f.image_uris?.normal)?.image_uris?.normal||"",role:roleOf(c),
      curated:false,explanation:sig.explanation});
    }
   }catch(err){if(!source.length)throw err;status("finderStatus","Editorial cases loaded; automated rule-text candidates are currently unavailable.")}
   if(!source.length)throw Error("No legal cards were found using these signals. Try another Commander.");
   window.__finderCandidates=source;
   try{await loadAccountCollection()}catch{inventory=[];if($("finderOwned").checked)status("finderStatus","Sign in and remember your device in Field Network to use the owned-only filter.",true)}
   renderFinder();
   if(!$("finderOwned").checked)status("finderStatus",source.length+" Commander-legal candidates found. Editorial findings are distinct from exploratory text matches.");
  }catch(err){status("finderStatus",err.message,true);renderFinder()}
  finally{busy=false;button.disabled=false}
 });
 let suggestVersion=0,suggestTimer=null;
 $("finderCommander").addEventListener("input",()=>{
  clearTimeout(suggestTimer);const q=$("finderCommander").value.trim(),serial=++suggestVersion;
  if(q.length<3){$("finderCommanderSuggestions").replaceChildren();return}
  suggestTimer=setTimeout(async()=>{
   try{const d=await jsonReq("https://api.scryfall.com/cards/autocomplete?q="+encodeURIComponent(q),{credentials:"omit"});
    if(serial!==suggestVersion)return;const options=$("finderCommanderSuggestions");options.replaceChildren();
    for(const n of (d.data||[]).slice(0,18)){const op=node("option");op.value=n;options.append(op)}
   }catch{/* Autocomplete is optional; searching by full or partial name still works. */}
  },500);
 });
 const preset=new URLSearchParams(location.search).get("commander");
 if(preset&&preset.length<=130){$("finderCommander").value=preset;$("finderForm").requestSubmit()}
}
function runBinder(){
 let rows=[],unknown=[],validated=[],commander=null,draft=null,busy=false;
 const setBusy=value=>{busy=value;for(const x of ["binderPreview","binderLoad","binderSave","binderBuildForm","binderDeleteCollection"]){const e=$(x);if(e)e.disabled=value||x==="binderSave"&&!rows.length}};
 function preview(){
  const container=$("binderPreviewResults");container.replaceChildren();
  const total=rows.reduce((n,c)=>n+Number(c.quantity),0);
  const summary=node("p",rows.length+" distinct cards · "+total+" copies","dt-count");container.append(summary);
  if(unknown.length){const d=node("details");d.append(node("summary",unknown.length+" invalid rows to review"));d.append(node("p",unknown.slice(0,50).join(" · ")));container.append(d)}
  const list=node("div",undefined,"dt-preview-list");
  for(const row of rows.slice(0,45))list.append(node("span",row.quantity+"× "+row.name));
  container.append(list);
  if(rows.length>45)container.append(node("small","Previewing first 45 names. All "+rows.length+" entries are retained."));
  $("binderSave").disabled=!rows.length;
  $("binderExportCollection").disabled=!rows.length;
 }
 $("binderPreview").addEventListener("click",async()=>{
  try{const file=$("binderFile").files[0];if(file&&file.size>260000)throw Error("File exceeds 260 KB.");
   const raw=file?await file.text():$("binderInput").value;
   const result=parseCollection(raw);rows=result.cards;unknown=result.invalid;validated=[];commander=null;draft=null;preview();
   status("binderImportStatus",rows.length+" distinct names parsed. Names will be verified against Scryfall before being used in a deck. Nothing has been saved online.");
   if(unknown.length)status("binderImportStatus",rows.length+" entries parsed with "+unknown.length+" invalid rows. Expand the warning before saving.",true);
  }catch(e){status("binderImportStatus",e.message,true)}
 });
 $("binderLoad").addEventListener("click",async()=>{
  if(busy)return;setBusy(true);try{rows=await loadAccountCollection();unknown=[];validated=[];draft=null;preview();
   status("binderImportStatus","Loaded "+rows.length+" private card names from Field Network.");
  }catch(e){status("binderImportStatus",e.message+" Sign in and remember this device in Field Network first.",true)}
  finally{setBusy(false)}
 });
 $("binderSave").addEventListener("click",async()=>{
  if(busy||!rows.length)return;
  if(!confirm("REPLACE your existing private Field Network collection with these "+rows.length+" card names? This may overwrite earlier quantities. Choose Cancel to keep your saved collection."))return;
  setBusy(true);
  try{
   // Confirm auth before issuing the first destructive replace batch.
   await jsonReq("/api/community?action=me");
   for(let i=0;i<rows.length;i+=100){
    status("binderImportStatus","Saving "+Math.min(rows.length,i+100)+" / "+rows.length+"…");
    await jsonReq("/api/field-expansion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"collection_import",mode:i===0?"replace":"merge",cards:rows.slice(i,i+100)})});
   }
   status("binderImportStatus","Saved privately to your Field Network collection. You can export or delete it here, or open Community → Card Collection.");
  }catch(e){status("binderImportStatus","Save interrupted: "+e.message+". Earlier batches might already be saved. Reload your collection to verify.",true)}
  finally{setBusy(false)}
 });
 $("binderExportCollection").addEventListener("click",()=>download("deep-cuts-collection.csv","Name,Quantity\n"+rows.map(x=>'"'+x.name.replaceAll('"','""')+'",'+x.quantity).join("\n")));
 $("binderDeleteCollection").addEventListener("click",async()=>{
  if(busy)return;
  if(prompt("Delete all cards in your saved Field Network collection? Type ERASE COLLECTION:")!=="ERASE COLLECTION")return;
  setBusy(true);
  try{await jsonReq("/api/field-expansion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"collection_clear",confirm:"ERASE COLLECTION"})});
   rows=[];validated=[];unknown=[];draft=null;preview();status("binderImportStatus","Private collection deleted. Your local preview is cleared.");
  }catch(e){status("binderImportStatus",e.message,true)}finally{setBusy(false)}
 });
 function draw(){
  if(!draft)return;const box=$("binderDraft");box.replaceChildren();
  const msg=node("p",draft.complete?"100 / 100 — Verified card-name, color-identity, and singleton checks passed for the selected one-commander draft.":"INCOMPLETE · "+draft.cardCount+" / 100 CARDS · "+draft.missingSlots+" SLOTS LEFT","dt-count");
  msg.dataset.complete=String(draft.complete);box.append(msg);
  if(draft.warnings.length)box.append(node("p",draft.warnings.join(" "),"dt-warning"));
  const stats=node("div",undefined,"dt-role-grid");
  for(const [role,n] of Object.entries(draft.counts))stats.append(node("span",role.toUpperCase()+" · "+n));box.append(stats);
  const list=node("div",undefined,"dt-draft-list");
  list.append(node("div","1× "+commander.name+" · COMMANDER","dt-commander-row"));
  for(const c of draft.cards){
   const line=node("label",undefined,"dt-draft-row"),check=node("input");check.type="checkbox";check.checked=pins.has(key(c.name));check.setAttribute("aria-label","Prioritize "+c.name);
   check.addEventListener("change",()=>{if(check.checked)pins.add(key(c.name));else pins.delete(key(c.name));draft=draftFromOwned(commander,rows,validated,[...pins]);draw()});
   line.append(check,node("span",c.qty+"× "+c.name),node("small",c.role));list.append(line);
  }box.append(list);
  const issueKeys=[["illegal","Commander-illegal"],["outsideIdentity","Outside color identity"],["unknown","Unverified / not found"]];
  for(const [k,label] of issueKeys)if(draft.skip[k].length){
   const details=node("details");details.append(node("summary",label+" ("+draft.skip[k].length+")"),node("p",draft.skip[k].slice(0,75).join(" · ")));box.append(details);
  }
  $("binderApply").disabled=!draft.cards.length;
  $("binderExportDeck").disabled=!draft.cards.length;
 }
 const pins=new Set();
 $("binderBuildForm").addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;if(!rows.length){status("binderBuildStatus","Import a collection or load your saved inventory first.",true);return}
  setBusy(true);const name=$("binderCommander").value.trim();$("binderApply").disabled=true;$("binderExportDeck").disabled=true;
  try{
   commander=await commanderLookup(name);pins.clear();status("binderBuildStatus","Checking legality and color identity against Scryfall…");
   const report=await batchCards(rows.map(x=>x.name),(n,total)=>status("binderBuildStatus","Verified "+n+" of "+total+" names…"));
   validated=report.cards;unknown=report.missing;
   draft=draftFromOwned(commander,rows,validated);
   draw();
   status("binderBuildStatus",draft.complete?"100-card owned-card starter assembled. Review roles and strategy in Deck Workshop before playing.":"Draft prepared from "+validated.length+" verified card names. "+draft.missingSlots+" slots still needed; use Deep Cut Finder or Deck Workshop to complete.");
  }catch(err){status("binderBuildStatus",err.message,true)}
  finally{setBusy(false)}
 });
 $("binderApply").addEventListener("click",()=>{
  if(!draft?.cards.length)return;
  if(!confirm("Replace your current local Deck Workshop list with this "+draft.cardCount+"-card "+(draft.complete?"draft":"INCOMPLETE draft")+"?"))return;
  const cards=draft.cards.map(x=>({name:x.name,qty:x.qty,card:compactCard(validated.find(y=>key(y.name)===key(x.name)))}));
  if(!saveDeck({commanders:[commander.name],cards,targetBracket:2}))return status("binderBuildStatus","This browser could not save the draft.",true);
  location.href="/deck";
 });
 $("binderExportDeck").addEventListener("click",()=>{if(!draft?.cards.length)return;
  download("deep-cuts-binder-brew.txt",["Commander","1 "+commander.name,"","Deck",...draft.cards.map(c=>c.qty+" "+c.name),"",draft.complete?"# 100-card starter draft — recheck rulings":"# INCOMPLETE: "+draft.missingSlots+" slots remain"].join("\n"))});
 const seed=new URLSearchParams(location.search).get("commander");if(seed&&seed.length<=130)$("binderCommander").value=seed;
}
if(document.body.dataset.deepTool==="deep-cut-finder")runFinder();
if(document.body.dataset.deepTool==="binder-to-brew")runBinder();
