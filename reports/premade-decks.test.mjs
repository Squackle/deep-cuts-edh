import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkDraft,deckText,mountPremadeDecks,scryfallSearchUrl,scryfallCardApiUrl,safeCardDetails} from "./premade-decks.mjs";

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


test("Scryfall exact-name links and preview URLs encode unusual card names safely",()=>{
 const names=["Sol Ring","Wear // Tear","Gilanra, Caller of Wirewood","Kemba, Kha Enduring","Alena's Gambit"];
 for(const name of names){
  const search=new URL(scryfallSearchUrl(name));
  const api=new URL(scryfallCardApiUrl(name));
  assert.equal(search.origin,"https://scryfall.com");
  assert.equal(search.searchParams.get("q"),'!"'+name+'"');
  assert.equal(api.origin,"https://api.scryfall.com");
  assert.equal(api.searchParams.get("exact"),name);
 }
 const preview=safeCardDetails({
  scryfall_uri:"https://scryfall.com/card/cmr/305/sol-ring",
  image_uris:{normal:"https://cards.scryfall.io/normal/front/8/7/test.jpg"}
 });
 assert.equal(preview.uri,"https://scryfall.com/card/cmr/305/sol-ring");
 assert.match(preview.image,/cards\.scryfall\.io/);
 const split=safeCardDetails({card_faces:[{image_uris:{normal:"https://cards.scryfall.io/normal/front/a/test.jpg"}}]});
 assert.match(split.image,/cards\.scryfall\.io/);
 const hostile=safeCardDetails({scryfall_uri:"https://scryfall.com.evil.test/steal",
  image_uris:{normal:"javascript:alert(1)"}});
 assert.equal(hostile.uri,null);
 assert.equal(hostile.image,null);
});
test("every card in all four case files becomes a real clickable anchor with desktop hover preview",async()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch;
 const oldLoc=globalThis.location,oldWindow=globalThis.window;
 class Node{
  constructor(tag){this.tag=tag;this.className="";this.textContent="";this.children=[];this.attrs={};this.listeners={};
   this.style={};this.hidden=false;this.open=false;this.isConnected=false;}
  setAttribute(k,v){this.attrs[k]=String(v)}
  addEventListener(k,fn){this.listeners[k]=fn}
  append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;n.isConnected=true}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  after(node){const i=this.parent.children.indexOf(this);this.parent.children.splice(i+1,0,node);node.parent=this.parent}
  querySelector(q){return this.children.find(n=>n.className===q.slice(1))||null}
  getBoundingClientRect(){
   return this.tag==="a"?{left:200,right:345,top:150,bottom:174,width:145,height:24}:
    {left:0,right:380,top:0,bottom:550,width:380,height:550};
  }
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this)}
 }
 const visit=(node,predicate)=>{
  const result=[];
  const walk=n=>{if(predicate(n))result.push(n);for(const child of n.children)walk(child)};
  walk(node);return result;
 };
 const docBody=new Node("body");
 let cardRequests=0;
 try{
  globalThis.window={innerWidth:1440,innerHeight:900,
   matchMedia:()=>({matches:true})};
  globalThis.fetch=async(url)=>{
   const raw=String(url);
   if(raw.includes("premade-decks.json"))return {ok:true,json:async()=>data};
   if(raw.includes("api.scryfall.com/cards/named?exact=")){
    cardRequests++;
    return {ok:true,json:async()=>({
     scryfall_uri:"https://scryfall.com/card/cmr/305/sol-ring",
     image_uris:{normal:"https://cards.scryfall.io/normal/front/8/7/test.jpg"}
    })};
   }
   throw Error("Unexpected URL "+raw);
  };
  for(const [slug,caseData] of Object.entries(data.cases)){
   const article=new Node("article"),warning=new Node("p");
   warning.className="report-core-warning";article.append(warning);
   globalThis.document={body:docBody,createElement:tag=>new Node(tag),
    querySelector:q=>q===".report-content"?article:
     q===".premade-decklists"?article.children.find(x=>x.className==="premade-decklists")||null:null};
   globalThis.location={pathname:"/reports/"+slug+".html"};
   await mountPremadeDecks({commanders:caseData.commanders,preview:caseData.preview});
   const links=visit(article,x=>x.className==="premade-card-link");
   assert.equal(links.length,caseData.tiers.budget.sections.flatMap(s=>s.cards).length+
    caseData.tiers.standard.sections.flatMap(s=>s.cards).length+
    caseData.tiers["no-limit"].sections.flatMap(s=>s.cards).length,slug);
   for(const a of links){
    assert.equal(a.tag,"a");
    assert.match(a.href,/^https:\/\/scryfall\.com\/search\?/);
    assert.equal(a.target,"_blank");
    assert.equal(a.rel,"noopener noreferrer");
    assert.equal(typeof a.listeners.mouseenter,"function");
    assert.equal(typeof a.listeners.mouseleave,"function");
   }
   if(slug==="commander-mustard"){
    assert.equal(cardRequests,0,"no image API calls before a user hovers");
    const link=links[0];
    link.listeners.mouseenter();
    await new Promise(resolve=>setTimeout(resolve,270));
    assert.equal(cardRequests,1,"on demand only");
    const pop=docBody.children[docBody.children.length-1];
    assert.equal(pop.className,"premade-card-preview");
    assert.equal(pop.hidden,false);
    const img=visit(pop,n=>n.tag==="img")[0];
    assert.match(img.src,/cards\.scryfall\.io/);
    assert.match(link.href,/^https:\/\/scryfall\.com\/card\//);
    assert.match(pop.style.left,/px$/);
    link.listeners.mouseleave();
    assert.equal(pop.hidden,true,"hover preview disappears after leaving the card");
   }
  }
 }finally{
  globalThis.document=oldDoc;globalThis.window=oldWindow;
  globalThis.location=oldLoc;globalThis.fetch=oldFetch;
 }
});


test("starter core links inherit the same Scryfall URL and mouse preview as full decks",async()=>{
 const oldDoc=globalThis.document,oldFetch=globalThis.fetch,oldLocation=globalThis.location;
 const article=new E("article"),warning=new E("p"),starter=new E("a");
 warning.className="report-core-warning";
 article.append(warning);
 starter.textContent="Sol Ring";
 try{
  globalThis.document={
   createElement:t=>new E(t),
   querySelector:q=>q===".report-content"?article:
    q===".premade-decklists"?article.children.find(x=>x.className==="premade-decklists")||null:null,
   querySelectorAll:q=>q==="#guideCoreRows a"?[starter]:[]
  };
  globalThis.location={pathname:"/reports/commander-mustard"};
  globalThis.fetch=async()=>({ok:true,json:async()=>data});
  await mountPremadeDecks({commanders:["Commander Mustard"]});
  assert.equal(starter.className,"premade-card-link");
  assert.equal(starter.target,"_blank");
  assert.equal(starter.rel,"noopener noreferrer");
  assert.equal(typeof starter.listeners.mouseenter,"function");
  assert.equal(typeof starter.listeners.mouseleave,"function");
  assert.equal(typeof starter.listeners.focus,"function");
  const url=new URL(starter.href);
  assert.equal(url.origin,"https://scryfall.com");
  assert.equal(url.searchParams.get("q"),'!"Sol Ring"');
  assert.equal(url.searchParams.get("unique"),"cards");
  const handler=starter.listeners.mouseenter;
  await mountPremadeDecks({commanders:["Commander Mustard"]});
  assert.equal(starter.listeners.mouseenter,handler,"no duplicate hover handlers");
 }finally{globalThis.document=oldDoc;globalThis.location=oldLocation;globalThis.fetch=oldFetch}
});
