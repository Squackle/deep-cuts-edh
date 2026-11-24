import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {budgetDrafts,reviewDraft,collectCardRecords} from '../scripts/review-budget-decks.mjs';
const raw=JSON.parse(readFileSync(new URL('../reports/premade-decks.json',import.meta.url),'utf8'));
const drafts=budgetDrafts(raw);
const record=(name,extra={})=>({name,id:'fixture-'+name,set:'tst',collector_number:'1',type_line:'Creature',oracle_text:'',color_identity:['B'],games:['paper'],finishes:['nonfoil'],prices:{usd:'0.17'},legalities:{commander:'legal'},...extra});
test('existing budget drafts each have 100 cards, legal quantity structure, and no preview decks',()=>{
 assert.deepEqual(drafts.map(d=>d.slug),['commander-mustard','chainer-dementia-master','alena-and-gilanra']);
 for(const d of drafts)assert.equal(d.rows.reduce((n,r)=>n+r.qty,0),100);
 assert.deepEqual(drafts.map(d=>d.rows.length),[81,75,79]);
 const broken=structuredClone(raw);
 broken.cases['commander-mustard'].tiers.budget.sections[0].cards.push('1 Commander Mustard');
 assert.throws(()=>budgetDrafts(broken),/duplicate/);
});
test('price totals use integer cents, include all copies and do not convert missing prices to zero',()=>{
 const d={slug:'fixture',commanders:['Leader'],rows:[{name:'Leader',qty:1},{name:'Swamp',qty:99}]};
 const leader=record('Leader',{type_line:'Legendary Creature',prices:{usd:'0.99'}});
 const swamp=record('Swamp',{type_line:'Basic Land — Swamp'});
 const result=reviewDraft(d,[leader,swamp]);
 assert.equal(result.totalCents,99+99*17);
 assert.equal(result.cardDataChecksPassed,true);
 const incomplete=reviewDraft(d,[leader,{...swamp,prices:{usd:null}}]);
 assert.equal(incomplete.totalCents,null);
 assert.equal(incomplete.knownCents,99);
 assert.equal(incomplete.unknownCopies,99);
 const offColor=reviewDraft(d,[leader,{...swamp,color_identity:['U']}]);
 assert.equal(offColor.cardDataChecksPassed,false);
 assert.match(offColor.issues.join(' '),/color identity/);
 const missing=reviewDraft(d,[leader]);
 assert.equal(missing.cardDataChecksPassed,false);
 assert.equal(missing.totalCents,null);
});
test('collection queries deduplicate across decks and request at most 75 names at a time',async()=>{
 const names=Array.from({length:80},(_,i)=>'Card '+i),sizes=[],waits=[];
 const data=await collectCardRecords([...names,names[0]],{wait:async n=>waits.push(n),fetchImpl:async(url,opts)=>{
  assert.equal(url,'https://api.scryfall.com/cards/collection');
  const ids=JSON.parse(opts.body).identifiers;
  sizes.push(ids.length);
  return Response.json({data:ids.map(x=>record(x.name))});
 }});
 assert.deepEqual(sizes,[75,5]);
 assert.deepEqual(waits,[650]);
 assert.equal(data.length,80);
});
