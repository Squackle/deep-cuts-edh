import {key,CASES,parseCollection,roleOf,validCommander,allowed,synergySignal} from "./deep-tools-core.js";
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
const FILTER_KEY="deepcuts:finder-owned-filter:v1";
function loadOwnedNames(){
 try{const names=JSON.parse(localStorage.getItem(FILTER_KEY)||"[]");inventory=Array.isArray(names)?names.filter(n=>typeof n==="string"&&n.length<=130).slice(0,2500).map(name=>({name,quantity:1})):[]}
 catch{inventory=[]}return inventory;
}
function initOwnedImport(){
 const form=$("finderImport"),file=$("finderCsvFile"),input=$("finderOwnedList"),message=$("finderOwnedStatus");loadOwnedNames();
 message.textContent=inventory.length?inventory.length+" card names stored on this browser.":"Optional: locally import card names without an account.";
 file.addEventListener("change",async()=>{const f=file.files?.[0];if(!f)return;if(f.size>260000){message.textContent="File exceeds 260 KB.";return}input.value=await f.text();message.textContent="Review the import before saving."});
 form.addEventListener("submit",e=>{e.preventDefault();try{const result=parseCollection(input.value);const rows=result.cards.map(x=>({name:x.name,quantity:x.quantity}));localStorage.setItem(FILTER_KEY,JSON.stringify(rows.map(x=>x.name)));inventory=rows;message.textContent=rows.length+" names saved locally."+ (result.invalid.length?" "+result.invalid.length+" invalid rows skipped.":"");renderFinder()}catch(err){message.textContent=err.message}});
 $("finderClearOwned").addEventListener("click",()=>{inventory=[];try{localStorage.removeItem(FILTER_KEY)}catch{}input.value="";message.textContent="Local filter cleared.";renderFinder()});
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
  const actions=node("div",undefined,"dt-card-actions"),add=node("button","COPY CARD NAME","dt-button dt-small");add.type="button";
  add.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(c.name);status("finderStatus",c.name+" copied. Paste it into your deckbuilder.")}catch{status("finderStatus","Clipboard unavailable. Select the card name above to copy it.",true)}});
  actions.append(add);if(inventory.some(o=>key(o.name)===key(c.name)))actions.append(node("span","IN YOUR BINDER","dt-owned-mark"));
  info.append(actions);const item=node("article",undefined,"dt-card");item.append(art,info);results.append(item);
 }
}
function runFinder(){
 initOwnedImport();
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
   loadOwnedNames();
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
if(document.body.dataset.deepTool==="deep-cut-finder")runFinder();
