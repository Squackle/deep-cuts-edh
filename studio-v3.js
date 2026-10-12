/* Deep Cuts Studio 3.0: browser-guided generator, live imports, Spellbook, rules and share links.
   This is purposefully non-generative: card lists/rulings/combos are grounded in external databases. */
import {readDeck,saveDeck,compactCard,normalizedName,GAME_CHANGERS,scryfall,parseLines,toText,sleep,isLand} from "./shared.js";
const $=id=>document.getElementById(id);
const mk=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=String(value);return e};
const status=(id,message)=>{const e=$(id);if(e)e.textContent=message};
const leanDeck=d=>({commanders:(d.commanders||[]).slice(0,2),cards:(d.cards||[]).map(x=>({name:x.name,qty:x.qty})),targetBracket:d.targetBracket});
const server=async(body,path="/api/external")=>{
 const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 let data;try{data=await r.json()}catch{throw new Error("Site backend returned an unexpected response.")}
 if(!r.ok)throw new Error(data.error||"Backend request failed.");
 return data;
};
function collectionCounts(){
 try{const c=JSON.parse(localStorage.getItem("deepcuts-collection-v1"));return c&&typeof c==="object"?c:{}}catch{return {}}
}
function toEntry(record){
 if(typeof record==="string")return{name:record,qty:1,card:null};
 if(!record||typeof record!=="object")return null;
 const card=record.card??record.name??record.cardName??record.card_name??record.oracleName;
 const name=typeof card==="string"?card:card?.name;
 if(!name||typeof name!=="string")return null;
 const qty=Number(record.quantity??record.qty??record.count??1);
 if(!Number.isInteger(qty)||qty<1||qty>250)return null;
 return{name,qty,card:null}
}
function interpretImport(input){
 // Spellbook returns a typed decklist. Also handle alternate response shapes after API upgrades.
 const data=input?.data??input?.deck??input;
 if(typeof data==="string")return parseLines(data);
 if(data?.text&&typeof data.text==="string")return parseLines(data.text);
 if(!data||typeof data!=="object")throw Error("Host returned an unrecognized list. Paste the exported text instead.");
 const main=data.main??data.cards??data.mainboard??data.mainBoard??data.decklist?.main??data.decklist?.cards;
 const cmd=data.commanders??data.commander??data.decklist?.commanders??[];
 const commanders=(Array.isArray(cmd)?cmd:[cmd]).map(toEntry).filter(Boolean).map(x=>x.name);
 let entries=Array.isArray(main)?main:null;
 if(!entries&&main&&typeof main==="object")entries=Object.entries(main).map(([name,quantity])=>({name,quantity}));
 if(!entries||!entries.length)throw Error("Could not identify the imported card list. Use the host's text export.");
 const merged=new Map();
 for(const row of entries){
  const entry=toEntry(row);if(!entry)continue;
  const key=normalizedName(entry.name);const prev=merged.get(key);
  if(prev)prev.qty+=entry.qty;else merged.set(key,entry);
 }
 if(!merged.size)throw Error("Imported list has no recognizable Magic card names.");
 return {cards:[...merged.values()],commanders:commanders.slice(0,2),invalid:[]};
}
$("importDeckUrl")?.addEventListener("click",async()=>{
 const btn=$("importDeckUrl"),value=$("hostDeckUrl").value.trim();
 if(!value){status("importUrlStatus","Paste a public deck URL first.");return}
 btn.disabled=true;status("importUrlStatus","Importing via Commander Spellbook…");
 try{
  const data=await server({action:"import",url:value});
  const parsed=interpretImport(data);
  if(!parsed.cards.length)throw Error("No card names found.");
  if(!confirm("Replace your current deck with "+parsed.cards.length+" imported card entries?"))return;
  window.dispatchEvent(new CustomEvent("deepcuts:loadsnapshot",{detail:{deck:{commanders:parsed.commanders,cards:parsed.cards,targetBracket:Number($("bracketTarget")?.value||2)}}}));
  status("importUrlStatus","Imported "+parsed.cards.length+" unique cards. Commander(s): "+(parsed.commanders.join(" + ")||"not provided; enter manually")+". Click Analyze Deck.");
 }catch(e){status("importUrlStatus",e.message)}
 finally{btn.disabled=false}
});
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
  window.DeepCutsGuide?.registerCardNames(names);
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
$("checkCombos")?.addEventListener("click",async()=>{
 const deck=readDeck(),button=$("checkCombos");
 if(!deck.commanders?.length||!deck.cards?.length){status("spellbookStatus","Enter a commander and cards, then Analyze Deck.");return}
 button.disabled=true;status("spellbookStatus","Querying Commander Spellbook for complete combos, missing pieces, and bracket flags…");
 try{
  const data=await server({action:"combos",deck:leanDeck(deck)});
  const c=data.combo||{};
  showComboList("combosIncluded",c.included??c.combos??c.present??c,"included");
  showComboList("combosMissing",c.almostIncluded??c.almost_included??c.oneCardAway??[],"missing");
  showBracketSignals(data.bracket);
  status("spellbookStatus","Lookup completed. "+(data.warnings||[]).join(" ")+" Read the detailed prerequisites before playing a combo.");
 }catch(e){status("spellbookStatus",e.message)}finally{button.disabled=false}
});
$("lookupRulings")?.addEventListener("click",async()=>{
 const input=$("rulingCard").value.trim(),root=$("rulingsResults");
 root.replaceChildren();if(input.length<2){status("rulingsStatus","Enter a Magic card name.");return}
 const btn=$("lookupRulings");btn.disabled=true;status("rulingsStatus","Searching Scryfall card rulings…");
 try{
  const c=await scryfall("https://api.scryfall.com/cards/named?fuzzy="+encodeURIComponent(input));
  const url=c.rulings_uri||("https://api.scryfall.com/cards/"+encodeURIComponent(c.id)+"/rulings");
  if(!new URL(url).hostname.endsWith("scryfall.com"))throw Error("Unexpected rulings source.");
  const data=await scryfall(url);
  root.append(mk("h3",null,c.name));
  const official=mk("a","text-link","CARD ON SCRYFALL ↗");official.href=c.scryfall_uri||"https://scryfall.com";official.target="_blank";official.rel="noopener noreferrer";root.append(official);
  const entries=(data.data||[]).slice(0,25);
  if(!entries.length)root.append(mk("p","helper-note","No card-specific rulings are listed. Consult the official Comprehensive Rules linked above."));
  for(const entry of entries){const block=mk("article","ruling-entry");block.append(mk("small",null,(entry.source||"Scryfall")+" · "+(entry.published_at||"")));
    block.append(mk("p",null,entry.comment||""));root.append(block)}
  status("rulingsStatus",entries.length+" published rulings shown. For broader interactions, use the official rules document and check the relevant section.");
 }catch(e){status("rulingsStatus","Couldn't find card rulings: "+e.message)}
 finally{btn.disabled=false}
});
$("rulesTopic")?.addEventListener("change",()=>{
 const selected=$("rulesTopic").value;
 $("rulesReferenceLink").title="Open the official Comprehensive Rules and search for section "+selected;
});
let lastShare="";
$("shareDeckCloud")?.addEventListener("click",async()=>{
 const d=readDeck(),btn=$("shareDeckCloud");
 if(!d.commanders?.length||!d.cards?.length){status("sharedDeckStatus","Enter a commander and a deck to share.");return}
 if(!confirm("Store a read-only snapshot on Cloudflare? Anyone who has its link can view and import it. It is not private account storage."))return;
 btn.disabled=true;status("sharedDeckStatus","Saving a cloud snapshot…");
 try{
  const res=await server({deck:{...leanDeck(d),title:(d.commanders||[]).join(" + ")}},"/api/decks");
  lastShare=res.url;$("copyShareUrl").disabled=false;
  const anchor=mk("a",null,res.url);anchor.href=res.url;anchor.target="_blank";anchor.rel="noopener noreferrer";
  $("sharedDeckLink").replaceChildren(anchor);
  status("sharedDeckStatus","Cloud snapshot saved! Copy the link to open this deck on other devices.");
 }catch(e){status("sharedDeckStatus",e.message)}finally{btn.disabled=false}
});
$("copyShareUrl")?.addEventListener("click",async()=>{
 if(!lastShare)return;
 try{await navigator.clipboard.writeText(lastShare);status("sharedDeckStatus","Share link copied.")}catch{status("sharedDeckStatus","Select and copy the link shown below.")}
});
async function loadShared(){
 const id=new URL(location.href).searchParams.get("shared");
 if(!id)return;
 if(!/^[0-9a-f]{32}$/.test(id)){status("sharedDeckStatus","Invalid share link.");return}
 status("sharedDeckStatus","Loading shared deck snapshot…");
 try{
  const r=await fetch("/api/decks?id="+encodeURIComponent(id));
  const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to open deck.");
  const next=data.deck;
  if(!confirm("Load the shared deck '"+(next.title||"Commander deck")+"' into your local workshop? This replaces your current draft."))return;
  const existing=readDeck(),d={cards:next.cards.map(x=>({name:x.name,qty:x.qty,card:null})),commanders:next.commanders,targetBracket:next.targetBracket};
  window.dispatchEvent(new CustomEvent("deepcuts:loadsnapshot",{detail:{deck:d}}));
  status("sharedDeckStatus","Shared deck loaded. Click Analyze Deck to retrieve live card data and diagnostics.");
  document.getElementById("cloudShare")?.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){status("sharedDeckStatus",e.message)}
}
loadShared();
// Guided Scryfall-powered 100-card draft generator. Every suggested card is selected from live
// legal-in-color Scryfall results, but no generated list is represented as playtested.
let generated=null;
const pools={
 ramp:['otag:ramp','(t:artifact o:"add mana")'],
 draw:['otag:draw','o:"draw a card"'],
 removal:['otag:removal','o:"destroy target creature"'],
 wipe:['otag:boardwipe','o:"destroy all creatures"'],
 protection:['otag:protection','o:"hexproof"'],
 creatures:['t:creature','t:creature'],
 tokens:['o:"create" o:"token"','otag:tokens'],
 graveyard:['o:"from your graveyard"','o:"reanimate"'],
 sacrifice:['o:"sacrifice"','o:"whenever a creature dies"'],
 spells:['o:"instant or sorcery"','t:instant'],
 equipment:['t:equipment','o:"equipped creature"'],
 counters:['o:"+1/+1 counter"','o:"proliferate"'],
 lands:['o:"landfall"','o:"whenever a land enters"'],
 tribal:['o:"creatures you control"','t:creature'],
 control:['o:"counter target"','t:instant'],
 flexible:['t:creature','t:artifact'],
 land:['t:land -t:basic','t:land']
};
const nextBudget=()=>Number($("genBudget").value)||Infinity;
const validColors=["W","U","B","R","G"];
async function fetchPool(role,identity,priceCap,searchBias=""){
 const phrases=pools[role]||pools.flexible;
 for(let i=0;i<phrases.length;i++){
  const terms=[
   "f:commander","game:paper","id<="+(identity.join("").toLowerCase()||"c"),
   phrases[i],role==="land"?"":"-t:land",
   Number.isFinite(priceCap)?"usd<"+Math.max(0.7,priceCap/38).toFixed(2):"",
   searchBias
  ].filter(Boolean).join(" ");
  const url="https://api.scryfall.com/cards/search?"+new URLSearchParams({q:terms,unique:"cards",order:"edhrec",dir:"asc",include_extras:"false"});
  try{const result=await scryfall(url);if(result.data?.length)return result.data}
  catch(e){if(i===phrases.length-1)return []}
  await sleep(150);
 }
 return [];
}
function generatedPreview(data){
 const root=$("generatorPreview");root.replaceChildren();
 const head=mk("p","helper-note",data.note);root.append(head);
 const grid=mk("div","studio-preview-grid");
 for(const [role,items] of Object.entries(data.categories)){
  const box=mk("article","studio-preview-group");box.append(mk("h4",null,role.replace(/^./,x=>x.toUpperCase())+" · "+items.reduce((a,x)=>a+x.qty,0)));
  const small=mk("small",null,items.slice(0,15).map(x=>x.qty+" "+x.name).join("\n"));small.style.whiteSpace="pre-line";box.append(small);
  if(items.length>15)box.append(mk("small",null,"…plus "+(items.length-15)+" more entries."));
  grid.append(box)
 }root.append(grid);
}
function isFast(card){
 return /^(Sol Ring|Mana Vault|Chrome Mox|Mox Diamond|Jeweled Lotus|Lion's Eye Diamond|Lotus Petal)$/i.test(card.name);
}
async function generate(){
 const btn=$("generateDeck"),second=$("genPartner")?.value.trim()||"";
 const first=$("genCommander").value.trim();
 if(first.length<3){status("generatorStatus","Enter your commander name to begin.");return}
 btn.disabled=true;$("applyGenerated").disabled=true;generated=null;
 let theme=$("genTheme").value;
 const budget=nextBudget(),bracket=Number($("genBracket").value),
 tribe=$("genTribe").value.trim(),avoidChangers=$("genNoChangers").checked||bracket<=2,
 avoidTutors=$("genNoTutors").checked,avoidFast=$("genNoFast").checked||bracket<=2,
 owned=$("genOwned").checked?collectionCounts():null;
 try{
  status("generatorStatus","Checking commander legality and color identity…");
  const commander=[await scryfall("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(first))];
  if(second)commander.push(await scryfall("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(second)));
  for(const c of commander){
   if(c.legalities?.commander!=="legal")throw Error(c.name+" is not Commander legal.");
   if(!/Legendary Creature/i.test(c.type_line||"")&&!/can be your commander/i.test(c.oracle_text||""))throw Error(c.name+" is not eligible to be a commander.");
  }
  if(commander.length===2&&!commander.every(c=>/partner|friends forever|choose a background|doctor's companion/i.test(c.oracle_text||"")))throw Error("These commanders do not appear to have compatible partner/background permissions.");
  const identity=[...new Set(commander.flatMap(c=>c.color_identity||[]))].sort((a,b)=>validColors.indexOf(a)-validColors.indexOf(b));
  if(theme==="surprise"){
   const oracle=commander.map(c=>c.oracle_text||"").join(" ").toLowerCase();
   const patterns=[["graveyard",/graveyard|reanimate|mill/],["sacrifice",/sacrifice|dies/],["tokens",/create .*tokens?|populate/],["equipment",/equip|equipment/],["spells",/instant or sorcery|cast.*spell/],["counters",/\+1\/\+1 counter|proliferate/],["lands",/landfall|land enters/],["tribal",/creature type|shares a creature type/]];
   theme=(patterns.find(x=>x[1].test(oracle))||["creatures"])[0];
  }

  const cmdNames=commander.map(c=>c.name),cmdCost=commander.reduce((a,c)=>a+(Number(c.prices?.usd)||0),0);
  if(Number.isFinite(budget)&&cmdCost>budget)throw Error("Commander price alone appears to exceed the budget target.");
  const targetLands=36,targetSpells=100-commander.length-targetLands,selected=new Map(),groups={},used=new Set(cmdNames.map(normalizedName));
  let spent=cmdCost,unpriced=commander.filter(x=>!x.prices?.usd).length;
  const goal={ramp:10,draw:9,removal:9,wipe:3,protection:4};
  goal[theme==="surprise"?"creatures":theme]=19;
  goal.flexible=targetSpells-Object.values(goal).reduce((a,x)=>a+x,0);
  const finish=$("genFinish").value;
  if(finish==="value"){goal.draw+=2;goal.flexible-=2}
  if(finish==="combat"){goal[theme]+=2;goal.flexible-=2}
  if(finish==="combo"){goal.protection+=2;goal.flexible-=2}

  if($("genInteraction").value==="high"){goal.removal+=4;goal.flexible-=4}
  if($("genInteraction").value==="low"){goal.removal-=3;goal.flexible+=3}
  const roles=Object.keys(goal);
  let totalSpells=0;
  for(const role of roles){
   const quota=Math.max(0,goal[role]);
   const bias=(role==="tribal"&&tribe)?("t:"+tribe.replace(/[^a-zA-Z]/g,"")):"";
   status("generatorStatus","Finding "+role+" cards ("+totalSpells+"/"+targetSpells+" spells selected)…");
   const options=await fetchPool(role,identity,budget,bias);await sleep(160);
   const qualified=options.filter(c=>
      c?.legalities?.commander==="legal"&&!used.has(normalizedName(c.name))&&
      (c.color_identity||[]).every(color=>identity.includes(color))&&
      (!avoidChangers||!GAME_CHANGERS.has(normalizedName(c.name)))&&
      (!avoidFast||!isFast(c))&&
      (!avoidTutors||!/search your library for a (nonland|card|creature|instant|sorcery|enchantment|artifact)/i.test(c.oracle_text||""))&&
      (!Number.isFinite(budget)||((Number(c.prices?.usd)||0)>0&&(Number(c.prices.usd)||0)<=Math.max(2,budget/15)))&&
      !isLand(c)
   ).sort((a,b)=>{
     const na=normalizedName(a.name),nb=normalizedName(b.name);
     return (owned?(owned[nb]?1:0)-(owned[na]?1:0):0)||((Number(a.prices?.usd)||0)-(Number(b.prices?.usd)||0));
   });
   groups[role]=[];
   for(const c of qualified){
    if(groups[role].length>=quota||totalSpells>=targetSpells)break;
    const price=Number(c.prices?.usd)||0;
    if(Number.isFinite(budget)&&spent+price+8>budget)continue;
    const entry={name:c.name,qty:1,card:compactCard(c)};
    used.add(normalizedName(c.name));selected.set(normalizedName(c.name),entry);groups[role].push(entry);
    spent+=price;if(!price)unpriced++;totalSpells++;
   }
  }
  if(totalSpells<targetSpells){
   status("generatorStatus","Filling gaps from affordable legal Commander cards…");
   const more=await fetchPool("flexible",identity,budget);
   groups.flexible=groups.flexible||[];
   for(const c of more){
    if(totalSpells>=targetSpells)break;
    const key=normalizedName(c.name),price=Number(c.prices?.usd)||0;
    if(used.has(key)||isLand(c)||c.legalities?.commander!=="legal"||
      c.color_identity?.some(x=>!identity.includes(x))||(avoidChangers&&GAME_CHANGERS.has(key))||
      (avoidFast&&isFast(c))||(!price&&Number.isFinite(budget))||
      (Number.isFinite(budget)&&spent+price+8>budget))continue;
    const e={name:c.name,qty:1,card:compactCard(c)};used.add(key);groups.flexible.push(e);selected.set(key,e);spent+=price;totalSpells++;
   }
  }
  status("generatorStatus","Assembling mana base and checking final count…");
  const basics={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest"};
  const lands=[];const landCandidates=await fetchPool("land",identity,budget);
  for(const c of landCandidates){
   if(lands.length>=11)break;
   const price=Number(c.prices?.usd)||0,key=normalizedName(c.name);
   if(used.has(key)||!isLand(c)||c.legalities?.commander!=="legal"||c.color_identity?.some(color=>!identity.includes(color))||
     !price||(Number.isFinite(budget)&&spent+price+7>budget))continue;
   used.add(key);lands.push({name:c.name,qty:1,card:compactCard(c)});spent+=price;
  }
  const colors=identity.length?identity:["C"];
  const n=targetLands-lands.reduce((a,e)=>a+e.qty,0);
  for(let i=0;i<n;i++){
   const color=colors[i%colors.length],name=basics[color]||"Wastes";
   const found=lands.find(c=>c.name===name);
   if(found)found.qty++;else lands.push({name,qty:1,card:null});
  }
  groups.lands=lands;
  // A 100-card snapshot is always produced, but if search pools underfill,
  // the missing slots are filled with basics and explicitly flagged.
  let shortage=Math.max(0,targetSpells-totalSpells);
  while(shortage-->0){
   const name=basics[identity[0]]||"Wastes";
   const found=lands.find(c=>c.name===name);
   if(found)found.qty++;else lands.push({name,qty:1,card:null});
  }
  const cards=[...selected.values(),...lands];
  const total=cards.reduce((n,x)=>n+x.qty,0)+cmdNames.length;
  if(total!==100)throw Error("Draft has "+total+" cards instead of 100; no changes were made.");
  const countLands=lands.reduce((n,x)=>n+x.qty,0),issues=[];
  if(countLands>targetLands)issues.push("Only "+totalSpells+" nonland cards were found. Extra basic lands filled the remaining slots.");
  if(unpriced)issues.push(unpriced+" nonland/commander prices were unavailable.");
  if(Number.isFinite(budget))issues.push("Price estimate excludes basic lands and missing/variable printing prices.");
  if(bracket>=4)issues.push("High bracket target requires strategy tuning and a real playtest; this is not an optimized cEDH list.");
  generated={deck:{commanders:cmdNames,cards,targetBracket:bracket},categories:groups,note:"100 cards · "+countLands+" lands · "+totalSpells+" nonlands · approximately $"+spent.toFixed(2)+" known prices. "+issues.join(" ")};
  generatedPreview(generated);$("applyGenerated").disabled=false;
  status("generatorStatus",(countLands>43?"Warning: draft is land-heavy because card searches underfilled the spell slots. ":"")+"100-card draft ready for review. No changes to your existing deck yet.");
 }catch(e){status("generatorStatus","Draft couldn't be completed: "+e.message)}
 finally{btn.disabled=false}
}
$("generateDeck")?.addEventListener("click",generate);
$("applyGenerated")?.addEventListener("click",()=>{
 if(!generated)return;
 if(!confirm("Replace your current Workshop deck with this generated 100-card draft?"))return;
 window.dispatchEvent(new CustomEvent("deepcuts:loadsnapshot",{detail:{deck:generated.deck}}));
 status("generatorStatus","Draft loaded. Click Analyze Deck to refresh legality, color sources and prices.");
 document.getElementById("commanderField")?.scrollIntoView({behavior:"smooth",block:"center"});
});

// Secret-key cloud vault. No third-party OAuth or account sync is claimed.
const VAULT_KEY_LOCAL="deepcuts-vault-key-v1";
const savedVaultKey=(()=>{try{return localStorage.getItem(VAULT_KEY_LOCAL)||""}catch{return ""}})();
if(savedVaultKey){$("vaultKey").value=savedVaultKey;$("rememberVault").checked=true}
function keepVaultKey(){
 try{if($("rememberVault").checked)localStorage.setItem(VAULT_KEY_LOCAL,$("vaultKey").value.trim());else localStorage.removeItem(VAULT_KEY_LOCAL)}catch{}
}
$("rememberVault")?.addEventListener("change",keepVaultKey);
$("vaultKey")?.addEventListener("change",keepVaultKey);
async function vaultAction(action,body={}){
 const r=await fetch("/api/vault",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...body})});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Vault request failed.");return data;
}
$("createVault")?.addEventListener("click",async()=>{
 const d=readDeck();if(!d.cards?.length||!d.commanders?.length){status("vaultStatus","Build a Commander deck first.");return}
 if(!confirm("Create a new cloud vault with a one-time recovery key? The deck is stored in the site's database."))return;
 const b=$("createVault");b.disabled=true;status("vaultStatus","Creating your vault…");
 try{const data=await vaultAction("create",{deck:leanDeck(d)});$("vaultKey").value=data.key;keepVaultKey();status("vaultStatus","Vault created! Immediately copy and back up this recovery key. It cannot be reset or recovered.")}catch(e){status("vaultStatus",e.message)}finally{b.disabled=false}
});
$("saveVault")?.addEventListener("click",async()=>{
 const key=$("vaultKey").value.trim(),d=readDeck();
 if(!key||!d.cards?.length){status("vaultStatus","Enter the recovery key and a deck to save.");return}
 const b=$("saveVault");b.disabled=true;status("vaultStatus","Updating your cloud deck…");
 try{const data=await vaultAction("save",{key,deck:leanDeck(d)});keepVaultKey();status("vaultStatus","Vault updated. The same key opens the newest saved deck on another device.")}catch(e){status("vaultStatus",e.message)}finally{b.disabled=false}
});
$("loadVault")?.addEventListener("click",async()=>{
 const key=$("vaultKey").value.trim();if(!key){status("vaultStatus","Enter your vault recovery key.");return}
 const b=$("loadVault");b.disabled=true;status("vaultStatus","Loading cloud deck…");
 try{const data=await vaultAction("load",{key});if(!confirm("Replace your current draft with the deck saved in your vault?"))return;
 const d={cards:data.deck.cards.map(x=>({...x,card:null})),commanders:data.deck.commanders,targetBracket:data.deck.targetBracket};
 window.dispatchEvent(new CustomEvent("deepcuts:loadsnapshot",{detail:{deck:d}}));keepVaultKey();
 status("vaultStatus","Cloud deck loaded. Click Analyze Deck to refresh card rulings, legality and prices.");}
 catch(e){status("vaultStatus",e.message)}finally{b.disabled=false}
});
$("copyVaultKey")?.addEventListener("click",async()=>{
 const key=$("vaultKey").value.trim();if(!key){status("vaultStatus","Create or enter a recovery key first.");return}
 try{await navigator.clipboard.writeText(key);status("vaultStatus","Recovery key copied. Store it privately; anyone who obtains it can read and overwrite your cloud deck.")}
 catch{status("vaultStatus","Clipboard blocked; copy the recovery key from the field manually.")}
});


function handSample(count){
 const deck=readDeck(),library=[];
 for(const c of deck.cards||[])for(let i=0;i<Math.min(c.qty,250);i++)library.push(c.name);
 if(!library.length){status("generatorStatus","Add a deck first to sample hands.");return}
 for(let i=library.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[library[i],library[j]]=[library[j],library[i]]}
 const hand=library.slice(0,count),landSet=new Set((deck.cards||[]).filter(c=>/Land/i.test(c.card?.type_line||"")||/^(Plains|Island|Swamp|Mountain|Forest|Wastes)$/i.test(c.name)).map(c=>normalizedName(c.name)));
 const lands=hand.filter(n=>landSet.has(normalizedName(n))).length;
 $("sampleHandResult").textContent="Sample "+hand.length+"-card hand ("+lands+" lands): "+hand.join(" · ")+". Commander is in the command zone.";
}
$("sampleHand")?.addEventListener("click",()=>handSample(7));
$("sampleTen")?.addEventListener("click",()=>handSample(10));
