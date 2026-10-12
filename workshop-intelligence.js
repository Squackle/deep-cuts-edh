/* Small sourced rules helper + Monte Carlo commander casting consistency.
 * No pretense of a trained win-rate model. */
import {readDeck,isLand,scryfall} from "./shared.js";
const $=id=>document.getElementById(id);
const element=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e};
$("askRules")?.addEventListener("click",async()=>{
 const question=$("rulesQuestion").value.trim(),card=$("rulingCard").value.trim(),second=$("rulesSecondCard").value.trim(),button=$("askRules"),box=$("rulesAnswer");
 box.replaceChildren();
 if(question.length<10||!card){box.textContent="Enter a question (at least 10 characters) and a card name.";return}
 button.disabled=true;box.textContent="Looking up card text and published rulings…";
 try{
  const r=await fetch("/api/rules-assist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({card,second,question})});
  const d=await r.json();if(!r.ok)throw Error(d.error||"Rules lookup failed.");
  box.replaceChildren();
  box.append(element("p",null,d.explanation));
  const warning=element("p","rules-warning",d.warning);box.append(warning);
  for(const c of d.cards||[]){
   const p=element("article"),link=element("a",null,c.name+" ↗");link.href=c.url;link.target="_blank";link.rel="noopener noreferrer";
   p.append(link,element("p",null,"Oracle text: "+c.oracle_text));box.append(p);
   window.DeepCutsGuide?.registerCardNames([c.name]);
  }
  if(d.rulings?.length){
   const title=element("h3",null,"Closest published rulings");box.append(title);
   for(const rule of d.rulings.slice(0,5)){
    const row=element("article"),a=element("a",null,rule.card+" · Scryfall ↗");a.href=rule.url;a.target="_blank";a.rel="noopener noreferrer";
    row.append(a,element("p",null,rule.comment));box.append(row);
   }
  }
  const official=element("a",null,"Consult official Comprehensive Rules ↗");official.href=d.rulesURL;official.target="_blank";official.rel="noopener noreferrer";box.append(official);
 }catch(e){box.textContent=e.message}
 finally{button.disabled=false}
});
function basics(name){return /^(Plains|Island|Swamp|Mountain|Forest|Wastes|Snow-Covered (Plains|Island|Swamp|Mountain|Forest))$/i.test(name)}
function getPool(d){
 const pool=[];
 for(const c of d.cards){
  const land=Boolean(c.card?isLand(c.card):basics(c.name));
  for(let i=0;i<c.qty;i++)pool.push(land);
 }
 return pool;
}
function shuffle(a){
 for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
}
function simulate(deck,manaValues,samples=1000){
 const raw=getPool(deck),stats=manaValues.map(()=>Array(12).fill(0));
 for(let trial=0;trial<samples;trial++){
  const library=shuffle([...raw]);
  let cursor=0,landHand=0,landOnBoard=0;
  for(let j=0;j<7;j++)if(library[cursor++])landHand++;
  for(let turn=1;turn<=12;turn++){
   // Multiplayer Commander: first-player on first turn also draws.
   if(cursor<library.length&&library[cursor++])landHand++;
   if(landHand>0){landHand--;landOnBoard++}
   manaValues.forEach((mv,i)=>{if(landOnBoard>=mv)stats[i][turn-1]++});
  }
 }
 return stats.map(arr=>arr.map(n=>Math.round(n*100/samples)));
}
$("runForecast")?.addEventListener("click",async()=>{
 const button=$("runForecast"),status=$("forecastStatus"),root=$("forecastChart");
 const d=readDeck(),count=d.cards.reduce((n,c)=>n+c.qty,0)+(d.commanders?.length||0);
 root.replaceChildren();
 if(!d.commanders?.length||count!==100){status.textContent="Start with a complete 100-card deck and at least one commander.";return}
 const unknown=d.cards.filter(c=>!c.card&&!basics(c.name));
 if(unknown.length){status.textContent=unknown.length+" card names have not been analyzed; analyze the deck first to distinguish lands from spells.";return}
 button.disabled=true;status.textContent="Shuffling and drawing 1,000 simulated games…";
 try{
  const commanders=[];
  for(const name of d.commanders){
   const c=await scryfall("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name));
   commanders.push({name:c.name,mv:Math.max(0,Number(c.cmc)||0)});
  }
  const raw=getPool(d),lands=raw.filter(Boolean).length;
  if(lands<12){status.textContent="Recognized only "+lands+" lands. Confirm your card data before relying on a forecast.";return}
  const result=simulate(d,commanders.map(c=>c.mv));
  root.replaceChildren();
  commanders.forEach((c,i)=>{
   const section=element("section"),h=element("h3",null,c.name+" · "+c.mv+" mana");section.append(h);
   for(const turn of [3,4,5,6,7,8,10,12]){
    const chance=result[i][turn-1];
    const line=element("div","forecast-bar"),label=element("span",null,"Turn "+turn),track=element("div","forecast-track"),fill=element("div","forecast-fill"),pct=element("strong",null,chance+"%");
    fill.style.width=chance+"%";track.append(fill);line.append(label,track,pct);section.append(line);
   }
   root.append(section);
  });
  status.textContent=lands+" lands recognized. Probabilities show having "+(commanders.length===1?"enough total mana to cast the commander":"enough total mana for each commander")+" by that turn in a simplified goldfish. They are NOT win-rate or actual cast probabilities, and ignore color, taplands, ramp, mulligans, taxes and opponents.";
 }catch(e){status.textContent="Simulation failed: "+e.message}
 finally{button.disabled=false}
});
