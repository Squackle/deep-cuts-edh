
import {readDeck,parseLines,normalizedName,toText} from "./shared.js";
const $=id=>document.getElementById(id);
const COLLECT_KEY="deepcuts-collection-v1";
const clamp=(x,lo=0,hi=100)=>Math.max(lo,Math.min(hi,x));
const sum=x=>x.reduce((a,c)=>a+(Number(c.qty)||0),0);
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const insert=(root,element)=>{if(root)root.append(element);return element};
const status=s=>{const e=$("advancedLoading");if(e)e.textContent=s};
function comboName(name){return String(name||"").toLowerCase().normalize("NFKC").replace(/[’'‘]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function copyText(text,message){
 navigator.clipboard.writeText(text).then(()=>status(message)).catch(()=>status("Clipboard permission unavailable. Use the decklist text box and copy manually."));
}
function roleTags(card){
 const name=card.name||"",text=card.oracle_text||"",type=card.type_line||"",roles=new Set();
 if(/\bLand\b/i.test(type)){roles.add("Lands");return roles}
 if(/\b(Arcane Signet|Sol Ring|Fellwar Stone|Mind Stone|Signet|Talisman)\b/i.test(name)||
     /add \{|add (one|two|three|any amount of) mana/i.test(text)||
     /search your library for (a|up to [a-z]+) (basic )?land/i.test(text))roles.add("Ramp");
 if(/draw (a|one|two|three|four|five|x|that many|equal to|cards?)/i.test(text)||/whenever.*draw/i.test(text))roles.add("Draw");
 if(/destroy (target|all|each)|exile (target|all|each)|counter target|return target .* to .*hand|deals? [0-9x]+ damage to target|target creature gets -[0-9]/i.test(text))roles.add("Interaction");
 if(/destroy (all|each) creatures|exile all creatures|each creature gets -|creatures get -[2-9]/i.test(text))roles.add("Board wipes");
 if(/search your library for (a|an|up to|any|two|three|x) /i.test(text)&&!/basic land/i.test(text))roles.add("Tutors");
 if(/hexproof|indestructible|ward|protection from|phase out|regenerate/i.test(text))roles.add("Protection");
 if(/return (target |a |up to |all )?.* (from your graveyard|from a graveyard|graveyard to the battlefield)|put target creature card from a graveyard onto the battlefield|reanimate/i.test(text))roles.add("Reanimation");
 if(/sacrifice (a|another|target|any number)|whenever.*(dies|is put into a graveyard)/i.test(text))roles.add("Sacrifice");
 if(/create (a|two|three|x|that many|one or more|[0-9]+) .*token/i.test(text))roles.add("Tokens");
 if(/whenever you cast an instant or sorcery|instant and sorcery spells|copy target instant/i.test(text))roles.add("Spellslinger");
 if(/draw.*discard|discard a card|discard your hand/i.test(text))roles.add("Discard");
 if(/landfall|whenever a land enters/i.test(text))roles.add("Landfall");
 if(/\+1\/\+1 counter|proliferate/i.test(text))roles.add("Counters");
 return roles;
}
function metrics(deck){
 const counts=new Map(),roles=new Map(),curve=Array(8).fill(0),colors={W:0,U:0,B:0,R:0,G:0};
 let lands=0,known=0,tapped=0,pips=0,gamechangers=0,fastMana=0,denial=0,extraTurns=0,totalPrice=0,priceMissing=0;
 const changers=new Set("Drannith Magistrate|Humility|Serra's Sanctum|Smothering Tithe|Enlightened Tutor|Teferi's Protection|Consecrated Sphinx|Cyclonic Rift|Force of Will|Fierce Guardianship|Gifts Ungiven|Intuition|Mystical Tutor|Narset, Parter of Veils|Rhystic Study|Thassa's Oracle|Ad Nauseam|Bolas's Citadel|Braids, Cabal Minion|Demonic Tutor|Imperial Seal|Necropotence|Opposition Agent|Orcish Bowmasters|Tergrid, God of Fright|Vampiric Tutor|Gamble|Jeska's Will|Underworld Breach|Crop Rotation|Gaea's Cradle|Natural Order|Seedborn Muse|Survival of the Fittest|Worldly Tutor|Aura Shards|Coalition Victory|Grand Arbiter Augustin IV|Notion Thief|Ancient Tomb|Chrome Mox|Field of the Dead|Glacial Chasm|Grim Monolith|Lion's Eye Diamond|Mana Vault|Mishra's Workshop|Mox Diamond|Panoptic Mirror|The One Ring|The Tabernacle at Pendrell Vale".split("|").map(normalizedName));
 const fast=new Set(["solring","manacrypt","manavault","chromemox","moxdiamond","moxopal","lionseyediamond","lotuspetal","darkritual","jewelledlotus","jeweledlotus"]);
 for(const item of deck.cards||[]){
  const q=Number(item.qty)||0,c=item.card;if(!c||!q)continue;known+=q;
  const tags=roleTags(c);
  for(const t of tags)roles.set(t,(roles.get(t)||0)+q);
  const name=normalizedName(item.name);
  if(changers.has(name))gamechangers+=q;
  if(fast.has(name))fastMana+=q;
  if(/destroy all lands|each player sacrifices (all|[3-9]) lands|players can't untap lands|skip their untap steps/i.test(c.oracle_text||""))denial+=q;
  if(/take an extra turn/i.test(c.oracle_text||""))extraTurns+=q;
  if(tags.has("Lands")){lands+=q;if(/enters (the battlefield )?tapped/i.test(c.oracle_text||""))tapped+=q;
  for(const sym of ["W","U","B","R","G"])if((c.produced_mana||[]).includes(sym)||(/^Basic Land/.test(c.type_line||"")&&({W:"Plains",U:"Island",B:"Swamp",R:"Mountain",G:"Forest"}[sym]===c.name)))colors[sym]+=q;
  }else{
    curve[Math.min(7,Math.max(0,Math.floor(c.cmc||0)))]+=q;
    for(const match of (c.mana_cost||"").matchAll(/\{([^}]+)\}/g)){if(/[WUBRG]/.test(match[1]))pips+=q}
  }
  const price=Number(c.prices?.usd);if(price>0)totalPrice+=price*q;else priceMissing+=q;
 }
 return {cards:sum(deck.cards||[])+(deck.commanders||[]).length,known,lands,tapped,roles,curve,colors,pips,gamechangers,fastMana,denial,extraTurns,totalPrice,priceMissing};
}
function choose(n,k){
 if(k<0||k>n)return 0;k=Math.min(k,n-k);let r=1;
 for(let i=1;i<=k;i++)r=r*(n-k+i)/i;
 return r;
}
function hyperProb(N,K,draw,min=0,max=draw){
 if(draw>N||N<1||K<0||K>N)return 0;
 let total=0;
 for(let x=Math.max(min,0);x<=Math.min(max,draw,K);x++)total+=choose(K,x)*choose(N-K,draw-x);
 return clamp(100*total/choose(N,draw));
}
function score(metric,target,width){
 const value=clamp(100-Math.abs(metric-target)*width);
 return Math.round(value);
}
function healthMetric(title,value,detail){
 const box=node("div","health-metric");insert(box,node("span",null,title));
 insert(box,node("strong",null,value));
 insert(box,node("small",null,detail));
 if(typeof value==="number"||/^\d+$/.test(String(value))){const meter=node("div","health-meter"),fill=node("i");fill.style.width=clamp(Number(value))+"%";meter.append(fill);box.append(meter)}
 return box;
}
function chart(curve){
 const root=$("manaCurve");root.replaceChildren();
 const max=Math.max(1,...curve);
 for(let i=0;i<8;i++){
  const bar=node("div","curve-bucket"),height=Math.max(2,Math.round(curve[i]/max*110));
  insert(bar,node("strong",null,String(curve[i])));
  const fill=node("span","curve-bar");fill.style.height=height+"px";fill.title=(i===7?"7+":i)+" mana value: "+curve[i]+" cards";
  insert(bar,fill);insert(bar,node("span",null,i===7?"7+":String(i)));insert(root,bar);
 }
}
function percentRow(parent,title,value){
 const wrap=node("div");
 const label=node("div","stat-line");insert(label,node("span",null,title));insert(label,node("strong",null,value.toFixed(1)+"%"));
 insert(wrap,label);const track=node("div","stat-track"),fill=node("i");fill.style.width=clamp(value)+"%";track.append(fill);wrap.append(track);parent.append(wrap);
}
function updateLinks(deck){
 const commander=(deck.commanders||[])[0]||"";
 const links={
  scryfall:commander?"https://scryfall.com/search?q="+encodeURIComponent('!"'+commander+'"'):"https://scryfall.com/advanced",
  edhrec:(deck.commanders||[]).length===1?"https://edhrec.com/commanders/"+comboName(commander):"https://edhrec.com/",
  spellbook:commander?"https://commanderspellbook.com/search/?q="+encodeURIComponent('commander:"'+commander+'"'):"https://commanderspellbook.com/",
  moxfield:"https://www.moxfield.com/",
  mtggoldfish:"https://www.mtggoldfish.com/deck_searches/new",
  tcgplayer:"https://www.tcgplayer.com/massentry?productline=Magic"
 };
 for(const link of document.querySelectorAll("[data-provider]"))if(links[link.dataset.provider])link.href=links[link.dataset.provider];
}
function calculateRoles(roles,root){
 root.replaceChildren();
 const names=["Lands","Ramp","Draw","Interaction","Board wipes","Tutors","Protection","Reanimation","Sacrifice","Tokens","Spellslinger","Landfall","Counters","Discard"];
 for(const t of names){
  const b=node("div","role-metric");insert(b,node("span",null,t));insert(b,node("strong",null,String(roles.get(t)||0)));root.append(b);
 }
}
function setEngine(root,metrics){
 root.replaceChildren();
 const patterns=["Reanimation","Sacrifice","Tokens","Spellslinger","Landfall","Counters","Discard"];
 const selected=patterns.filter(x=>metrics.roles.get(x)>=3);
 insert(root,node("p",null,"Detected themes (not a verified deck archetype):"));
 if(selected.length)for(const label of selected)insert(root,node("span","engine-chip",label));
 else insert(root,node("p","helper-note","Not enough resolved synergy cards to identify a theme."));
 const table=metrics.gamechangers+metrics.denial*2+metrics.extraTurns+metrics.fastMana;
 insert(root,node("p",null,
   "Table-warping flags: "+metrics.gamechangers+" Game Changers · "+metrics.fastMana+" fast-mana candidates · "+metrics.denial+" mass-land-denial indicators · "+metrics.extraTurns+" extra-turn text matches."));
 insert(root,node("p",null,
   "Potential table impact: "+(table===0?"no obvious alerts detected":table<4?"some powerful or polarizing cards detected":"several powerful or polarizing cards detected")+
   ". This is not an archenemy score or a bracket verdict."));
 insert(root,node("p",null,"For verified combos and missing pieces, use the Commander Spellbook research link below. No automatic combo matching is claimed."));
}
function render(){
 const d=readDeck(),m=metrics(d),root=$("healthBadges");root.replaceChildren();updateLinks(d);chart(m.curve);
 const total=m.cards,complete=total===100&&m.known===total-(d.commanders||[]).length;
 status("Expanded report · "+m.known+" resolved main-deck cards of "+(total-(d.commanders||[]).length)+" · "+total+" total including commander(s).");
 const landScore=score(m.lands,37,9);
 const drawScore=score(m.roles.get("Draw")||0,10,8);
 const interactScore=score((m.roles.get("Interaction")||0),9,8);
 const all=Math.round(.45*landScore+.25*drawScore+.3*interactScore);
 root.append(
  healthMetric("MANA HEALTH",complete?landScore:"—",m.lands+" lands · "+m.tapped+" explicitly tapped"),
  healthMetric("CARD FLOW",complete?drawScore:"—",(m.roles.get("Draw")||0)+" likely draw effects"),
  healthMetric("INTERACTION",complete?interactScore:"—",(m.roles.get("Interaction")||0)+" likely targeted answers"),
  healthMetric("WORKSHOP SIGNAL",complete?all:"—",complete?"Experimental heuristic / 100":"Analyze a complete 100-card list")
 );
 const probabilities=$("drawProbabilities");probabilities.replaceChildren();
 if(!complete){
  probabilities.append(node("p","helper-note","Finish and resolve a 100-card Commander list to show exact opening-hand odds. Current list is "+total+" cards; "+(total-(d.commanders||[]).length-m.known)+" main-deck cards unresolved."));
 }else{
  const ramp=m.roles.get("Ramp")||0;
  percentRow(probabilities,"2–5 lands in opening 7",hyperProb(100,m.lands,7,2,5));
  percentRow(probabilities,"3+ lands by turn 3 on play (9 seen)",hyperProb(100,m.lands,9,3,9));
  percentRow(probabilities,"A ramp card by turn 3 (9 seen)",hyperProb(100,Math.min(100,ramp),9,1,9));
 }
 calculateRoles(m.roles,$("deckRoles"));setEngine($("engineFindings"),m);
 renderCollection(d);
}
function collection(){
 try{const parsed=JSON.parse(localStorage.getItem(COLLECT_KEY));return parsed&&typeof parsed==="object"?parsed:{}}catch{return {}}
}
function parseOwned(text){
 const lines=String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const result={};
 for(const line of lines.slice(0,35000)){
  let name="",qty=1;
  const csv=line.match(/^"?([^"]+)"?\s*,\s*"?([^"]+)"?/);
  if(csv&&/^\d+$/.test(csv[1].replaceAll('"',""))){qty=Number(csv[1]);name=csv[2]}
  else if(csv&&/^\d+$/.test(csv[2])){qty=Number(csv[2]);name=csv[1]}
  else{
    const m=line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
    if(m){qty=Number(m[1]);name=m[2]}
  }
  if(!name||!/^[\p{L}\p{N}]/u.test(name))continue;
  const key=normalizedName(name);if(!key)continue;
  result[key]=(result[key]||0)+Math.min(9999,qty);
 }
 return result;
}
function missing(d){
 const counts=collection(),required=new Map();
 for(const name of d.commanders||[]){const key=normalizedName(name);if(!key)continue;const x=required.get(key)||{name,qty:0};x.qty++;required.set(key,x)}
 for(const x of d.cards||[]){const key=normalizedName(x.name);if(!key)continue;const entry=required.get(key)||{name:x.name,qty:0};entry.qty+=x.qty;required.set(key,entry)}
 return [...required.entries()].map(([key,x])=>({...x,qty:Math.max(0,x.qty-(counts[key]||0))})).filter(x=>x.qty>0).sort((a,b)=>a.name.localeCompare(b.name));
}
function massEntry(d){
 return [...(d.commanders||[]).map(name=>"1 "+name),...(d.cards||[]).filter(x=>x.qty>0).map(x=>x.qty+" "+x.name)].join("\n");
}
function renderCollection(d){
 const c=collection(),total=Object.values(c).reduce((a,b)=>a+Number(b||0),0),list=missing(d);
 $("ownedCount").textContent=total+" cards across "+Object.keys(c).length+" unique names in your local collection";
 const dest=$("missingCards");dest.textContent=(list.length?list.length+" unique cards still needed:\n"+list.slice(0,22).map(x=>x.qty+" "+x.name).join("\n")+(list.length>22?"\n…and "+(list.length-22)+" more.":""):"All listed deck cards appear in your local collection.");
}
$("refreshAdvanced")?.addEventListener("click",render);
$("saveCollection")?.addEventListener("click",()=>{
 const text=$("collectionInput").value,own=parseOwned(text);
 if(!Object.keys(own).length){status("No valid quantity-and-name lines found. Try: 3 Sol Ring");return}
 localStorage.setItem(COLLECT_KEY,JSON.stringify(own));render();status("Collection saved locally in this browser.");
});
$("collectionFile")?.addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>2_000_000){status("File exceeds 2 MB; use a smaller TXT/CSV export.");return}
 $("collectionInput").value=(await file.text()).slice(0,2000000);
 status("Imported file text. Review the list, then select Save Collection List.");
});
$("clearCollection")?.addEventListener("click",()=>{
 if(!confirm("Clear the saved browser collection?"))return;
 localStorage.removeItem(COLLECT_KEY);$("collectionInput").value="";render();
});
$("copyMissing")?.addEventListener("click",()=>{
 const text=missing(readDeck()).map(x=>x.qty+" "+x.name).join("\n");
 if(!text){status("No missing cards to copy.");return}copyText(text,"Missing-cards list copied.");
});
$("copyForTCG")?.addEventListener("click",()=>{
 const text=massEntry(readDeck());if(!text){status("Add cards first.");return}
 copyText(text,"Shopping list copied. Open TCGplayer Mass Entry below and paste it there.");
});
$("copyExternalDeck")?.addEventListener("click",()=>{
 const d=readDeck();if(!d.cards.length){status("No deck to export.");return}
 copyText(massEntry(d),"Decklist copied. Import or paste it into your external deckbuilding site.");
});
$("copyDeckShare")?.addEventListener("click",()=>{
 const d=readDeck();if(!d.cards.length){status("No deck to share.");return}
 copyText("Deep Cuts EDH · "+(d.commanders||[]).join(" + ")+"\nTarget bracket: "+(d.targetBracket||2)+"\n\n"+toText(d),
   "Deck summary copied. Public share links will be added in a later release.");
});
window.addEventListener("deepcuts:analyzed",render);
window.addEventListener("deepcuts:deckchanged",render);
window.addEventListener("storage",e=>{if(e.key==="deepcuts-deck-v1"||e.key===COLLECT_KEY)render()});
render();
