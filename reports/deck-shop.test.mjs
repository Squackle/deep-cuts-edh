import test from 'node:test';
import assert from 'node:assert/strict';
import {validCompleteDeck,approvedAffiliateUrl,checkoutReady,mountDeckShop,TIERS} from './deck-shop.mjs';

const commanders=['Commander Mustard'];
const complete={cards:['1 Commander Mustard','1 Sol Ring','98 Plains'],
 reviewed:true,checkoutUrlReviewed:true,checkoutUrl:'https://partner.tcgplayer.com/c/approved'};
test('safe affiliate shopping requires a reviewed complete deck, approved HTTPS link and switch',()=>{
 assert.equal(TIERS.length,3);
 assert.equal(validCompleteDeck(complete,commanders),true);
 assert.equal(validCompleteDeck({...complete,reviewed:false},commanders),false);
 assert.equal(validCompleteDeck({...complete,cards:complete.cards.slice(0,2)},commanders),false);
 assert.equal(validCompleteDeck({...complete,cards:['100 Plains']},commanders),false);
 assert.equal(validCompleteDeck({...complete,cards:['1 Commander Mustard','2 Sol Ring','97 Plains']},commanders),false);
 assert.equal(checkoutReady({affiliate:{active:false}},complete,commanders),false);
 assert.equal(checkoutReady({affiliate:{active:true}},complete,commanders),true);
 assert.equal(checkoutReady({affiliate:{active:true}},{...complete,checkoutUrlReviewed:false},commanders),false);
 assert.equal(checkoutReady({affiliate:{active:true}},{...complete,checkoutUrl:'https://tcgplayer.com/massentry'},commanders),false);
 assert.equal(approvedAffiliateUrl('https://partner.tcgplayer.com/c/approved'),complete.checkoutUrl);
 for(const bad of ['javascript:alert(1)','https://partner.tcgplayer.com.evil.test/',
  'http://partner.tcgplayer.com/','https://a:b@partner.tcgplayer.com/',
  'https://www.tcgplayer.com/massentry','https://other.example/'])
  assert.equal(approvedAffiliateUrl(bad),null,bad);
});
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.attrs={};
  this.className='';this.textContent='';this.open=false;this.disabled=false;}
 append(...kids){for(const k of kids){this.children.push(k);k.parent=this}}
 replaceChildren(...kids){this.children=[];this.append(...kids)}
 setAttribute(k,v){this.attrs[k]=String(v)}
 addEventListener(k,cb){this.listeners[k]=cb}
 querySelector(selector){
  const match=node=>selector[0]==='.'?node.className.split(' ').includes(selector.slice(1)):false;
  const visit=node=>{for(const c of node.children){if(match(c))return c;
   const d=visit(c);if(d)return d}return null};
  return visit(this)
 }
 closest(tag){let p=this.parent;while(p){if(p.tag===tag)return p;p=p.parent}return null}
}
function all(root,predicate){const out=[];function visit(n){if(predicate(n))out.push(n);for(const kid of n.children)visit(kid)}visit(root);return out}
test('unapproved affiliate leaves the new premade-decks editorial accordion uncluttered',async()=>{
 const backup={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch};
 const sidebar=new Element('aside');
 try{
  globalThis.document={querySelector:q=>q==='.report-side'?sidebar:null,createElement:t=>new Element(t)};
  globalThis.location={pathname:'/reports/commander-mustard'};
  globalThis.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,affiliate:{active:false},
   cases:{'commander-mustard':{budget:{cards:[],reviewed:false}}}})});
  await mountDeckShop({commanders,core:[]});
  assert.equal(sidebar.children.length,0,'No giant disabled purchase box should crowd the editorial case');
  globalThis.location.pathname='/reports/future-case';
  await mountDeckShop({commanders:['Future Commander'],core:[]});
  assert.equal(sidebar.children.length,0,'No false purchase link on future case');
 }finally{Object.assign(globalThis,backup)}
});
test('after full approval purchase options remain collapsed with safe tracked link',async()=>{
 const backup={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch};
 const sidebar=new Element('aside');
 try{
  globalThis.document={querySelector:q=>q==='.report-side'?sidebar:null,createElement:t=>new Element(t)};
  globalThis.location={pathname:'/reports/commander-mustard.html'};
  globalThis.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,affiliate:{active:true},
   cases:{'commander-mustard':{budget:complete}}})});
  await mountDeckShop({commanders,core:[]});
  assert.equal(sidebar.children.length,1);
  const root=sidebar.children[0];
  assert.equal(root.tag,'details');
  assert.equal(root.className,'report-shop');
  assert.equal(root.open,false);
  assert.match(root.children[0].textContent,/OPTIONAL/);
  const links=all(root,n=>n.className==='report-shop-buy');
  assert.equal(links.length,1);
  assert.equal(links[0].tag,'a');
  assert.equal(links[0].href,complete.checkoutUrl);
  assert.equal(links[0].rel,'sponsored noopener noreferrer');
  assert.equal(all(root,n=>n.tag==='pre')[0].textContent,complete.cards.join('\n'));
  await mountDeckShop({commanders,core:[]});
  assert.equal(sidebar.children.length,1,'No duplicated purchase panel');
 }finally{Object.assign(globalThis,backup)}
});
