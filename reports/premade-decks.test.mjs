import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkDraft,deckText,mountPremadeDecks} from "./premade-decks.mjs";

const data=JSON.parse(readFileSync(new URL("./premade-decks.json",import.meta.url),"utf8"));
const banned=new Set(["mana crypt","jeweled lotus","dockside extortionist","nadu, winged wisdom",
 "griselbrand","primeval titan","emrakul, the aeons torn","paradox engine"]);
const basic=new Set(["plains","mountain","forest","swamp","island","wastes"]);
test("four current case files each have three 100-card Commander draft variants",()=>{
 assert.equal(data.schemaVersion,1);
 assert.deepEqual(Object.keys(data.cases).sort(),[
  "alena-and-gilanra","chainer-dementia-master","commander-mustard","ekthi-contaminator-priest"]);
 for(const [slug,entry] of Object.entries(data.cases)){
  assert.deepEqual(Object.keys(entry.tiers),["budget","standard","no-limit"],slug);
  for(const [tierId,tier] of Object.entries(entry.tiers)){
   const status=checkDraft(tier,entry.commanders);
   assert.equal(status.ok,true,slug+"/"+tierId);
   assert.equal(status.count,100,slug+"/"+tierId);
   assert.equal(tier.reviewed,false,"Unreviewed decks must not claim verified legality");
   assert.equal(tier.priceVerified,false,"No fabricated price guarantee");
   assert.ok(tier.sections.length>=7,"Cards must be organized by functional role");
   assert.ok(tier.sections.some(s=>s.role==="Ramp"));
   assert.ok(tier.sections.some(s=>s.role==="Removal"));
   assert.ok(tier.sections.some(s=>s.role==="Card Draw"));
   assert.ok(tier.sections.some(s=>s.role==="Win Conditions"));
   const mana=tier.sections.find(s=>s.role==="Lands");
   const landCount=mana.cards.reduce((n,line)=>n+Number(line.match(/^\d+/)[0]),0);
   assert.ok(landCount>=32&&landCount<=41,slug+"/"+tierId+" has "+landCount+" lands");
   const all=tier.sections.flatMap(s=>s.cards);
   for(const line of all){
    const name=line.replace(/^\d+\s+/,"").toLowerCase();
    assert.ok(!banned.has(name),slug+"/"+tierId+" contains banned "+name);
   }
   assert.match(deckText(tier),/# Commander\n/);
   assert.match(deckText(tier),/# Lands\n/);
  }
 }
});
test("higher budget variants actually change cards without dropping the deck's gameplan",()=>{
 for(const [slug,entry] of Object.entries(data.cases)){
  const list=id=>new Set(entry.tiers[id].sections.flatMap(s=>s.cards));
  const budget=list("budget"),standard=list("standard"),unlimited=list("no-limit");
  for(const [label,left,right] of [["budget→standard",budget,standard],["standard→no-limit",standard,unlimited]]){
   const diff=[...right].filter(c=>!left.has(c));
   assert.ok(diff.length>=7,slug+" "+label+" should show distinct upgrades");
   assert.ok(diff.length<=20,slug+" "+label+" must preserve identity rather than replace entire deck");
  }
 }
});
test("partial and duplicate decks fail local structural validation",()=>{
 const base=data.cases["commander-mustard"].tiers.budget;
 const one=structuredClone(base);
 one.sections.find(s=>s.role==="Lands").cards.pop();
 assert.equal(checkDraft(one,["Commander Mustard"]).ok,false);
 const repeated=structuredClone(base);
 repeated.sections.find(s=>s.role==="Ramp").cards[1]=repeated.sections.find(s=>s.role==="Ramp").cards[0];
 assert.equal(checkDraft(repeated,["Commander Mustard"]).ok,false);
 assert.equal(checkDraft(base,["Another Commander"]).ok,false);
});
class E{
 constructor(tag){this.tag=tag;this.children=[];this.className="";this.textContent="";this.attrs={};this.listeners={};this.open=false;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(type,fn){this.listeners[type]=fn;}
 append(...items){for(const x of items){this.children.push(x);x.parent=this;}}
 after(other){const index=this.parent.children.indexOf(this);this.parent.children.splice(index+1,0,other);other.parent=this.parent;}
 querySelector(query){const key=query.slice(1);return this.children.find(x=>x.className?.split(" ").includes(key))||null;}
}
test("one collapsed disclosure contains three collapsed tier dropdowns",async()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 const article=new E("article"),warning=new E("p");
 warning.className="report-core-warning";article.append(warning);
 try{
  globalThis.document={createElement:t=>new E(t),querySelector:q=>
   q===".report-content"?article:q===".premade-decklists"?article.children.find(x=>x.className==="premade-decklists")||null:null};
  globalThis.location={pathname:"/reports/commander-mustard.html"};
  globalThis.fetch=async()=>({ok:true,json:async()=>data});
  await mountPremadeDecks({commanders:["Commander Mustard"]});
  const outer=article.children[1];assert.equal(outer.className,"premade-decklists");
  assert.equal(outer.open,false);
  assert.match(outer.children[0].textContent,/SEE DEEPCUTS PREMADE DECKLISTS/);
  const tiers=outer.children[1].children.find(x=>x.className==="premade-tiers");
  assert.equal(tiers.children.length,3);
  assert.ok(tiers.children.every(x=>x.open===false));
  assert.match(tiers.children[0].children[0].textContent,/Budget.+100 cards/);
  assert.match(tiers.children[1].children[0].textContent,/Standard.+100 cards/);
  assert.match(tiers.children[2].children[0].textContent,/No Limit.+100 cards/);
  await mountPremadeDecks({commanders:["Commander Mustard"]});
  assert.equal(article.children.length,2,"No duplicate panels");
 }finally{globalThis.document=oldDoc;globalThis.location=oldLocation;globalThis.fetch=oldFetch;}
});


test("all twelve decks render every card as a safe Scryfall link, including split cards",async()=>{
 const prev={document:globalThis.document,fetch:globalThis.fetch,location:globalThis.location};
 const descend=(node,pred)=>{
  const found=[];const scan=n=>{if(pred(n))found.push(n);for(const c of n.children||[])scan(c)};scan(node);return found;
 };
 try{
  for(const [slug,deck] of Object.entries(data.cases)){
   const article=new E("article"),anchor=new E("p");
   anchor.className="report-core-warning";article.append(anchor);
   globalThis.document={createElement:t=>new E(t),querySelector:q=>
    q===".report-content"?article:q===".premade-decklists"?
    article.children.find(x=>x.className==="premade-decklists")||null:null};
   globalThis.location={pathname:"/reports/"+slug};
   globalThis.fetch=async()=>({ok:true,json:async()=>data});
   await mountPremadeDecks({commanders:deck.commanders});
   for(const tier of descend(article,x=>x.className==="premade-tier")){
    const links=descend(tier,x=>x.className==="premade-card-link");
    const lines=descend(tier,x=>x.tag==="li");
    assert.equal(links.length,lines.length,slug+" card names must all be clickable");
    assert.ok(links.length>70,slug+" complete 100-card list has many rows");
    for(const link of links){
     const url=new URL(link.href);
     assert.equal(url.origin,"https://scryfall.com");
     assert.equal(url.pathname,"/search");
     assert.equal(url.searchParams.get("unique"),"cards");
     assert.equal(link.target,"_blank");
     assert.equal(link.rel,"noopener noreferrer");
     assert.equal(link.attrs["data-scryfall-card"]!==undefined,true);
     assert.equal(url.searchParams.get("q"),'!"'+link.attrs["data-scryfall-card"]+'"');
    }
   }
  }
 }finally{globalThis.document=prev.document;globalThis.fetch=prev.fetch;globalThis.location=prev.location}
});
