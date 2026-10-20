import test from 'node:test';
import assert from 'node:assert/strict';
import {exactScryfallSearchUrl,scryfallCardDetails,installPremadeCardHover,resolveScryfallCard} from './scryfall-card-preview.mjs';

test('fallback links use exact card-name Scryfall search',()=>{
 for(const name of ['Sol Ring','Wear // Tear','Alena, Kessig Trapper','Éowyn, Shieldmaiden']){
  const u=new URL(exactScryfallSearchUrl(name));
  assert.equal(u.origin,'https://scryfall.com');
  assert.equal(u.pathname,'/search');
  assert.equal(u.searchParams.get('q'),'!"'+name+'"');
  assert.equal(u.searchParams.get('unique'),'cards');
 }
});
test('canonical Scryfall URI and readable large artwork use trusted HTTPS origins',()=>{
 const card={scryfall_uri:'https://scryfall.com/card/cmr/322/sol-ring',
  image_uris:{large:'https://cards.scryfall.io/large/front/1/2/sample.jpg',
   normal:'https://cards.scryfall.io/normal/front/1/2/sample.jpg'}};
 assert.deepEqual(scryfallCardDetails(card),{href:card.scryfall_uri,image:card.image_uris.large});
 const dual={scryfall_uri:'https://scryfall.com/card/vow/99/test',
  card_faces:[{image_uris:{large:'https://cards.scryfall.io/large/front/test.jpg'}},
   {image_uris:{large:'https://cards.scryfall.io/large/back/test.jpg'}}]};
 assert.equal(scryfallCardDetails(dual).image,dual.card_faces[0].image_uris.large);
 assert.equal(scryfallCardDetails({scryfall_uri:'javascript:alert(1)',
   image_uris:{large:'https://example.org/evil.svg'}}),null);
 assert.equal(scryfallCardDetails(null),null);
});
test('missing cards fail gracefully with one cached API request',async()=>{
 const old=globalThis.fetch;
 try{
  let count=0;
  globalThis.fetch=async()=>{count++;return {ok:false,status:404}};
  const name='Imaginary Preview-Only Card 2026';
  const res=await Promise.all([resolveScryfallCard(name),resolveScryfallCard(name)]);
  assert.deepEqual(res,[null,null]);assert.equal(count,1);
 }finally{globalThis.fetch=old}
});
class E{
 constructor(tag){this.tag=tag;this.className='';this.textContent='';this.attrs={};
  this.dataset={};this.children=[];this.listeners={};this.hidden=false;this.style={};this.href='';this.src='';}
 append(...children){for(const c of children){this.children.push(c);c.parent=this}}
 setAttribute(k,v){this.attrs[k]=String(v)}
 removeAttribute(k){if(k==='src')this.src='';delete this.attrs[k]}
 addEventListener(k,fn){this.listeners[k]=fn}
 contains(other){for(let e=other;e;e=e.parent)if(e===this)return true;return false}
 closest(q){for(let e=this;e;e=e.parent)if(q==='a.premade-card-link'&&e.tag==='a'&&e.className==='premade-card-link')return e;return null}
 getBoundingClientRect(){
  return this.tag==='a'?{left:120,right:210,top:120,bottom:140,width:90,height:20}:
   {left:0,right:355,top:0,bottom:520,width:355,height:520};
 }
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve()};
test('desktop mouse hover shows large image, upgrades link, and dismisses on exit',async()=>{
 const prev={document:globalThis.document,window:globalThis.window};
 const root=new E('div'),body=new E('body'),anchor=new E('a');
 anchor.className='premade-card-link';anchor.dataset.scryfallCard='Sol Ring';
 anchor.href=exactScryfallSearchUrl('Sol Ring');root.append(anchor);
 const card={href:'https://scryfall.com/card/cmr/322/sol-ring',image:'https://cards.scryfall.io/large/front/a.jpg'};
 try{
  globalThis.document={body,createElement:t=>new E(t)};
  globalThis.window={innerWidth:1280,innerHeight:800,addEventListener(){}};
  let calls=0;
  installPremadeCardHover(root,{lookup:async name=>{calls++;assert.equal(name,'Sol Ring');return card}});
  const popup=body.children[0];assert.equal(popup.hidden,true);
  root.listeners.pointerover({pointerType:'touch',target:anchor,relatedTarget:null});
  assert.equal(popup.hidden,true);
  root.listeners.pointerover({pointerType:'mouse',target:anchor,relatedTarget:null});
  assert.equal(popup.hidden,false);
  await flush();
  assert.equal(calls,1);assert.equal(anchor.href,card.href);
  assert.equal(popup.children[1].src,card.image);assert.equal(popup.children[1].hidden,false);
  assert.ok(Number.parseFloat(popup.style.left)>0);
  root.listeners.pointerout({pointerType:'mouse',target:anchor,relatedTarget:null});
  assert.equal(popup.hidden,true);
  root.listeners.focusin({target:anchor});
  await flush();
  assert.equal(calls,2);
  root.listeners.focusout({target:anchor});
  assert.equal(popup.hidden,true);
 }finally{Object.assign(globalThis,prev)}
});
test('missing preview shows message and retains Scryfall search link',async()=>{
 const prev={document:globalThis.document,window:globalThis.window};
 const root=new E('div'),body=new E('body'),anchor=new E('a');
 anchor.className='premade-card-link';anchor.dataset.scryfallCard='Unknown Card';
 anchor.href=exactScryfallSearchUrl('Unknown Card');root.append(anchor);
 try{
  globalThis.document={body,createElement:t=>new E(t)};
  globalThis.window={innerWidth:800,innerHeight:550,addEventListener(){}};
  installPremadeCardHover(root,{lookup:async()=>null});
  root.listeners.focusin({target:anchor});await flush();
  assert.match(body.children[0].children[2].textContent,/Preview unavailable/);
  assert.match(anchor.href,/scryfall\.com\/search/);
  assert.equal(body.children[0].children[1].hidden,true);
 }finally{Object.assign(globalThis,prev)}
});
