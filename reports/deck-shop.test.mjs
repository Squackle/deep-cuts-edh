import test from 'node:test';
import assert from 'node:assert/strict';
import {validCompleteDeck,approvedAffiliateUrl,checkoutReady,mountDeckShop,TIERS} from './deck-shop.mjs';

const commanders=['Commander Mustard'];
const fullCards=['1 Commander Mustard','1 Sol Ring','98 Plains'];
const reviewed={cards:fullCards,reviewed:true,checkoutUrlReviewed:true,
 checkoutUrl:'https://partner.tcgplayer.com/c/example'};
test('only a reviewed 100-card list with its commander is represented as complete',()=>{
 assert.equal(TIERS.length,3);
 assert.equal(validCompleteDeck(reviewed,commanders),true);
 assert.equal(validCompleteDeck({...reviewed,reviewed:false},commanders),false);
 assert.equal(validCompleteDeck({...reviewed,cards:fullCards.slice(0,2)},commanders),false);
 assert.equal(validCompleteDeck({...reviewed,cards:['100 Plains']},commanders),false);
 assert.equal(validCompleteDeck({...reviewed,cards:['1 Commander Mustard','2 Sol Ring','97 Plains']},commanders),false);
 assert.equal(validCompleteDeck({...reviewed,cards:['1 Commander Mustard','1 Sol Ring','99 Plains']},commanders),false);
 assert.equal(validCompleteDeck({...reviewed,cards:['1 Another Commander','1 Sol Ring','98 Plains']},commanders),false);
});
test('affiliate links require HTTPS allowed partner hostname and active authorization',()=>{
 assert.equal(approvedAffiliateUrl('https://partner.tcgplayer.com/c/xyz'),'https://partner.tcgplayer.com/c/xyz');
 assert.equal(approvedAffiliateUrl('https://tcgplayer.pxf.io/abc'),'https://tcgplayer.pxf.io/abc');
 for(const url of ['javascript:alert(1)','https://partner.tcgplayer.com.evil.test/z',
   'http://partner.tcgplayer.com/x','https://x:secret@partner.tcgplayer.com/x',
   'https://www.tcgplayer.com/massentry','https://other.example/buy']){
  assert.equal(approvedAffiliateUrl(url),null,url);
 }
 assert.equal(checkoutReady({affiliate:{active:false}},reviewed,commanders),false);
 assert.equal(checkoutReady({affiliate:{active:true}},reviewed,commanders),true);
 assert.equal(checkoutReady({affiliate:{active:true}},{...reviewed,checkoutUrlReviewed:false},commanders),false);
 assert.equal(checkoutReady({affiliate:{active:true}},{...reviewed,reviewed:false},commanders),false);
});
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.listeners={};this.className='';this.textContent='';this.disabled=false;this.open=false}
 append(...els){this.children.push(...els);for(const el of els){el.parent=this}}
 replaceChildren(...els){this.children=[];this.append(...els)}
 setAttribute(k,v){this.attrs[k]=String(v)}
 getAttribute(k){return this.attrs[k]||null}
 addEventListener(k,fn){this.listeners[k]=fn}
 querySelector(q){const match=node=>q[0]==='.'?node.className.split(' ').includes(q.slice(1)):false;
  const visit=node=>{for(const child of node.children){if(match(child))return child;const deeper=visit(child);if(deeper)return deeper}return null};
  return visit(this)}
 closest(tag){let p=this.parent;while(p){if(p.tag===tag)return p;p=p.parent}return null}
}
const all=(root,predicate)=>{
 const out=[];const visit=n=>{if(predicate(n))out.push(n);for(const x of n.children)visit(x)};visit(root);return out;
};
test('existing and future report slugs inherit safe shopping with no checkout',async()=>{
 const oldDoc=globalThis.document,oldLoc=globalThis.location,oldFetch=globalThis.fetch;
 const sidebar=new Element('aside'),details=new Element('details'),rows=new Element('tbody');
 details.append(rows);
 const fakeDoc={
  querySelector:q=>q==='.report-side'?sidebar:null,
  createElement:tag=>new Element(tag),
  getElementById:id=>id==='guideCoreRows'?rows:null
 };
 try{
  globalThis.document=fakeDoc;
  globalThis.location={pathname:'/reports/commander-mustard'};
  globalThis.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,affiliate:{active:false},
   cases:{'commander-mustard':{budget:{targetUsd:100,cards:[],reviewed:false}}}})});
  await mountDeckShop({commanders,core:[['Soldiers','Sol Ring']]});
  assert.equal(sidebar.children.length,1);
  const section=sidebar.children[0];
  assert.equal(section.className,'report-shop');
  const buttons=all(section,e=>e.tag==='button');
  assert.equal(buttons.filter(b=>b.className==='report-shop-tab').length,3);
  const buy=buttons.find(b=>b.className.includes('report-shop-buy'));
  assert.equal(buy.disabled,true);
  assert.match(all(section,e=>e.className==='report-shop-price')[0].children[1].textContent,/100 target/);
  const starter=all(section,e=>e.className==='report-shop-source')[0];
  assert.equal(starter.href,'#guideCoreRows');
  starter.listeners.click();
  assert.equal(details.open,true);
  const regular=buttons.find(b=>b.textContent==='Standard');
  regular.listeners.click();
  assert.match(all(section,e=>e.className==='report-shop-price')[0].children[1].textContent,/To be confirmed/);
  await mountDeckShop({commanders,core:[]});
  assert.equal(sidebar.children.length,1,'no duplicate storefront');

  // Future reports with no entry in the shared manifest still get three tiers.
  const future=new Element('aside');
  fakeDoc.querySelector=q=>q==='.report-side'?future:null;
  globalThis.location.pathname='/reports/a-new-case';
  await mountDeckShop({commanders:['A New Commander'],core:[]});
  assert.equal(future.children.length,1);
  assert.equal(all(future,e=>e.className.includes('report-shop-buy')).every(x=>x.disabled),true);
 }finally{
  globalThis.document=oldDoc;globalThis.location=oldLoc;globalThis.fetch=oldFetch;
 }
});
test('a reviewed complete list activates only the approved tier and shows free decklist',async()=>{
 const oldDoc=globalThis.document,oldLoc=globalThis.location,oldFetch=globalThis.fetch;
 const sidebar=new Element('aside');
 try{
  globalThis.document={querySelector:q=>q==='.report-side'?sidebar:null,createElement:t=>new Element(t)};
  globalThis.location={pathname:'/reports/commander-mustard.html'};
  globalThis.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,affiliate:{active:true},
   cases:{'commander-mustard':{budget:reviewed}}})});
  await mountDeckShop({commanders,core:[]});
  const buttons=all(sidebar,e=>e.className.includes('report-shop-buy'));
  assert.equal(buttons.length,1);
  assert.equal(buttons[0].tag,'a');
  assert.equal(buttons[0].rel,'sponsored noopener noreferrer');
  assert.equal(buttons[0].href,reviewed.checkoutUrl);
  assert.equal(all(sidebar,e=>e.tag==='pre')[0].textContent,fullCards.join('\n'));
 }finally{
  globalThis.document=oldDoc;globalThis.location=oldLoc;globalThis.fetch=oldFetch;
 }
});
