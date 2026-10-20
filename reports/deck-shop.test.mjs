import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 TIERS,parseCard,readGroups,deckReport,validCompleteDeck,
 approvedAffiliateUrl,checkoutReady,mountDeckShop
} from './deck-shop.mjs';

const data=JSON.parse(readFileSync(new URL('./deck-shop-config.json',import.meta.url),'utf8'));
const commandersByCase={
 'commander-mustard':['Commander Mustard'],
 'chainer-dementia-master':['Chainer, Dementia Master'],
 'alena-and-gilanra':['Alena, Kessig Trapper','Gilanra, Caller of Wirewood'],
 'ekthi-contaminator-priest':['Ekthi, Contaminator Priest']
};
const commander=['Commander Mustard'];
const grouped={groups:{Commander:['1 Commander Mustard'],Ramp:['1 Sol Ring'],Lands:['98 Plains']},reviewed:true,
 checkoutUrl:'https://partner.tcgplayer.com/c/verified',checkoutUrlReviewed:true};

test('12 role-organized editorial builds each have exactly 100 structurally legal singleton cards',()=>{
 assert.deepEqual(TIERS.map(x=>x.label),['Budget','Standard','No Limit']);
 assert.equal(data.affiliate.active,false);
 for(const [slug,commanders] of Object.entries(commandersByCase)){
  assert.ok(data.cases[slug],slug);
  for(const {id} of TIERS){
   const tier=data.cases[slug][id],report=deckReport(tier,commanders);
   assert.equal(report.total,100,slug+' '+id);
   assert.equal(report.valid,true,slug+' '+id);
   assert.equal(tier.reviewed,false,'Initial decklists must not claim completed editorial/legality review');
   assert.equal(tier.checkoutUrl,'');
   assert.equal(validCompleteDeck(tier,commanders),false);
   const roles=new Set(report.groups.map(([role])=>role));
   for(const needed of ['Ramp','Card draw','Removal','Protection','Win conditions','Lands'])assert.ok(roles.has(needed),slug+' '+needed);
   const lands=tier.groups.Lands.reduce((n,line)=>n+parseCard(line).qty,0);
   assert.ok(lands>=33&&lands<=40,slug+' '+id+' lands '+lands);
  }
 }
});
test('invalid, incomplete and duplicate decks never activate checkout',()=>{
 assert.equal(validCompleteDeck(grouped,commander),true);
 assert.equal(deckReport({...grouped,groups:{Lands:['100 Plains']}},commander).valid,false);
 assert.equal(deckReport({...grouped,groups:{Commander:['1 Commander Mustard'],Ramp:['2 Sol Ring'],Lands:['97 Plains']}},commander).valid,false);
 assert.equal(deckReport({...grouped,groups:{Commander:['1 Commander Mustard'],Ramp:['1 Sol Ring','1 Sol Ring'],Lands:['97 Plains']}},commander).valid,false);
 assert.equal(deckReport({...grouped,groups:{Commander:['1 Commander Mustard'],Ramp:['bad'],Lands:['99 Plains']}},commander).valid,false);
 assert.equal(validCompleteDeck({...grouped,reviewed:false},commander),false);
 assert.equal(checkoutReady({affiliate:{active:false}},grouped,commander),false);
 assert.equal(checkoutReady({affiliate:{active:true}},grouped,commander),true);
 assert.equal(checkoutReady({affiliate:{active:true}},{...grouped,checkoutUrlReviewed:false},commander),false);
 assert.equal(checkoutReady({affiliate:{active:true}},{...grouped,checkoutUrl:'https://example.test'},commander),false);
});
test('outbound URL allowlist prevents wrong hosts or schemes',()=>{
 assert.equal(approvedAffiliateUrl('https://partner.tcgplayer.com/c/example'),'https://partner.tcgplayer.com/c/example');
 assert.equal(approvedAffiliateUrl('https://tcgplayer.pxf.io/abc'),'https://tcgplayer.pxf.io/abc');
 for(const bad of ['javascript:alert(1)','https://partner.tcgplayer.com.evil.test/z',
   'http://partner.tcgplayer.com/x','https://a:b@partner.tcgplayer.com/p',
   'https://www.tcgplayer.com/massentry','https://other.example/path']){
   assert.equal(approvedAffiliateUrl(bad),null,bad);
 }
});

class El{
 constructor(tag){
  this.tag=tag;this.className='';this.children=[];this.attrs={};this.listeners={};
  this.textContent='';this.id='';this.open=false;this.href='';this.disabled=false;
 }
 append(...items){for(const item of items){item.parent=this;this.children.push(item)}}
 replaceChildren(...items){this.children=[];this.append(...items)}
 after(node){if(this.parent){const i=this.parent.children.indexOf(this);this.parent.children.splice(i+1,0,node);node.parent=this}}
 before(node){if(this.parent){const i=this.parent.children.indexOf(this);this.parent.children.splice(i,0,node);node.parent=this}}
 setAttribute(key,val){this.attrs[key]=String(val)}
 addEventListener(type,callback){this.listeners[type]=callback}
 querySelector(sel){
  if(sel==='.report-core-warning'&&this.className==='report-content')return this.coreAnchor;
  if(sel==='.report-shop')return null;
  return this.children.find(x=>sel==='.'+x.className)||null
 }
 querySelectorAll(sel){return sel==='h2'?[]:[]}
}
const findAll=(root,predicate)=>{
 const result=[];const visit=n=>{if(predicate(n))result.push(n);for(const c of n.children)visit(c)};visit(root);return result;
};
test('case page inserts compact closed dropdown and opens only requested tier',async()=>{
 const prior={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch};
 const article=new El('article');article.className='report-content';
 const anchor=new El('p');anchor.className='report-core-warning';article.append(anchor);article.coreAnchor=anchor;
 const aside=new El('aside');aside.className='report-side';
 try{
  globalThis.document={
   createElement:t=>new El(t),
   getElementById:()=>null,
   querySelector:q=>q==='.report-content'?article:q==='.report-side'?aside:null
  };
  globalThis.location={pathname:'/reports/commander-mustard.html'};
  globalThis.fetch=async()=>({ok:true,json:async()=>data});
  await mountDeckShop({commanders:commander,core:[['Soldiers','Sol Ring']]});
  const root=article.children.find(c=>c.id==='reportPremadeDecks');
  assert.ok(root,'Placed inside article after existing starter package');
  assert.equal(root.tag,'details');assert.equal(root.open,false);
  assert.ok(root.children[0].textContent.includes('SEE DEEPCUTS PREMADE DECKLISTS'));
  assert.ok(findAll(root,n=>n.className==='report-decks-tier').length===3);
  assert.equal(findAll(root,n=>n.tag==='li').length,0,'100-card lists are lazy; not painted before open');
  const tiers=findAll(root,n=>n.className==='report-decks-tier');
  tiers[0].open=true;tiers[0].listeners.toggle();
  assert.ok(findAll(tiers[0],n=>n.tag==='li').length>50);
  assert.equal(findAll(tiers[0],n=>n.className==='report-decks-affiliate').length,0,'No purchase without affiliate');
  tiers[1].open=true;tiers[1].listeners.toggle();
  assert.equal(tiers[0].open,false,'Only one tier should be expanded');
  assert.equal(findAll(tiers[1],n=>n.className==='report-decks-copy').length,1);
  assert.equal(findAll(aside,n=>n.className==='report-decks-side-link').length,1);
  await mountDeckShop({commanders:commander,core:[]});
  assert.equal(findAll(article,n=>n.id==='reportPremadeDecks').length,1);
 }finally{Object.assign(globalThis,prior)}
});
test('future reports with no prepared data inherit placeholders and no fake 100-card claims',async()=>{
 const prior={document:globalThis.document,location:globalThis.location,fetch:globalThis.fetch};
 const article=new El('article');article.className='report-content';
 const anchor=new El('p');anchor.className='report-core-warning';article.append(anchor);article.coreAnchor=anchor;
 try{
  globalThis.document={createElement:t=>new El(t),getElementById:()=>null,
   querySelector:q=>q==='.report-content'?article:null};
  globalThis.location={pathname:'/reports/future-case'};
  globalThis.fetch=async()=>({ok:true,json:async()=>data});
  await mountDeckShop({commanders:['Future Commander'],core:[]});
  const root=findAll(article,n=>n.id==='reportPremadeDecks')[0];
  assert.ok(root);
  assert.equal(findAll(root,n=>n.textContent==='In preparation').length,3);
  const first=findAll(root,n=>n.className==='report-decks-tier')[0];
  first.open=true;first.listeners.toggle();
  assert.match(findAll(first,n=>n.className==='report-decks-editorial')[0].textContent,/being prepared/);
 }finally{Object.assign(globalThis,prior)}
});
