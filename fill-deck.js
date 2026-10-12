/* Fill an existing Commander deck to 100 without overwriting user choices.
   Proposals are derived from actual Scryfall card data and remain opt-in. */
import {readDeck,parseLines,normalizedName,compactCard,scryfall,isLand,isBasic,GAME_CHANGERS,sleep} from "./shared.js";
const $=id=>document.getElementById(id);
const roleLabels={lands:"Mana base",ramp:"Mana acceleration",draw:"Card draw",removal:"Interaction",wipe:"Board wipes",protection:"Protection",theme:"Commander synergy",flex:"Flexible spells"};
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const number=x=>Number(x)||0;
let proposal=null,busy=false,runId=0;
const feedback=(message,isError=false)=>{
  const el=$("fillStatus");el.textContent=message;el.classList.toggle("error",isError);
};
function rawSnapshot(){
  const raw=$("deckInput").value;
  const parsed=parseLines(raw);
  let commanders=$("commanderField").value.split(/\r?\n/).map(s=>s.trim().replace(/^\d+\s*x?\s+/i,"")).filter(Boolean);
  if(!commanders.length)commanders=parsed.commanders;
  commanders=commanders.slice(0,2);
  const held=readDeck(),cache=new Map(held.cards.map(c=>[normalizedName(c.name),c.card]));
  const cmdNames=new Set(commanders.map(normalizedName));
  const cards=parsed.cards.filter(x=>!cmdNames.has(normalizedName(x.name))).map(x=>({...x,card:cache.get(normalizedName(x.name))||null}));
  const deck={commanders,cards,targetBracket:Number($("bracketTarget").value)||2};
  return{deck,invalid:parsed.invalid,signature:JSON.stringify({raw,commanders,bracket:deck.targetBracket})};
}
function countDeck(deck){return deck.commanders.length+deck.cards.reduce((sum,c)=>sum+number(c.qty),0)}
function colorNames(ids){return ids.map(c=>({W:"white",U:"blue",B:"black",R:"red",G:"green"}[c]||"colorless"))}
const basicNames={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest",C:"Wastes"};
function detectTheme(commanders){
 const oracle=commanders.map(c=>c.oracle_text||"").join(" ").toLowerCase();
 const candidates=[
  ["graveyard",/graveyard|reanimat|mill/,"Helps your commander use the graveyard"],
  ["sacrifice",/sacrifice|creature dies|when.*dies/,"Supplies sacrifice and death-trigger interactions"],
  ["tokens",/create .*token|tokens? you control/,"Develops tokens for your commander's game plan"],
  ["equipment",/equip|equipment|attached/,"Adds equipment synergies"],
  ["lands",/landfall|land enters|land cards/,"Supports your commander's land-based plan"],
  ["counters",/counters? on|proliferate|\+1\/\+1/,"Adds counter-based interactions"],
  ["spells",/instant or sorcery|whenever you cast|copy target spell/,"Rewards your commander's spellcasting plan"],
  ["artifacts",/artifact you control|artifact enters/,"Adds artifact-centered interactions"]
 ];
 return candidates.find(x=>x[1].test(oracle))||["creatures",null,"Adds synergistic creatures and threats"];
}
function roles(c){
 const text=String(c?.oracle_text||"").toLowerCase(),type=String(c?.type_line||""),name=String(c?.name||"");
 const r=new Set();
 if(isLand(c)){r.add("lands");return r}
 if(/add (\{|one mana|two mana|three mana)|search your library for (a|up to).*land/i.test(text)||/\b(sol ring|arcane signet|mind stone|fellwar stone|talisman)\b/i.test(name))r.add("ramp");
 if(/draw (a|one|two|three|four|x|that many|equal to|cards?)/i.test(text)||/whenever .* draws? a card/i.test(text))r.add("draw");
 if(/destroy target|exile target|counter target|return target .* hand|deals? [0-9x]+ damage to target/i.test(text))r.add("removal");
 if(/destroy all|exile all|each creature gets -|destroy each/i.test(text))r.add("wipe");
 if(/indestructible|hexproof|phase out|ward|protection from/i.test(text))r.add("protection");
 return r;
}
function describe(role,theme,c,identity){
 if(role==="lands")return "Adds a "+(identity.length===1?colorNames(identity)[0]:"needed")+" mana source to move toward a stable land count.";
 if(role==="ramp")return "Helps you cast your commander and expensive plays earlier.";
 if(role==="draw")return "Keeps cards flowing so the deck doesn't run out of gas.";
 if(role==="removal")return "Answers opposing threats rather than relying only on your main plan.";
 if(role==="wipe")return "Gives you a way to reset a crowded or losing board.";
 if(role==="protection")return "Helps keep key creatures or engines on the battlefield.";
 if(role==="theme")return theme[2]+".";
 return "Rounds out the deck with an additional legal, affordable threat or utility spell.";
}
async function resolveExisting(deck){
 const missing=deck.cards.filter(x=>!x.card);
 if(!missing.length)return;
 const dataByName=new Map();
 for(let i=0;i<missing.length;i+=75){
  if(i>0)await sleep(140);
  const response=await scryfall("https://api.scryfall.com/cards/collection",{
   method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({identifiers:missing.slice(i,i+75).map(x=>({name:x.name}))})
  });
  for(const card of response.data||[])dataByName.set(normalizedName(card.name),compactCard(card));
 }
 for(const entry of missing)if(dataByName.has(normalizedName(entry.name)))entry.card=dataByName.get(normalizedName(entry.name));
}
function selectionSignature(){return rawSnapshot().signature}
function viable(candidate,identity,used,bracket,cap,budget,knownCost,chosenCost){
 if(!candidate?.name||used.has(normalizedName(candidate.name))||isLand(candidate))return false;
 if(candidate.legalities?.commander!=="legal")return false;
 if((candidate.color_identity||[]).some(color=>!identity.includes(color)))return false;
 if((candidate.type_line||"").startsWith("Basic Land"))return false;
 if(bracket<=2&&GAME_CHANGERS.has(normalizedName(candidate.name.split(" // ")[0])))return false;
 const price=Number(candidate.prices?.usd);
 if(!Number.isFinite(price)||price<=0||price>cap)return false;
 if(Number.isFinite(budget)&&knownCost+chosenCost+price>budget)return false;
 return true;
}
async function searchRole(role,theme,identity,budget,missingSlotCount){
 const phrase={
  ramp:'otag:ramp',draw:'otag:draw',removal:'otag:removal',wipe:'otag:boardwipe',
  protection:'otag:protection',
  flex:'t:creature'
 }[role]||({
  graveyard:'o:"graveyard"',sacrifice:'o:"sacrifice"',tokens:'o:"token"',
  equipment:'t:equipment',lands:'o:"landfall"',counters:'o:"+1/+1 counter"',
  spells:'o:"instant or sorcery"',artifacts:'t:artifact',creatures:'t:creature'
 }[theme[0]]||"t:creature");
 const cap=Number.isFinite(budget)?Math.max(1.5,Math.min(12,budget/15)):50;
 const terms=[
  "f:commander","game:paper","id<="+(identity.join("").toLowerCase()||"c"),
  "-t:land",phrase,"usd<="+cap.toFixed(2)
 ];
 const q=terms.join(" ");
 const u="https://api.scryfall.com/cards/search?"+new URLSearchParams({q,unique:"cards",order:"edhrec",dir:"asc"});
 const data=await scryfall(u);
 return data.data||[];
}
function chooseBasic(identity,entries,newBasics,sourcePips){
 if(!identity.length)return"C";
 const score=Object.fromEntries(identity.map(color=>[color,Number(sourcePips[color]||1)*0.6]));
 for(const e of entries){
   const sources=e.card?.produced_mana||[];
   for(const color of identity){
     if(e.name===basicNames[color]||sources.includes(color))score[color]-=e.qty;
   }
 }
 for(const color of identity)score[color]-=(newBasics[color]||0);
 return identity.slice().sort((a,b)=>score[b]-score[a])[0];
}
function cardPips(deck){
 const result={W:0,U:0,B:0,R:0,G:0};
 for(const {card,qty} of deck.cards){
  if(!card||isLand(card))continue;
  for(const match of (card.mana_cost||"").matchAll(/\{([^}]+)\}/g)){
   const colored=match[1].split("/").filter(c=>Object.hasOwn(result,c));
   for(const color of colored)result[color]+=qty/colored.length;
  }
 }
 return result;
}
function getNeeds(deck,theme,missing){
 const counter={lands:0,ramp:0,draw:0,removal:0,wipe:0,protection:0};
 const spells=deck.cards.filter(x=>x.card&&!isLand(x.card));
 const mv=spells.reduce((sum,x)=>sum+x.qty*(x.card.cmc||0),0)/Math.max(1,spells.reduce((sum,x)=>sum+x.qty,0));
 const landGoal=Math.max(35,Math.min(38,Math.round(35+Math.max(0,mv-2.5)*1.7)));
 for(const entry of deck.cards)for(const type of roles(entry.card))counter[type]+=entry.qty;
 const landsToAdd=Math.min(missing,Math.max(0,landGoal-counter.lands));
 let spellSlots=missing-landsToAdd;
 const plans=[
  {role:"ramp",target:10},{role:"draw",target:10},{role:"removal",target:9},
  {role:"wipe",target:2},{role:"protection",target:3}
 ];
 const tasks=[];
 for(const plan of plans){
  const count=Math.min(spellSlots,Math.max(0,plan.target-counter[plan.role]));
  tasks.push({role:plan.role,count});spellSlots-=count;
 }
 if(spellSlots>0){tasks.push({role:"theme",count:Math.ceil(spellSlots*0.7)});tasks.push({role:"flex",count:spellSlots-Math.ceil(spellSlots*0.7)})}
 return {landGoal,landsToAdd,counter,tasks};
}
async function generateFill(){
 if(busy)return;
 const btn=$("fillTo100");const snap=rawSnapshot(),deck=snap.deck;
 const count=countDeck(deck),missing=100-count;
 const panel=$("fillSuggestions");panel.hidden=false;
 $("fillGroups").replaceChildren();$("applyFill").disabled=true;proposal=null;
 $("fillSummary").textContent=missing>0?count+" / 100 cards · "+missing+" spaces to fill":count+" / 100 cards";
 if(!deck.commanders.length){feedback("Enter your commander name before filling the deck.",true);return}
 if(snap.invalid.length){feedback("Fix unrecognized decklist lines before continuing: "+snap.invalid.slice(0,4).join("; "),true);return}
 if(count>=100){feedback(count===100?"This deck already contains 100 cards.":"This deck has too many cards. Use Cut to 100 instead.",count>100);return}
 busy=true;btn.disabled=true;$("retryFill").disabled=true;const localRun=++runId;
 try{
  feedback("Checking your commander and existing cards against Scryfall…");
  const commanders=[];
  for(const name of deck.commanders){
   const c=await scryfall("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name));
   if(c.legalities?.commander!=="legal")throw Error(name+" is not currently Commander-legal.");
   if(!/Legendary Creature/i.test(c.type_line||"")&&!/can be your commander/i.test(c.oracle_text||""))throw Error(name+" is not an eligible Commander.");
   commanders.push(c);await sleep(135);
  }
  if(commanders.length===2&&!commanders.every(x=>/Partner|Friends forever|Choose a Background|Doctor's companion/i.test(x.oracle_text||""))){
   throw Error("This pair doesn't appear to have a matching partner/background ability. Verify pairing before filling.");
  }
  const identity=[...new Set(commanders.flatMap(c=>c.color_identity||[]))];
  await resolveExisting(deck);
  const unknown=deck.cards.filter(x=>!x.card).map(x=>x.name);
  if(unknown.length)throw Error("Couldn't identify "+unknown.slice(0,5).join(", ")+(unknown.length>5?" and "+(unknown.length-5)+" more":"")+". Check spelling or analyze the deck first.");
  const illegal=deck.cards.filter(x=>x.card.legalities?.commander!=="legal"||x.card.color_identity?.some(c=>!identity.includes(c)));
  if(illegal.length)throw Error("Existing deck has Commander legality/color identity problems ("+illegal.slice(0,3).map(x=>x.name).join(", ")+"). Resolve these first.");
  const theme=detectTheme(commanders);
  const needs=getNeeds(deck,theme,missing);
  const budgetChoice=Number($("fillBudget").value);
  const budget=budgetChoice>0?budgetChoice:Infinity;
  const existingCost=deck.cards.reduce((total,x)=>total+number(x.card?.prices?.usd)*x.qty,0)+commanders.reduce((total,x)=>total+number(x.prices?.usd),0);
  let chosenCost=0;
  const used=new Set([...deck.cards.map(x=>normalizedName(x.name)),...deck.commanders.map(normalizedName)]),
     selections=[],grouped={};
  const knownBasic=cardPips(deck),newBasics={};
  function add(role,card,qty=1,why){
    const price=number(card?.prices?.usd)*qty;
    const item={name:card.name,qty,card:compactCard(card),role,why:why||describe(role,theme,card,identity),cost:price};
    selections.push(item);(grouped[role]??=[]).push(item);chosenCost+=price;used.add(normalizedName(card.name));
    return item;
  }
  const blanks={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest",C:"Wastes"};
  for(let i=0;i<needs.landsToAdd;i++){
    const color=chooseBasic(identity,deck.cards,newBasics,knownBasic);
    newBasics[color]=(newBasics[color]||0)+1;
  }
  for(const [color,qty]of Object.entries(newBasics)){
    const name=blanks[color],why="Helps reach approximately "+needs.landGoal+" lands; improves access to "+(color==="C"?"colorless mana":colorNames([color])[0]+" mana")+".";
    // Basic land cost defaults to zero in the estimator; live price varies by printing.
    const item={name,qty,card:null,role:"lands",why,cost:0};
    selections.push(item);(grouped.lands??=[]).push(item);
  }
  const cap=Number.isFinite(budget)?Math.max(1.5,Math.min(12,budget/15)):50;
  let filledSpellCount=0;
  for(const task of needs.tasks){
   if(!task.count)continue;
   feedback("Finding "+(roleLabels[task.role]||task.role).toLowerCase()+" cards…");
   let candidates=[];
   try{candidates=await searchRole(task.role,theme,identity,budget,missing)}catch(e){/* Continue with broad fallback. */}
   await sleep(150);
   let added=0;
   for(const c of candidates){
    if(added>=task.count)break;
    if(!viable(c,identity,used,deck.targetBracket,cap,budget,existingCost,chosenCost))continue;
    add(task.role,c);
    added++;filledSpellCount++;
   }
  }
  const shortage=missing-selections.reduce((n,s)=>n+s.qty,0);
  if(shortage>0){
   feedback("Filling "+shortage+" remaining slots from general Commander-legal cards…");
   for(const query of ["t:creature","t:artifact","t:enchantment"]){
    if(selections.reduce((n,x)=>n+x.qty,0)>=missing)break;
    let candidates=[];
    try{
     const q=["f:commander","game:paper","id<="+(identity.join("").toLowerCase()||"c"),"-t:land",query,"usd<="+cap.toFixed(2)].join(" ");
     const data=await scryfall("https://api.scryfall.com/cards/search?"+new URLSearchParams({q,unique:"cards",order:"edhrec",dir:"asc"}));
     candidates=data.data||[];
    }catch{}
    for(const c of candidates){
     if(selections.reduce((n,x)=>n+x.qty,0)>=missing)break;
     if(!viable(c,identity,used,deck.targetBracket,cap,budget,existingCost,chosenCost))continue;
     add("flex",c);filledSpellCount++;
    }
    await sleep(150);
   }
  }
  if(localRun!==runId)return;
  const filled=selections.reduce((n,x)=>n+x.qty,0),missingAfter=missing-filled;
  proposal={deck,signature:snap.signature,selections,grouped,missingAfter};
  renderProposal(proposal,100-missing,missing,existingCost,chosenCost,budget);
  if(missingAfter===0){
    feedback("Review "+filled+" proposed additions, then select Apply. Your current cards remain unchanged until then.");
    $("applyFill").disabled=false;
  }else{
    feedback("Found "+filled+" of "+missing+" additions. "+missingAfter+" slots remain because no suitable cards met the color, price and legality limits. Try No budget limit or revise the deck before applying.",true);
  }
 }catch(e){
   feedback(e.message||"Unable to find matching cards right now. Try again.",true);
 }finally{busy=false;btn.disabled=false;$("retryFill").disabled=false}
}
function renderProposal(p,current,needed,existingPrice,newPrice,budget){
 const groups=$("fillGroups");groups.replaceChildren();
 window.DeepCutsGuide?.registerCardNames(p.selections.map(x=>x.name));
 const summary=$("fillSummary");
 summary.textContent=current+" / 100 → "+(current+needed-p.missingAfter)+" / 100 · "+(needed-p.missingAfter)+" cards proposed · approx. $"+newPrice.toFixed(2)+" added"+(Number.isFinite(budget)?" · $"+(existingPrice+newPrice).toFixed(2)+" estimated deck total":"");
 const order=["lands","ramp","draw","removal","wipe","protection","theme","flex"];
 for(const role of order){
  const list=p.grouped[role]||[];if(!list.length)continue;
  const count=list.reduce((n,x)=>n+x.qty,0),details=make("details","fill-group"),head=make("summary");
  head.append(make("strong",null,roleLabels[role]||role),make("span",null,count+" "+(count===1?"card":"cards")));
  details.append(head);
  const inner=make("div","fill-group-list");
  for(const entry of list){
    const row=make("div","fill-proposal-row");
    const heading=make("strong",null,entry.qty+"× "+entry.name);
    const explanation=make("span",null,entry.why);
    const anchor=make("a",null,"View card ↗");
    anchor.href="https://scryfall.com/search?q="+encodeURIComponent('!"'+entry.name+'"');
    anchor.target="_blank";anchor.rel="noopener noreferrer";
    const body=make("div");body.append(heading,explanation);
    row.append(body,anchor);inner.append(row);
  }
  details.append(inner);groups.append(details);
 }
 if(!groups.children.length)groups.append(make("p","helper-note","No additions could be proposed."));
}
$("fillTo100")?.addEventListener("click",generateFill);
$("retryFill")?.addEventListener("click",generateFill);
$("fillClose")?.addEventListener("click",()=>{$("fillSuggestions").hidden=true;proposal=null});
$("applyFill")?.addEventListener("click",()=>{
 if(!proposal||proposal.missingAfter!==0)return;
 if(selectionSignature()!==proposal.signature){feedback("Your deck changed since these suggestions were created. Generate new suggestions first.",true);$("applyFill").disabled=true;return}
 const original=readDeck();
 const kept=proposal.deck.cards.map(x=>({...x}));
 const lookup=new Map(kept.map(x=>[normalizedName(x.name),x]));
 for(const x of proposal.selections){
  const key=normalizedName(x.name);
  const existing=lookup.get(key);
  if(existing)existing.qty+=x.qty;
  else{const entry={name:x.name,qty:x.qty,card:x.card};kept.push(entry);lookup.set(key,entry)}
 }
 const resulting={commanders:proposal.deck.commanders,cards:kept,targetBracket:proposal.deck.targetBracket};
 if(countDeck(resulting)!==100){feedback("The completed deck was not exactly 100 cards, so no changes were made.",true);return}
 if(!confirm("Add "+proposal.selections.reduce((n,x)=>n+x.qty,0)+" reviewed cards to complete this Commander deck? Your existing cards will be preserved."))return;
 window.dispatchEvent(new CustomEvent("deepcuts:loadsnapshot",{detail:{deck:resulting}}));
 proposal=null;$("fillSuggestions").hidden=true;
 const el=$("deckStatus");el.textContent="Deck filled to exactly 100 cards. Click Analyze Deck to refresh legality, mana balance and bracket checks.";
});
function updateFillTitle(){
 const s=rawSnapshot(),count=countDeck(s.deck),button=$("fillTo100");
 if(!button)return;
 button.textContent=count>0&&count<100?"✦ FILL "+(100-count)+" SLOTS TO 100":"✦ FILL TO 100";
}
$("deckInput")?.addEventListener("input",updateFillTitle);
$("commanderField")?.addEventListener("input",updateFillTitle);
window.addEventListener("deepcuts:deckchanged",updateFillTitle);
window.addEventListener("deepcuts:loadsnapshot",()=>{proposal=null;$("fillSuggestions").hidden=true;queueMicrotask(updateFillTitle)});
updateFillTitle();
