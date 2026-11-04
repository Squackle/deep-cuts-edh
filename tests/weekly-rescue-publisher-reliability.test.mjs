import test from 'node:test';
import assert from 'node:assert/strict';
import publisher,{jsonFromModel,localReleaseWindow,publish,scheduledRun} from '../workers/weekly-rescue-publisher.js';

function memoryKV(seed={}){
 const m=new Map(Object.entries(seed).map(([key,value])=>[key,typeof value==='string'?value:JSON.stringify(value)]));
 return {m,async get(key,type){const v=m.get(key);return type==='json'?(v?JSON.parse(v):null):v??null},async put(key,value){m.set(key,value)}};
}
const friday=new Date('2026-11-06T16:00:00Z');
test('Workers AI supports parsed response objects and text/choices without fabricating JSON',()=>{
 const value={commander:'Test Commander',supportCards:['A']};
 assert.deepEqual(jsonFromModel({response:value}),value);
 assert.deepEqual(jsonFromModel({response:JSON.stringify(value)}),value);
 assert.deepEqual(jsonFromModel({choices:[{message:{content:'Result:\n'+JSON.stringify(value)}}]}),value);
 assert.throws(()=>jsonFromModel({response:[value]}),/unsupported/);
 assert.throws(()=>jsonFromModel({response:'not json'}),/no JSON/);
});
test('Friday 10am Chicago passes both DST clocks, outside release hour never publishes',()=>{
 assert.equal(localReleaseWindow(new Date('2026-10-30T15:00:00Z')),true);
 assert.equal(localReleaseWindow(friday),true);
 assert.equal(localReleaseWindow(new Date('2026-11-06T15:00:00Z')),false);
 assert.equal(localReleaseWindow(new Date('2026-11-06T17:00:00Z')),false);
 const wed=new Date('2026-11-04T16:00:00Z');
 assert.equal(localReleaseWindow(wed),false);
});
test('Cron heartbeat is durable even when outside release hour; health reports actual schedule',async()=>{
 const REPORTS=memoryKV();const env={REPORTS,AI:{}};
 const s=await scheduledRun({scheduledTime:Date.parse('2026-11-04T16:00:00Z')},env);
 assert.equal(s.status,'not_release_window');
 assert.equal(JSON.parse(REPORTS.m.get('last-trigger')).releaseWindow,false);
 assert.equal(JSON.parse(REPORTS.m.get('last-run')).status,'not_release_window');
 assert.deepEqual([...REPORTS.m.keys()].sort(),['last-run','last-trigger']);
 const response=await publisher.fetch(new Request('https://example.test/v1/health'),env);
 assert.equal(response.status,200);
 const health=await response.json();
 assert.equal(health.aiConfigured,true);
 assert.equal(health.last,null);
 assert.equal(health.lastTrigger.scheduledAt,'2026-11-04T16:00:00.000Z');
 assert.equal(health.lastRun.status,'not_release_window');
});
test('Index is repaired after a partial published article write; AI not re-invoked',async()=>{
 const article={date:'2026-11-06',commander:{name:'Recovered Commander'},theme:'Good-faith restored theme',sections:{headline:'A recovered editorial headline'}};
 const REPORTS=memoryKV({'article:2026-11-06':article});
 const result=await publish({REPORTS},friday);
 assert.equal(result.status,'already_published');
 assert.equal(result.recoveredIndex,true);
 assert.equal(JSON.parse(REPORTS.m.get('index'))[0].commander,'Recovered Commander');
 assert.equal(JSON.parse(REPORTS.m.get('last-status')).status,'published');
});
test('Validated research commits one real report with an index and a published status',async()=>{
 const REPORTS=memoryKV();
 const candidates=Array.from({length:12},(_,i)=>({
  name:'Test Commander '+(i+1),lang:'en',legalities:{commander:'legal'},games:['paper'],color_identity:['B'],
  oracle_text:'This is a fictional candidate test Oracle text long enough to pass the input validation rule. Card '+i,
  type_line:'Legendary Creature',scryfall_uri:'https://scryfall.com/cards/test/'+i,edhrec_rank:8000+i,
  prices:{usd:'0.25'}
 }));
 const supports=Array.from({length:10},(_,i)=>({
  name:'Test Support '+i,lang:'en',legalities:{commander:'legal'},games:['paper'],color_identity:['B'],
  oracle_text:'When this creature enters, draw a card. This is an isolated offline test fixture.',
  type_line:'Creature',scryfall_uri:'https://scryfall.com/cards/test/support'+i
 }));
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async (url,opts={})=>{
  const s=String(url);
  if(s.includes('/cards/search'))return new Response(JSON.stringify({data:candidates}),{status:200});
  if(s.includes('/cards/collection'))return new Response(JSON.stringify({data:supports}),{status:200});
  throw Error('Unexpected external network access '+s);
 };
 let calls=0;
 const AI={run:async (_model,query)=>{
  calls++;
  if(calls===1){
   const raw=query.messages[1].content;
   const pool=JSON.parse(raw.slice(raw.indexOf('Candidates: ')+12));
   return {response:{commander:pool[0].name,usualBuild:'Typical creature strategies',theme:'Creature type laboratory experiment',hook:'A practical unusual strategy hypothesis.',selectionReason:'Play a less conventional card engine.',supportCards:supports.map(x=>x.name)}};
  }
  const section='This is a careful and source-grounded strategic hypothesis, not a tested winning result or a price guarantee.';
  return {response:{headline:'How a forgotten test creature can anchor an interesting value plan',
    diagnosis:section,prescription:section,earlyGame:section,midGame:section,lateGame:section,risks:section,verdict:section,
    synergies:supports.slice(0,6).map(x=>({name:x.name,why:'The supplied Oracle card text fits the proposed strategy carefully.'}))}};
 }};
 try{
  const result=await scheduledRun({scheduledTime:friday.getTime()}, {REPORTS,AI});
  assert.equal(result.status,'published');
  assert.equal(calls,2);
  const article=JSON.parse(REPORTS.m.get('article:2026-11-06'));
  assert.equal(article.synergies.length,6);
  assert.equal(article.status,'AI-assisted and source-checked; not independently playtested');
  assert.equal(JSON.parse(REPORTS.m.get('index')).length,1);
  assert.equal(JSON.parse(REPORTS.m.get('last-status')).status,'published');
  assert.equal(JSON.parse(REPORTS.m.get('last-run')).status,'published');
 }finally{globalThis.fetch=oldFetch}
});
