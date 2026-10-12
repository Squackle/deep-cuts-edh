
import {KEY,GAME_CHANGERS,manaLetters,readDeck,saveDeck,parseLines,toText,normalizedName,compactCard,scryfall,isBasic,isLand,canRepeat,legalStatus,sleep} from "./shared.js";
const $=id=>document.getElementById(id);
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n};
let deck=readDeck(),commanderCards=[],currentTab="overview",hasAnalyzed=false,lastAnalysis=null;
const status=(text)=>{$("deckStatus").textContent=text};
function loadInputs(){
 $("commanderField").value=(deck.commanders||[]).join("\n");
 $("deckInput").value=(deck.cards||[]).map(c=>c.qty+" "+c.name).join("\n");
 $("bracketTarget").value=String(deck.targetBracket||2);
 renderRows();
}
function store(){saveDeck(deck);renderRows();window.dispatchEvent(new Event("deepcuts:deckchanged"))}
function normalizeDeck(){
 const incoming=parseLines($("deckInput").value);
 const oldCards=new Map((deck.cards||[]).map(c=>[normalizedName(c.name),c.card]));
 let commanders=$("commanderField").value.split(/\r?\n/).map(x=>x.trim().replace(/^\d+\s*[xX]?\s+/,"")).filter(Boolean);
 if(!commanders.length&&incoming.commanders.length)commanders=incoming.commanders;
 const ids=new Set(commanders.map(normalizedName));
 deck={cards:incoming.cards.filter(c=>!ids.has(normalizedName(c.name))).map(c=>({...c,card:oldCards.get(normalizedName(c.name))||null})),commanders:commanders.slice(0,2),targetBracket:Number($("bracketTarget").value)||2};
 store();return incoming.invalid;
}
function renderRows(){
 const container=$("deckRows");container.replaceChildren();
 if(!deck.cards.length){container.append(el("p","No cards yet. Import a list or add cards from the Library.","helper-note"));return}
 for(const card of [...deck.cards].sort((a,b)=>a.name.localeCompare(b.name))){
  const row=el("div",undefined,"deck-row");
  const qty=el("strong",card.qty+"x");
  const name=el("span",card.name,"name");
  const role=el("span",card.card?(isLand(card.card)?"LAND":Math.round(card.card.cmc||0)+" MV"):"?","role");
  const minus=el("button","−");minus.title="Remove one copy of "+card.name;
  minus.addEventListener("click",()=>{card.qty--;if(card.qty<=0)deck.cards=deck.cards.filter(x=>x!==card);store();hasAnalyzed=false;refreshSummary("Deck edited — analyze again for current diagnostics.")});
  const buy=el("a","BUY ↗");buy.href="https://www.tcgplayer.com/search/magic/product?productLineName=magic&q="+encodeURIComponent(card.name)+"&view=grid";buy.target="_blank";buy.rel="noopener noreferrer";buy.title="Find "+card.name+" on TCGplayer";buy.className="mini-buy";row.append(qty,name,role,buy,minus);container.append(row);
 }
}
const gc=c=>GAME_CHANGERS.has(normalizedName(String(c.name||"").split(" // ")[0]));
function sumQty(cards){return cards.reduce((n,c)=>n+(Number(c.qty)||0),0)}
function manaSource(card,color){
 if(!card)return false;
 if((card.produced_mana||[]).includes(color))return true;
 const map={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest"};
 return isBasic(card)&&card.name===map[color];
}
function diagnose(){
 const cards=deck.cards,cmds=commanderCards,total=sumQty(cards)+deck.commanders.length;
 const unknown=cards.filter(x=>!x.card);
 const allKnown=cards.filter(x=>x.card),knownCmds=cmds.filter(Boolean);
 const availableColors=[...new Set(knownCmds.flatMap(x=>x.color_identity||[]))];
 const manaOnly=cards.filter(x=>isLand(x.card));
 const lands=sumQty(manaOnly);
 const spells=cards.filter(x=>x.card&&!isLand(x.card));
 const avgMV=spells.length?spells.reduce((s,x)=>s+(x.card.cmc||0)*x.qty,0)/Math.max(1,sumQty(spells)):null;
 const desiredLands=avgMV===null?37:(avgMV>3.7?38:avgMV<2.3?35:36);
 const sources=Object.fromEntries(manaLetters.map(color=>[color,manaOnly.reduce((s,x)=>s+(manaSource(x.card,color)?x.qty:0),0)]));
 const symbols=Object.fromEntries(manaLetters.map(color=>[color,0]));
 for(const x of spells){
  for(const match of (x.card.mana_cost||"").matchAll(/\{([^}]+)\}/g)){
   const parts=match[1].split("/");
   for(const color of manaLetters)if(parts.includes(color))symbols[color]+=x.qty/parts.filter(k=>manaLetters.includes(k)).length;
  }
 }
 const totalPips=Object.values(symbols).reduce((s,v)=>s+v,0);
 const sourceTargets={};for(const color of availableColors){const share=totalPips?symbols[color]/totalPips:1/Math.max(1,availableColors.length);sourceTargets[color]=Math.max(7,Math.round(7+share*20))}
 const noColors=availableColors.length===0 && knownCmds.length===0;
 const violations=[];
 if(deck.commanders.length<1)violations.push("Choose a commander first.");
 if(deck.commanders.length>2)violations.push("More than two commanders selected.");
 if(knownCmds.length!==deck.commanders.length)violations.push("Some commander names could not be verified.");
 for(const [i,c] of cmds.entries()){
  if(c&&c.legalities?.commander!=="legal")violations.push((deck.commanders[i]||c.name)+" is not currently legal as a Commander card.");
  if(c&&!/legendary creature/i.test(c.type_line||"")&&!/can be your commander/i.test(c.oracle_text||""))violations.push((deck.commanders[i]||c.name)+" does not appear to be an eligible commander; verify special rules.");
 }
 if(knownCmds.length===2&&!knownCmds.every(c=>/\bPartner\b|Choose a Background|Friends forever|Doctor's companion|Partner with|Doctor's Companion/i.test(c.oracle_text||"")))violations.push("Two commanders require a supported partner / background / companion rule. Please verify their pairing.");
 for(const x of cards){
  const c=x.card;if(!c)continue;
  if(legalStatus(c)==="banned"||legalStatus(c)==="not_legal")violations.push(x.name+": not legal in Commander.");
  if(!noColors&&c.color_identity?.some(color=>!availableColors.includes(color)))violations.push(x.name+": outside your commander's color identity.");
  if(x.qty>1&&!canRepeat(c))violations.push(x.name+": "+x.qty+" copies; singleton restriction. Check for text-specific exceptions.");
  if(/a deck can have up to seven cards named/i.test(c.oracle_text||"")&&x.qty>7)violations.push(x.name+": exceeds seven-copy exception.");
 }
 const changers=allKnown.filter(x=>gc(x.card)).map(x=>({...x,name:x.card.name}));
 const target=Number(deck.targetBracket||2),maxGC=target<=2?0:target===3?3:Infinity;
 const badBracket=changers.length>maxGC;
 const tapped=manaOnly.filter(x=>/enters (the battlefield )?tapped/i.test(x.card?.oracle_text||"")).reduce((s,x)=>s+x.qty,0);
 const price=allKnown.reduce((sum,x)=>sum+(Number(x.card.prices?.usd)||0)*x.qty,0)+knownCmds.reduce((sum,x)=>sum+(Number(x.prices?.usd)||0),0);
 const priceMissing=allKnown.filter(x=>!x.card.prices?.usd).length+knownCmds.filter(x=>!x.prices?.usd).length;
 const categories={ramp:0,draw:0,interaction:0};
 for(const x of spells){const text=x.card.oracle_text||"";if(/add \{|add (one|two|three) mana|search your library for (a|up to).*land/i.test(text)||x.card.name==="Sol Ring"||x.card.name==="Arcane Signet")categories.ramp+=x.qty;
 if(/draw (a|one|two|three|four|x|that many|cards?|each player draws)/i.test(text))categories.draw+=x.qty;
 if(/destroy target|exile target|counter target|return target .* to (its owner's|their owner's) hand/i.test(text))categories.interaction+=x.qty;}
 return {total,unknown,lands,desiredLands,avgMV,sources,sourceTargets,symbols,availableColors,violations,changers,target,maxGC,badBracket,tapped,price,priceMissing,categories,cmds,spells,manaOnly,knownCmds};
}
function stat(s){$("statCards").textContent=s.total;$("statLands").textContent=s.unknown.length?"~"+s.lands:s.lands;$("statGamechangers").textContent=s.changers.length}
function p(text,className){return el("p",text,className)}
function heading(text){return el("h3",text)}
function advice(parent,messages){const ul=el("ul",undefined,"advice-list");for(const message of messages)ul.append(el("li",message));parent.append(ul)}
function overview(s,root){
 root.append(heading("Deck condition"));
 const msgs=[
 s.total===100?"Exactly 100 cards including commanders.":s.total>100?s.total-100+" cards over the 100-card Commander limit.":100-s.total+" cards short of 100.",
 "Commander(s): "+(deck.commanders.join(" + ")||"Not selected"),
 s.unknown.length?s.unknown.length+" unresolved card names. Data-dependent checks are incomplete.":"Known card names resolved through Scryfall.",
 s.lands+" lands detected"+(s.unknown.length?" (partial count)":"")+".",
 "Average nonland mana value: "+(s.avgMV===null?"Unknown":s.avgMV.toFixed(2))+".",
 "Rough USD card total: $"+s.price.toFixed(2)+(s.priceMissing?" (excludes "+s.priceMissing+" unavailable prices).":"."),
 "Heuristic deck roles: "+s.categories.ramp+" ramp · "+s.categories.draw+" draw · "+s.categories.interaction+" targeted interaction."
 ];
 advice(root,msgs);
 if(s.violations.length){root.append(heading("Legality / deck construction warnings"));const ul=el("ul",undefined,"advice-list");for(const violation of s.violations)ul.append(el("li",violation,"warning-item"));root.append(ul)}
 if(s.unknown.length)root.append(p("Unresolved: "+s.unknown.slice(0,12).map(x=>x.name).join(", ")+". Confirm spelling and re-analyze.","helper-note"));
 root.append(p("Bracket assessment is advisory. The official brackets consider combos, land denial, extra turns and intent; this prototype cannot automatically verify all of them.","helper-note"));
}
function addToDeck(name,qty=1){
 const match=deck.cards.find(x=>normalizedName(x.name)===normalizedName(name));
 if(match)match.qty+=qty;else deck.cards.push({name,qty,card:null});
 store();loadInputs();hasAnalyzed=false;refreshSummary("Added "+qty+" "+name+". Re-analyze to update legality and mana calculations.");
}
function suggestionCard(text,action,label="ADD TO DECK"){
 const b=el("div",undefined,"swap-suggestion"),caption=p(text),button=el("button",label);button.addEventListener("click",action);b.append(caption,button);return b;
}
function mana(s,root){
 root.append(heading("Repair the mana base"));
 advice(root,[
 s.lands+" lands currently recognized; this deck's tentative target is "+s.desiredLands+".",
 s.tapped+" land(s) explicitly say they enter tapped. Some conditional taplands may not be counted.",
 "Colored mana demands below count mana symbols on spells and are only a starting estimate. Double-faced and conditional sources may require manual review."
 ]);
 const bar=el("div",undefined,"color-bar");
 for(const color of s.availableColors){
  const item=el("div",undefined,"color-source"),dot=el("span",color,"color-dot "+color),text=el("span",s.sources[color]+" sources · "+Number(s.symbols[color]||0).toFixed(0)+" pips");item.append(dot,text);bar.append(item);
 }
 if(!s.availableColors.length)bar.append(p("Choose a recognized commander to calculate colored sources.","helper-note"));
 root.append(bar);
 const lacking=s.availableColors.filter(color=>s.sources[color]<s.sourceTargets[color]);
 if(lacking.length)advice(root,lacking.map(color=>color+": "+s.sources[color]+" detected sources, versus a rough goal of "+s.sourceTargets[color]+"."));
 else root.append(p("No obvious color-source shortage by this simple heuristic. Check opening-hand consistency and untapped sources.","success-item"));
 const basic={W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest"};
 if(s.lands<s.desiredLands){
  const gap=s.desiredLands-s.lands;const toAdd=Math.min(gap,20);
  root.append(heading("Suggested basic-land additions"));
  for(const color of lacking.length?lacking:s.availableColors.length?s.availableColors:[]){
   const name=basic[color];
   root.append(suggestionCard("Add a "+name+" for an additional "+color+" source. "+gap+" lands below tentative target.",()=>addToDeck(name,1),"ADD "+name.toUpperCase()));
  }
  if(!s.availableColors.length)root.append(p("Set your commander first so basic-land suggestions match its colors.","helper-note"));
 }else if(s.lands>s.desiredLands){
  root.append(p("Your land count is "+(s.lands-s.desiredLands)+" above the rough target. Consider trimming excess slow lands only after assessing your ramp and curve.","helper-note"));
 }

 if(lacking.length&&s.lands>=s.desiredLands){
  root.append(heading("Balance basic land colors"));
  let options=0;
  for(const color of lacking){
   const donors=s.availableColors.filter(k=>k!==color&&deck.cards.some(x=>x.name===basic[k]&&x.qty>0))
     .sort((a,b)=>(s.sources[b]-s.sourceTargets[b])-(s.sources[a]-s.sourceTargets[a]));
   if(donors.length){
    const donor=donors[0],from=basic[donor],to=basic[color];
    root.append(suggestionCard("Swap one "+from+" for "+to+" to improve "+color+" access without changing your total land count. Review color balance after the swap.",()=>{
      const old=deck.cards.find(x=>x.name===from&&x.qty>0);
      if(!old){status("Basic land no longer available. Analyze again.");return}
      old.qty--;if(!old.qty)deck.cards=deck.cards.filter(x=>x!==old);
      const existing=deck.cards.find(x=>x.name===to);
      if(existing)existing.qty++;else deck.cards.push({name:to,qty:1,card:null});
      store();loadInputs();hasAnalyzed=false;refreshSummary("Swapped "+from+" for "+to+". Re-analyze mana sources.");
    },"SWAP "+from.toUpperCase()+" → "+to.toUpperCase()));
    options++;
   }
  }
  if(!options)root.append(p("No simple basic-land swap was found. Review slow nonbasic lands or search budget dual lands below.","helper-note"));
 }
 if(s.availableColors.length){
  const query="t:land f:commander id<="+s.availableColors.join("").toLowerCase()+" usd<=3";
  const a=el("a","BROWSE BUDGET LANDS ↗","text-link");a.href="library.html?q="+encodeURIComponent(query);root.append(a);
 }
}
function cutSuggestions(s){
 const mode=$("cutMode")?.value||"balance";
 const excess=s.total-100;if(excess<=0)return [];
 const candidates=[];
 for(const entry of deck.cards){
  const c=entry.card; if(!c)continue;
  const land=isLand(c);
  let score=0;const reasons=[];
  if(legalStatus(c)!=="legal"){score+=100;reasons.push("Not Commander-legal")}
  if(s.availableColors.length&&c.color_identity?.some(k=>!s.availableColors.includes(k))){score+=90;reasons.push("Outside color identity")}
  if(entry.qty>1&&!canRepeat(c)){score+=95;reasons.push("Duplicate outside singleton limit")}
  if(land){
   if(s.lands<=34)score-=100;
   else if(s.lands>s.desiredLands){score+=20;if(/enters (the battlefield )?tapped/i.test(c.oracle_text||""))score+=15;reasons.push("Land count above target")}
   else score-=80;
  }else{
   if(c.cmc>=7){score+=mode==="curve"?35:8;reasons.push("High mana value")}
   if(mode==="curve"&&c.cmc>=5)score+=Math.max(0,c.cmc-4)*6;
   if(mode==="budget"&&Number(c.prices?.usd)>0){score+=Math.min(65,Number(c.prices.usd)*2);reasons.push("Lower-cost cut candidate")}
   if(mode==="bracket"&&(s.target<=3)&&(/take an extra turn|players can't|each player sacrifices.*land/i.test(c.oracle_text||""))){score+=40;reasons.push("High game-warp potential")}
   if(mode==="synergy"){
     const text=(c.oracle_text||"").toLowerCase(),cmd=commanderCards.filter(Boolean).map(x=>x.oracle_text||"").join(" ").toLowerCase();
     const keys=["sacrifice","graveyard","token","cast","equipment","artifact","counter","damage","creature","land"];
     const shared=keys.filter(k=>cmd.includes(k)&&text.includes(k));
     if(!shared.length){score+=25;reasons.push("Limited obvious commander-text overlap")}
   }
   if(mode==="redundancy"){
     const text=(c.oracle_text||"").toLowerCase();
     if(/draw a card|destroy target|add one mana|add \{[wubrgc]\}/.test(text)){score+=15;reasons.push("Common deck role; consider alternatives")}
   }
   if((c.oracle_text||"").length<80){score+=3;reasons.push("Review for deck synergy")}
  }
  if(GAME_CHANGERS.has(normalizedName(String(c.name||"").split(" // ")[0]))&&s.target<=2){score+=50;reasons.push("Game Changer conflicts with target bracket")}
  for(let qty=0;qty<entry.qty;qty++){if(land&&s.lands-s.desiredLands<=qty&&score<50)continue;candidates.push({name:entry.name,score:score-qty*2,reasons:reasons.join("; ")||"Lowest priority review",card:c})}
 }
 return candidates.sort((a,b)=>b.score-a.score).slice(0,excess);
}
function trim(s,root){
 root.append(heading("Cut to exactly 100"));
 if(s.total<100){root.append(p("This deck is missing "+(100-s.total)+" cards. Search the Card Library for relevant ramp, draw, removal and mana-base pieces.","helper-note"));return}
 if(s.total===100){root.append(p("Exactly 100 cards are listed. There is nothing to cut.","success-item"));return}
 if(s.unknown.length){root.append(p("Some cards are unresolved; the cut ranking will be less reliable until all names are checked.","warning-item"))}
 const picks=cutSuggestions(s);
 if(!picks.length){root.append(p("No safe suggestions available. Trim manually and re-analyze.","helper-note"));return}
 root.append(p("These are draft cut candidates, not an optimized deck-building verdict. Nothing changes unless you approve.","helper-note"));
 const count=new Map();for(const x of picks){const value=count.get(x.name)||{qty:0,reason:x.reasons};value.qty++;count.set(x.name,value)}
 for(const [name,v] of count){root.append(p("−"+v.qty+" "+name+" · "+v.reason,"cut-suggestion"))}
 const button=el("button","APPLY "+picks.length+" SUGGESTED CUTS","retro-button dark");
 button.addEventListener("click",()=>{
   if(!confirm("Remove "+picks.length+" suggested cards? You can undo by reimporting your previous decklist."))return;
   for(const x of picks){const entry=deck.cards.find(c=>normalizedName(c.name)===normalizedName(x.name));if(!entry)continue;entry.qty--;if(entry.qty<=0)deck.cards=deck.cards.filter(c=>c!==entry)}
   store();loadInputs();hasAnalyzed=false;refreshSummary("Cuts applied. Re-analyze to verify the adjusted deck.");});
 root.append(button);
}
const swaps={
 "Rhystic Study":"Reconnaissance Mission","Smothering Tithe":"Monologue Tax","Cyclonic Rift":"Aetherize","Demonic Tutor":"Diabolic Tutor","Vampiric Tutor":"Diabolic Intent",
 "Farewell":"Cleansing Nova","Force of Will":"Arcane Denial","Fierce Guardianship":"Negate","Teferi's Protection":"Unbreakable Formation","Necropotence":"Phyrexian Arena",
 "Jeska's Will":"Big Score","Chrome Mox":"Coldsteel Heart","Mana Vault":"Mind Stone","The One Ring":"Endless Atlas","Orcish Bowmasters":"Fell Stinger",
 "Enlightened Tutor":"Open the Armory","Worldly Tutor":"Shared Summons","Survival of the Fittest":"Fauna Shaman","Seedborn Muse":"Quest for Renewal","Mystical Tutor":"Solve the Equation",
 "Gamble":"Reckless Handling","Underworld Breach":"Past in Flames","Ancient Tomb":"Myriad Landscape","Gaea's Cradle":"Growing Rites of Itlimoc"
};
async function swapOne(oldName,replacement){
 try{
  const c=await scryfall("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(replacement));
  const colors=[...new Set(commanderCards.filter(Boolean).flatMap(x=>x.color_identity||[]))];
  if(c.legalities?.commander!=="legal"||c.color_identity?.some(color=>!colors.includes(color)))throw new Error("That alternative isn't Commander legal within the selected color identity.");
  const existing=deck.cards.find(x=>normalizedName(x.name)===normalizedName(oldName));
  if(!existing||existing.qty<1)throw new Error("The card to replace was not found.");
  if(deck.cards.some(x=>normalizedName(x.name)===normalizedName(replacement)))throw new Error("Alternative already present. Review singleton legality.");
  existing.qty--;if(!existing.qty)deck.cards=deck.cards.filter(x=>x!==existing);
  deck.cards.push({name:c.name,qty:1,card:compactCard(c)});
  store();loadInputs();hasAnalyzed=false;refreshSummary("Swapped "+oldName+" for "+c.name+". Analyze again to check the entire deck.");
 }catch(e){status(e.message)}
}
function bracket(s,root){
 window.DeepCutsGuide?.registerCardNames([...Object.keys(swaps),...Object.values(swaps)]);
 const name={1:"Exhibition",2:"Core",3:"Upgraded",4:"Optimized",5:"cEDH"}[s.target];
 root.append(heading("Target Bracket "+s.target+" · "+name));
 const gcLimit=s.target<=2?0:s.target===3?3:Infinity;
 advice(root,[
 "Known Game Changers: "+s.changers.length+". "+(gcLimit===Infinity?"This bracket has no set Game Changer limit.":"Target limit: "+gcLimit+"."),
 "This is NOT a predicted Commander bracket. Your intent, combos, speed, tutors, extra turns and land denial need review.",
 "Brackets 1–3 generally exclude mass land denial; Brackets 1–2 exclude intentional two-card infinite combos and extra-turn cards. Read official bracket guidance for exceptions."
 ]);
 if(s.changers.length>gcLimit){
   root.append(p("Your deck exceeds the known Game Changer allowance by "+(s.changers.length-gcLimit)+".","warning-item"));
 }else root.append(p("No Game Changer-count conflict detected with this target. That does not prove the deck meets its spirit.","success-item"));
 const strong=s.changers.map(x=>x.name);
 const list=strong.slice(0,14);
 for(const n of list){
  const substitute=swaps[n]||swaps[Object.keys(swaps).find(k=>normalizedName(k)===normalizedName(n))];
  if(substitute&&s.target<=3){
   root.append(suggestionCard(n+" → "+substitute+" · proposed lower-power alternative; legality and identity will be verified when applied.",()=>swapOne(n,substitute),"REVIEW & APPLY SWAP"));
  }else root.append(p("Game Changer: "+n,"cut-suggestion"));
 }
 if(!s.changers.length)root.append(p("No listed Game Changers found. For higher brackets, speed and interaction matter more than only adding powerful staples.","helper-note"));
 const link=el("a","CHECK OFFICIAL COMMANDER BRACKETS ↗","text-link");link.href="https://magic.wizards.com/en/formats/commander";link.target="_blank";link.rel="noopener noreferrer";root.append(link);
}
function display(){
 const root=$("analysisPanel");root.replaceChildren();
 if(!hasAnalyzed){root.append(p("Paste and analyze a deck to receive real card-based recommendations.","helper-note"));return}
 const s=lastAnalysis||diagnose();lastAnalysis=s;stat(s);
 window.DeepCutsGuide?.registerCardNames(deck.cards.map(x=>x.name));
 if(currentTab==="mana")mana(s,root);
 else if(currentTab==="cut")trim(s,root);
 else if(currentTab==="bracket")bracket(s,root);
 else overview(s,root);
}
function refreshSummary(message){
 status(message);
 $("statCards").textContent=sumQty(deck.cards)+(deck.commanders||[]).length;
 $("statLands").textContent="–";$("statGamechangers").textContent="–";
 $("analysisPanel").replaceChildren(p("Analyze the current list again to update recommendations.","helper-note"));
}
async function enrich(){
 const lookups=[];
 const mainMap=new Map();
 for(const entry of deck.cards){if(!entry.card)lookups.push(entry.name);mainMap.set(normalizedName(entry.name),entry)}
 for(const name of deck.commanders)lookups.push(name);
 const names=[...new Set(lookups)];
 const found=new Map();
 for(let i=0;i<names.length;i+=75){
  const identifiers=names.slice(i,i+75).map(name=>({name}));
  if(i)await sleep(180);
  const data=await scryfall("https://api.scryfall.com/cards/collection",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers})});
  for(const card of data.data||[])found.set(normalizedName(card.name),compactCard(card));
 }
 for(const entry of deck.cards)if(!entry.card&&found.has(normalizedName(entry.name)))entry.card=found.get(normalizedName(entry.name));
 commanderCards=deck.commanders.map(name=>found.get(normalizedName(name))||null);
 // If a commander name also exists in an imported collection cache, reuse its resolved data.
 for(let i=0;i<deck.commanders.length;i++)if(!commanderCards[i]){
   const candidate=deck.cards.find(x=>normalizedName(x.name)===normalizedName(deck.commanders[i]));
   if(candidate)commanderCards[i]=candidate.card;
 }
 return names.length;
}
async function analyze(){
 $("analyzeDeck").disabled=true;status("Checking cards against Scryfall. Large lists are looked up in batches…");
 try{
  const invalid=normalizeDeck();
  commanderCards=[];
  await enrich();
  store();
  hasAnalyzed=true;lastAnalysis=diagnose();display();window.dispatchEvent(new Event("deepcuts:analyzed"));
  status("Analyzed "+lastAnalysis.total+" cards. "+(lastAnalysis.unknown.length+" unresolved cards.")+(invalid.length?" "+invalid.length+" lines not recognized.":""));
 }catch(e){
  hasAnalyzed=false;display();status("Couldn't fully verify the deck: "+e.message+" Please try again. The decklist remains saved.");
 }finally{$("analyzeDeck").disabled=false}
}
$("analyzeDeck").addEventListener("click",analyze);
$("clearDeck").addEventListener("click",()=>{
 if(!confirm("Clear the saved deck workbench?"))return;
 deck={cards:[],commanders:[],targetBracket:2};commanderCards=[];hasAnalyzed=false;saveDeck(deck);loadInputs();refreshSummary("Empty workbench.");
});
$("cutMode")?.addEventListener("change",()=>{if(hasAnalyzed&&currentTab==="cut")display()});
$("bracketTarget").addEventListener("change",()=>{
 deck.targetBracket=Number($("bracketTarget").value);saveDeck(deck);
 if(hasAnalyzed){lastAnalysis=diagnose();display()}
});
document.querySelectorAll(".deck-tab").forEach(btn=>btn.addEventListener("click",()=>{
 currentTab=btn.dataset.tab;document.querySelectorAll(".deck-tab").forEach(b=>{b.classList.toggle("active",b===btn);b.setAttribute("aria-selected",b===btn?"true":"false")});display()
}));
$("exportDeck").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(toText(deck));status("Decklist copied.")}catch{status("Clipboard unavailable. Copy from the decklist field.")}});
$("downloadDeck").addEventListener("click",()=>{
 const blob=new Blob([toText(deck)],{type:"text/plain"}),href=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=href;a.download="deep-cuts-commander-deck.txt";a.click();setTimeout(()=>URL.revokeObjectURL(href),200);
});
$("loadExample").addEventListener("click",()=>{
 if(deck.cards.length&&!confirm("Replace your draft with an incomplete Chainer example?"))return;
 const sample=window.CHAINER_CORE||[];
 deck={commanders:["Chainer, Dementia Master"],cards:sample.filter(([role,name])=>name!=="Chainer, Dementia Master").map(([role,name])=>({name,qty:1,card:null})),targetBracket:2};
 commanderCards=[];hasAnalyzed=false;saveDeck(deck);loadInputs();refreshSummary("Loaded incomplete Chainer starter core. Add more cards to reach 100, then analyze.");
});

window.addEventListener("deepcuts:loadsnapshot",e=>{const next=e.detail?.deck;if(!next||!Array.isArray(next.cards))return;deck=next;commanderCards=[];hasAnalyzed=false;saveDeck(deck);loadInputs();refreshSummary("Saved brew loaded. Analyze to refresh all checks.");window.dispatchEvent(new Event("deepcuts:deckchanged"))});
loadInputs();refreshSummary("Deck ready. Import or add cards, then click Analyze Deck.");
