/* Standalone Combo Finder: Commander Spellbook is authoritative for listed combo records. */
import {parseLines} from "./shared.js";
const $=id=>document.getElementById(id);
const mk=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
const status=(id,message)=>{const e=$(id);if(e)e.textContent=message};
function spellbookVariants(value){
 if(Array.isArray(value))return value;
 if(Array.isArray(value?.variants))return value.variants;
 if(Array.isArray(value?.results))return value.results;
 if(Array.isArray(value?.data))return value.data;
 return [];
}
function variantCardNames(v){
 const item=v?.variant||v?.combo||v;
 return (item?.uses||item?.cards||[]).map(x=>x?.card?.name||x?.name||"").filter(Boolean);
}
function showComboList(id,records,type){
 const root=$(id);root.replaceChildren();
 const list=spellbookVariants(records);
 if(!list.length){root.append(mk("p","helper-note",type==="included"?"No confirmed complete combos returned.":"No one-card-away combos returned."));return}
 for(const value of list.slice(0,15)){
  const variant=value?.variant??value?.combo??value,box=mk("article","combo-result"),
   names=variantCardNames(value),effects=(variant?.produces||[]).map(x=>x?.feature?.name||x?.name).filter(Boolean);
  
  box.append(mk("strong",null,names.join(" + ")||variant?.name||"Commander Spellbook combo"));
  if(effects.length)box.append(mk("div","combo-effect","Result: "+effects.slice(0,3).join(" · ")));
  if(type==="missing"){
   const remaining=(value?.missingCards||value?.missing||value?.notIncluded||[]).map(x=>x?.card?.name||x?.name||x).filter(x=>typeof x==="string");
   if(remaining.length)box.append(mk("div","combo-effect","Missing: "+remaining.join(", ")));
  }
  if(variant?.easyPrerequisites)box.append(mk("p","combo-effect","Requires: "+String(variant.easyPrerequisites).slice(0,280)));
  const link=mk("a",null,"VIEW VERIFIED COMBO ↗");
  const idValue=String(variant?.id||"");
  link.href=/^[a-zA-Z0-9-]+$/.test(idValue)&&idValue?"https://commanderspellbook.com/combo/"+idValue+"/":"https://commanderspellbook.com/";
  link.target="_blank";link.rel="noopener noreferrer";box.append(link);root.append(box);
 }
 if(list.length>15)root.append(mk("p","helper-note","Showing 15 of "+list.length+" returned combos."));
}
function showBracketSignals(data){
 const root=$("bracketSignals");root.replaceChildren();root.append(mk("h3",null,"Spellbook's combo and bracket flags"));
 if(!data){root.append(mk("p","helper-note","Bracket details were unavailable from Spellbook."));return}
 const fields=[
 ["bannedCards","Banned cards"],["gameChangerCards","Game Changers"],["massLandDenialCards","Mass land denial cards"],
 ["massLandDenialCombos","Land denial combos"],["extraTurnCards","Extra-turn cards"],
 ["extraTurnsCombos","Extra-turn combos"],["lockCombos","Lock combos"],
 ["twoCardCombos","Two-card combos"],["controlAllOpponentsCombos","Opponent-control combos"]
 ];
 if(data.bracketTag)root.append(mk("p","helper-note","Spellbook's internal bracket tag: "+data.bracketTag+". This is not a definitive Wizards bracket 1–5 score."));
 const grid=mk("div","role-grid");
 let any=false;
 for(const [key,label] of fields){
  const value=data[key]??data[key[0].toLowerCase()+key.slice(1)];
  const count=Array.isArray(value)?value.length:typeof value==="number"?value:null;
  if(count===null)continue;any=true;
  const item=mk("div","role-metric");item.append(mk("span",null,label),mk("strong",null,String(count)));grid.append(item);
 }
 if(any)root.append(grid);
 else root.append(mk("p","helper-note","Spellbook returned a result, but no documented flag counts were present in this response."));
 const raw=mk("details"),summary=mk("summary",null,"Inspect source category names");raw.append(summary);
 const pre=mk("pre","helper-note",Object.keys(data).slice(0,35).join(" · "));pre.style.whiteSpace="pre-wrap";raw.append(pre);root.append(raw);
}

function validate(){
 const commanders=$("comboCommander").value.split(/\r?\n/).map(x=>x.trim().replace(/^\d+\s+/,"")).filter(Boolean);
 const parsed=parseLines($("comboInput").value);
 const all=[...commanders,...parsed.commanders];
 const distinct=[...new Set(all.map(x=>x.toLocaleLowerCase()))];
 const cards=parsed.cards;
 const total=cards.reduce((n,c)=>n+c.qty,0);
 if(all.length<1||all.length>2||distinct.length!==all.length)throw Error("Provide one or two distinct commanders.");
 if(cards.length<1||cards.length>250||total>250)throw Error("Provide between 1 and 250 main-deck cards.");
 if(parsed.invalid.length)throw Error("Could not parse "+parsed.invalid.length+" lines. Check card counts and formatting.");
 if([...all,...cards.map(x=>x.name)].some(x=>x.length>130))throw Error("Card names must be at most 130 characters.");
 return {commanders:all,cards:cards.map(x=>({name:x.name,qty:x.qty}))};
}
$("comboForm").addEventListener("submit",async event=>{
 event.preventDefault();const button=$("checkCombos");
 button.disabled=true;status("spellbookStatus","Checking documented combos…");
 try{
  const deck=validate();
  const res=await fetch("/api/external",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"combos",deck})});
  const data=await res.json().catch(()=>{throw Error("Combo service returned an unreadable response.")});
  if(!res.ok)throw Error(data.error||"Combo lookup is unavailable.");
  const c=data.combo||{};
  showComboList("combosIncluded",c.included??c.combos??c.present??c,"included");
  showComboList("combosMissing",c.almostIncluded??c.almost_included??c.oneCardAway??[],"missing");
  showBracketSignals(data.bracket);
  status("spellbookStatus","Lookup complete. "+(data.warnings||[]).join(" ")+" Review each combo's prerequisites.");
 }catch(e){status("spellbookStatus",e.message)}
 finally{button.disabled=false}
});
