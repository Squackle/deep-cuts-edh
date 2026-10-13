import {$,state,el,msg} from "./community.js";
import {fieldPost,norm,currency,showFieldError,linkButton} from "./field-client.js";
import {fetchDeck} from "./field-collection-ui.js";
function deckCards(deck){
 const result=new Map();
 for(const c of [...(deck.commanders||[]).map(name=>({name,qty:1})),...(deck.cards||[])]){
  const name=String(c.name||"").trim(),key=norm(name),qty=Number(c.qty??c.quantity??1);
  if(!key||!Number.isInteger(qty)||qty<1)continue;
  const previous=result.get(key);result.set(key,{name,quantity:(previous?.quantity||0)+qty});
 }
 return result;
}
function statRow(label,value){
 const row=el("div",null,"field-compare-stat");row.append(el("span",label),el("strong",String(value)));return row;
}
function statPanel(title,cards,details){
 const column=el("div",null,"field-compare-column");column.append(el("h3",title));
 const values=[...cards].map(([key,item])=>({key,...item,card:details.get(key)}));
 const total=values.reduce((n,x)=>n+x.quantity,0);
 const land=values.filter(x=>/\bLand\b/i.test(x.card?.type||"")).reduce((n,x)=>n+x.quantity,0);
 const spells=values.filter(x=>x.card&&!/\bLand\b/i.test(x.card.type||""));
 const knownSpells=spells.reduce((n,x)=>n+x.quantity,0);
 const cmc=knownSpells?spells.reduce((n,x)=>n+Number(x.card.cmc||0)*x.quantity,0)/knownSpells:null;
 const price=values.reduce((n,x)=>n+(x.card?.price??0)*x.quantity,0);
 const unknown=values.filter(x=>x.card?.price===null||x.card?.price===undefined).reduce((n,x)=>n+x.quantity,0);
 const ramp=values.filter(x=>/add \{|search your library for .*land card|create a treasure token/i.test(x.card?.oracle||"")).reduce((n,x)=>n+x.quantity,0);
 const removal=values.filter(x=>/destroy target|exile target|counter target spell|deals? \d+ damage to target/i.test(x.card?.oracle||"")).reduce((n,x)=>n+x.quantity,0);
 column.append(statRow("Total copies",total),statRow("Distinct cards",cards.size));
 if(details.size){
  column.append(statRow("Lands identified",land),statRow("Average spell mana value",cmc===null?"N/A":cmc.toFixed(2)),
   statRow("Potential ramp slots",ramp),statRow("Potential interaction slots",removal),
   statRow("Reference-printing total",currency(price)+(unknown?" + "+unknown+" unpriced":"")));
 }
 return column;
}
function listColumn(title,items){
 const column=el("div",null,"field-compare-column");column.append(el("h3",title));
 const list=el("div",null,"field-scroll-list");
 if(!items.length)list.append(el("p","None.","cm-note"));
 for(const item of items.slice(0,160)){
  const row=el("div",null,"field-inventory-row");
  const l=linkButton(item.quantity+"× "+item.name,"https://scryfall.com/search?q="+encodeURIComponent('!"'+item.name+'"'));
  l.target="_blank";l.rel="noopener noreferrer";row.append(l);list.append(row);
 }
 column.append(list);
 return column;
}
export async function compareDecks(){
 const root=$("compareOutput");root.replaceChildren(el("p","Comparing decklists…","cm-note"));
 try{
  const aKey=$("compareDeckA").value,bKey=$("compareDeckB").value;
  if(!aKey||!bKey)throw Error("Choose both Deck A and Deck B.");
  if(aKey===bKey)throw Error("Choose two different decks to compare.");
  const [a,b]=await Promise.all([fetchDeck(aKey),fetchDeck(bKey)]);
  const mapA=deckCards(a),mapB=deckCards(b);
  if(!mapA.size||!mapB.size)throw Error("Both decks must contain cards.");
  const shared=[],onlyA=[],onlyB=[];
  for(const [key,item] of mapA){
   const other=mapB.get(key)?.quantity||0;
   if(other){
    shared.push({name:item.name,quantity:Math.min(item.quantity,other)});
    if(item.quantity>other)onlyA.push({name:item.name,quantity:item.quantity-other});
   }else onlyA.push({...item});
  }
  for(const [key,item] of mapB){
   const other=mapA.get(key)?.quantity||0;
   if(item.quantity>other)onlyB.push({name:item.name,quantity:item.quantity-other});
  }
  shared.sort((a,b)=>a.name.localeCompare(b.name));
  onlyA.sort((a,b)=>a.name.localeCompare(b.name));onlyB.sort((a,b)=>a.name.localeCompare(b.name));
  const overlap=shared.reduce((n,x)=>n+x.quantity,0);
  const allNames=[...new Map([...mapA,...mapB].map(([key,item])=>[key,item.name])).values()];
  let data=new Map(),unknown=0,pricingError="";
  if(state.me){
   try{
    const batches=[];for(let i=0;i<allNames.length;i+=150)batches.push(allNames.slice(i,i+150));
    for(let i=0;i<batches.length;i++){
     if(i)await new Promise(resolve=>setTimeout(resolve,650));
     const result=await fieldPost("prices",{names:batches[i]});
     for(const item of result.cards||[])data.set(norm(item.name),item);
     unknown+=(result.missing||[]).length;
    }
   }catch(err){pricingError=err.message;data.clear()}
  }
  root.replaceChildren();
  root.append(el("h3",a.name+" vs. "+b.name));
  root.append(el("p",overlap+" shared card copies · "+shared.length+" shared names · "+onlyA.length+" A-only/different names · "+onlyB.length+" B-only/different names","field-stat"));
  if(!state.me)root.append(el("p","Sign in to enrich this comparison with Scryfall price and mana-curve estimates.","cm-note"));
  else root.append(el("p",pricingError?"Scryfall estimates temporarily unavailable: "+pricingError+". Card-list differences remain available.":"Prices are estimates from representative Scryfall printings; land/ramp/removal classifications are heuristic."+(unknown?" "+unknown+" names could not be resolved.":""),"cm-note"));
  const stats=el("div",null,"field-compare-grid");
  stats.append(statPanel(a.name,mapA,data),statPanel(b.name,mapB,data));root.append(stats);
  const lists=el("div",null,"field-compare-grid");
  lists.append(listColumn("ONLY / MORE COPIES IN A",onlyA),listColumn("ONLY / MORE COPIES IN B",onlyB));
  root.append(lists);
  const common=el("div",null,"field-compare-common");common.append(el("h3","CARDS SHARED BY BOTH DECKS"));
  common.append(listColumn("Shared names",shared));root.append(common);
 }catch(e){showFieldError(root,e)}
}
export function initComparison(){
 $("compareRun").addEventListener("click",compareDecks);
}
