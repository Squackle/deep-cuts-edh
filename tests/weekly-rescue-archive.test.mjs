import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EDITORIAL_EDITIONS} from '../src/weekly-rescue-editions.js';
import {mergeIndex,loadArchive,loadReport,loadLatest,editionFor} from '../src/weekly-rescue-archive.js';
import {reportHtml,linkCards,genericHeadline,staticArchiveHtml} from '../src/weekly-rescues-html.js';
import {applyLatestToHomeHtml,homeFeatureModel} from '../src/home-weekly-ssr.js';
import {qualityIssues,publish} from '../workers/weekly-rescue-publisher.js';
import {trustedCardImage,validWeeklyDate,newerWeeklyReport,preloadCardImage} from '../home-weekly-feature.mjs';
import {onRequestGet as homepage} from '../functions/index.js';
import {strongArticle} from './helpers/strong-article.mjs';

const workerRows=[
 {date:'2026-11-20',commander:'Kruphix, God of Horizons',theme:'Infinite Mana',headline:'Kruphix Rescue Report',imageUrl:'https://cards.scryfall.io/normal/front/2/7/27427233-da58-45af-ade8-e0727929efaa.jpg?1783939404'},
 {date:'2026-10-30',commander:'Vhati il-Dal',theme:'One-Toughness Control',headline:'Make the biggest creature at the table afraid of one point',imageUrl:'https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448'}
];
const vhati={date:'2026-10-30',commander:{name:'Vhati il-Dal',scryfall:'https://scryfall.com/card/tpr/214/vhati-il-dal'},theme:'One-Toughness Control',hook:'h',selectionReason:'r',usualBuild:'u',
 sections:{headline:'Make the biggest creature at the table afraid of one point',diagnosis:'d',prescription:'Use Pestilence.',earlyGame:'e',midGame:'m',lateGame:'l',risks:'r',verdict:'v'},
 synergies:[{name:'Pestilence',url:'https://scryfall.com/card/usg/147/pestilence',why:'w'}]};
const fakeWorker=({fail=false}={})=>async path=>{
 if(fail)throw Error('Weekly report service unavailable (503)');
 if(path==='/v1/index')return {reports:workerRows};
 const date=new URL('https://x'+path).searchParams.get('date');
 if(date==='2026-10-30')return {report:vhati};
 throw Error('Weekly report service unavailable (404)');
};

test('Archive lists every weekly report once, newest first, with repository editions winning',()=>{
 const rows=mergeIndex(workerRows);
 assert.deepEqual(rows.map(x=>x.date),['2026-11-27','2026-11-20','2026-11-13','2026-11-06','2026-10-30']);
 const kruphix=rows[1];
 assert.equal(kruphix.theme,'Mana Bank Eldrazi','editorial fix replaces the weak automated listing');
 assert.notEqual(kruphix.headline,'Kruphix Rescue Report');
 assert.equal(rows[4].commander,'Vhati il-Dal','Worker-only reports stay listed');
 assert.deepEqual(mergeIndex([{date:'javascript:x()',commander:'Bad'},null,...workerRows,workerRows[1]]).map(x=>x.date),['2026-11-27','2026-11-20','2026-11-13','2026-11-06','2026-10-30']);
});

test('Archive and report pages survive the report service being down',async()=>{
 const down=await loadArchive(fakeWorker({fail:true}));
 assert.equal(down.unavailable,true);
 assert.deepEqual(down.reports.map(x=>x.date),EDITORIAL_EDITIONS.map(x=>x.date).sort().reverse());
 assert.equal((await loadReport('2026-11-13',fakeWorker({fail:true}))).commander.name,'Grothama, All-Devouring');
 await assert.rejects(loadReport('2026-10-30',fakeWorker({fail:true})),/unavailable/);
 assert.equal((await loadReport('2026-10-30',fakeWorker())).commander.name,'Vhati il-Dal');
 assert.equal(await loadReport('2026-12-04',fakeWorker()),null,'unpublished dates are not invented');
 assert.equal(await loadReport('../etc',fakeWorker()),null);
 assert.equal((await loadLatest(fakeWorker())).date,'2026-11-27');
 const page=readFileSync('rescues.html','utf8');
 const html=staticArchiveHtml(page,down.reports,{unavailable:true});
 assert.match(html,/may be missing while the archive service is unavailable/);
 assert.match(html,/href="\/rescues\/2026-11-13"/);
});

test('Every repository edition is complete, Scryfall-sourced and clears the editorial quality floor',()=>{
 for(const e of EDITORIAL_EDITIONS){
  assert.deepEqual(qualityIssues(e),[],e.date);
  assert.ok(trustedCardImage(e.commander.imageUrl),e.date+' commander art from Scryfall CDN');
  for(const url of [e.commander.scryfall,...e.synergies.map(x=>x.url)]){
   assert.match(url,/^https:\/\/scryfall\.com\/card\/[a-z0-9]+\/\d+\/[a-z0-9-]+$/,url);
  }
  assert.ok(e.theme.length<=80&&e.hook.length<=210&&e.selectionReason.length<=220,e.date+' fits the page layout');
  assert.doesNotMatch(JSON.stringify(e),/\binfinite\b|utiliz|leverag|synerg(?!ies)/i);
  const html=reportHtml(e);
  assert.ok((html.match(/class="weekly-card-link"/g)||[]).length>=3,e.date+' links key cards in the prose');
  assert.doesNotMatch(html,/utm_source/);
 }
 assert.match(reportHtml(editionFor('2026-11-20')),/EDITOR'S REVISION:<\/strong> Updated November 21, 2026/);
 assert.match(reportHtml(editionFor('2026-11-27')),/EDITOR'S REVISION:<\/strong> Updated November 27, 2026/);
 assert.ok(!editionFor('2026-11-27').synergies.some(x=>x.name==='Steel Golem'),'anti-synergy pick removed');
 assert.match(reportHtml(editionFor('2026-11-13')),/EDITORIAL BACKFILL/);
 assert.match(reportHtml(editionFor('2026-11-06')),/EDITORIAL BACKFILL/);
});

test('Card links are escaped, linked once, and never nest',()=>{
 const html=linkCards('Use <b>Snapcaster Mage</b> & Snapcaster Mage.',[{name:'Snapcaster Mage',url:'https://scryfall.com/card/inr/478/snapcaster-mage?utm_source=api'},{name:'Mage',url:'https://evil.example/'}]);
 assert.equal((html.match(/<a /g)||[]).length,1);
 assert.match(html,/&lt;b&gt;<a class="weekly-card-link" href="https:\/\/scryfall\.com\/card\/inr\/478\/snapcaster-mage"/);
 assert.doesNotMatch(html,/evil\.example|<b>/);
});

test('Placeholder automated headlines are replaced on the page',()=>{
 assert.equal(genericHeadline('Kruphix Rescue Report','Kruphix, God of Horizons'),true);
 assert.equal(genericHeadline('Kruphix','Kruphix, God of Horizons'),true);
 assert.equal(genericHeadline('Make the biggest creature afraid','Vhati il-Dal'),false);
 const html=reportHtml({...vhati,sections:{...vhati.sections,headline:'Vhati il-Dal Rescue Report'}});
 assert.match(html,/<h2 class="weekly-title">Vhati il-Dal: One-Toughness Control<\/h2>/);
});

test('The weak November 20 automated draft would now be rejected and rewritten',()=>{
 const weak={commander:{name:'Kruphix, God of Horizons'},theme:'Infinite Mana',hook:'Utilize Kruphix to leverage colorless mana',
  sections:{headline:'Kruphix Rescue Report',diagnosis:'Short.',prescription:'Short.',earlyGame:'x',midGame:'x',lateGame:'x',risks:'x',verdict:'x'},
  synergies:[{name:'Thran Dynamo',why:'Provides a significant amount of colorless mana'}]};
 const issues=qualityIssues(weak).join('\n');
 for(const expected of [/headline is a placeholder/,/infinite/,/diagnosis is too thin/,/six key cards/,/Thran Dynamo is too short/,/vague words/])assert.match(issues,expected);
});

test('Publisher rewrites a weak draft instead of publishing it',async()=>{
 const names=['Card A1','Card B2','Card C3','Card D4','Card E5','Card F6','Card G7'];
 const card=(name,extra={})=>({name,lang:'en',legalities:{commander:'legal'},games:['paper'],color_identity:['G'],oracle_text:'Whenever this creature attacks, draw a card and then put a +1/+1 counter on it.',type_line:'Legendary Creature',scryfall_uri:'https://scryfall.com/card/t/1/x?utm_source=api',image_uris:{normal:'https://cards.scryfall.io/normal/front/1/1/11111111-1111-4111-8111-111111111111.jpg?1700000000'},...extra});
 const old=globalThis.fetch;const store=new Map();
 globalThis.fetch=async url=>{const s=String(url);
  if(s.includes('/cards/search'))return Response.json({data:Array.from({length:6},(_,i)=>card('Commander '+i))});
  if(s.includes('/cards/collection'))return Response.json({data:names.map(n=>card(n))});
  throw Error('unexpected '+s)};
 let calls=0;const prompts=[];
 const AI={run:async(_m,{messages})=>{calls++;prompts.push(messages.at(-1).content);
  if(calls===1)return {response:{commander:'Commander 0',usualBuild:'Approximate: stompy',theme:'Counters on attack',hook:'A plan',selectionReason:'Because',supportCards:names}};
  if(calls===2)return {response:{...strongArticle(names),headline:'Commander 0 Rescue Report'}};
  return {response:strongArticle(names)}}};
 try{
  const r=await publish({AI,REPORTS:{get:async(k,t)=>{const v=store.get(k);return t==='json'&&v?JSON.parse(v):v??null},put:async(k,v)=>store.set(k,v)}},new Date('2026-12-04T16:00:00Z'));
  assert.equal(r.status,'published',JSON.stringify(r));
  assert.equal(calls,3);
  assert.match(prompts[2],/rejected by the editor: headline is a placeholder/);
  const article=JSON.parse(store.get('article:2026-12-04'));
  assert.doesNotMatch(article.commander.scryfall,/utm_source/);
  assert.match(prompts[0],/House style/);
 }finally{globalThis.fetch=old}
});

const homeHtml=readFileSync('index.html','utf8');
test('Homepage HTML is rendered with the newest report, so no older commander can flash',()=>{
 const row={date:'2026-12-04',commander:'A <Weird> & "Quoted" Legend, the Odd',theme:'Strange $1 angle',imageUrl:'https://cards.scryfall.io/normal/front/1/1/11111111-1111-4111-8111-111111111111.jpg?1700000000'};
 const html=applyLatestToHomeHtml(homeHtml,row);
 assert.match(html,/id="homeWeeklyFeature" data-weekly-date="2026-12-04" href="\/rescues\/2026-12-04"/);
 assert.match(html,/<span data-weekly-date-label>2026-12-04<\/span>/);
 assert.match(html,/<strong data-weekly-name>A &lt;Weird&gt; &amp; &quot;Quoted&quot; Legend, the Odd<\/strong>/);
 assert.match(html,/<small data-weekly-theme>Strange \$1 angle<\/small>/);
 assert.match(html,/<img data-weekly-image src="https:\/\/cards\.scryfall\.io\/normal\/front\/1\/1\/11111111-1111-4111-8111-111111111111\.jpg\?1700000000"[^>]*alt="A &lt;Weird&gt;/);
 assert.match(html,/id="homeLatestWeeklyText" href="\/rescues\/2026-12-04">LATEST: A &lt;Weird&gt; &amp; &quot;Quoted&quot; Legend ↗/);
 assert.doesNotMatch(html,/Kruphix/);
 assert.equal(applyLatestToHomeHtml(homeHtml,{...row,imageUrl:'https://evil.example/x.jpg'}),homeHtml);
 assert.equal(applyLatestToHomeHtml(homeHtml,{...row,date:'soon'}),homeHtml);
 assert.equal(applyLatestToHomeHtml('<main>other</main>',row),'<main>other</main>');
 assert.equal(homeFeatureModel(null),null);
 // The server render always swaps the static fallback for the newest edition.
 const newest=mergeIndex(workerRows)[0];
 assert.match(applyLatestToHomeHtml(homeHtml,newest),new RegExp('data-weekly-name>'+newest.commander+'<'));
});

test('GET / serves the homepage with the latest weekly report and survives an outage',async()=>{
 const old=globalThis.fetch;
 const next=async()=>new Response(homeHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Length':String(homeHtml.length)}});
 try{
  globalThis.fetch=async url=>{assert.match(String(url),/\/v1\/index$/);return Response.json({reports:[{date:'2026-12-04',commander:'Future Legend',theme:'Next angle',imageUrl:'https://cards.scryfall.io/normal/front/1/1/11111111-1111-4111-8111-111111111111.jpg?1700000000'},...workerRows]})};
  const res=await homepage({next});
  assert.equal(res.status,200);
  assert.equal(res.headers.get('Content-Length'),null);
  const html=await res.text();
  assert.match(html,/data-weekly-name>Future Legend</);
  assert.match(html,/data-weekly-resolved="true"/);
  globalThis.fetch=async()=>{throw Error('down')};
  const fallback=await (await homepage({next})).text();
  assert.match(fallback,/data-weekly-name>Abigale, Eloquent First-Year</);
  assert.doesNotMatch(fallback,/data-weekly-resolved=/);
  const asset=await homepage({next:async()=>new Response('nope',{status:404})});
  assert.equal(asset.status,404);
 }finally{globalThis.fetch=old}
});

test('The archive page script never replaces the server-rendered archive',()=>{
 const source=readFileSync('weekly-rescues.js','utf8');
 assert.match(source,/if\(!el\|\|!el\.textContent\.includes\('Checking the weekly archive'\)\)return;/);
 const page=readFileSync('rescues.html','utf8');
 const rendered=staticArchiveHtml(page,mergeIndex(workerRows));
 assert.doesNotMatch(rendered,/Checking the weekly archive/,'SSR output carries no placeholder, so the client script stays idle');
});

test('A stale upstream feature cannot replace a newer embedded report',()=>{
 const stale={...workerRows[0],date:'2026-11-06'};
 assert.equal(applyLatestToHomeHtml(homeHtml,stale),homeHtml);
});
test('Malformed archive rows cannot create broken report links or displace valid duplicates',async()=>{
 const good={date:'2026-12-04',commander:'Valid legend',theme:'Distinct strategy'};
 const rows=mergeIndex([{...good,commander:''},{...good,date:'2026-02-31'},{...good,theme:42},good],[]);
 assert.deepEqual(rows,[good]);
 let called=false;
 assert.equal(await loadReport('2026-02-31',async()=>{called=true}),null);
 assert.equal(called,false);
 const malformed=await loadArchive(async()=>({error:'upstream temporarily unavailable'}));
 assert.equal(malformed.unavailable,true);
 assert.deepEqual(malformed.reports.map(row=>row.date),EDITORIAL_EDITIONS.map(row=>row.date).sort().reverse());
});
test('Resolved SSR homepage does not perform a duplicate client fetch, but static fallback does',async()=>{
 const originalDocument=globalThis.document, originalFetch=globalThis.fetch;
 const oldFetch=Object.getOwnPropertyDescriptor(globalThis,'fetch');
 let calls=0,watched=0;
 const image={complete:false,addEventListener(name){if(name==='error')watched++}};
 const root={dataset:{weeklyResolved:'true',weeklyDate:'2026-11-20'},querySelector:()=>image};
 try{
  globalThis.document={getElementById:()=>root};
  globalThis.fetch=async()=>{calls++;return Response.json({report:null})};
  await import('../home-weekly-feature.mjs?resolved-test');
  assert.equal(calls,0);assert.equal(watched,1);
  delete root.dataset.weeklyResolved;
  await import('../home-weekly-feature.mjs?static-test');
  assert.equal(calls,1);assert.equal(watched,2);
 }finally{
  if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  if(oldFetch)Object.defineProperty(globalThis,'fetch',oldFetch);else globalThis.fetch=originalFetch;
 }
});

test('All feature entry points reject non-calendar dates including normalized February overflow',()=>{
 const row={...workerRows[0],date:'2027-02-31'};
 assert.equal(validWeeklyDate(row.date),false);
 assert.equal(validWeeklyDate('2028-02-29'),true);
 assert.equal(homeFeatureModel(row),null);
 assert.equal(newerWeeklyReport({report:row},'2026-11-20'),null);
 assert.equal(applyLatestToHomeHtml(homeHtml,row),homeHtml);
 assert.deepEqual(mergeIndex([row],[]),[]);
});
test('Unresponsive card artwork times out without changing the featured report',async()=>{
 const image={complete:false,naturalWidth:0,src:''};
 const pending=preloadCardImage('https://example.test/never.jpg',()=>image,5);
 assert.equal(await pending,false);
 assert.equal(image.onload,null);assert.equal(image.onerror,null);
 const cached={complete:true,naturalWidth:488,src:''};
 assert.equal(await preloadCardImage('https://example.test/cached.jpg',()=>cached,50),true);
});
test('Publisher repairs an existing article index without repeating generation or rewriting its article',async()=>{
 const date='2026-10-30',raw=JSON.stringify(vhati),store=new Map([['article:'+date,raw],['index',JSON.stringify([workerRows[0]])]]),writes=[];
 const env={AI:{run:async()=>{throw Error('Generation must not run for existing article')}},REPORTS:{
  get:async(k,t)=>{const v=store.get(k);return t==='json'&&v?JSON.parse(v):v??null},
  put:async(k,v)=>{writes.push(k);store.set(k,v)}
 }};
 const now=new Date('2026-10-30T15:00:00Z');
 await publish(env,now);await publish(env,now);
 assert.equal(store.get('article:'+date),raw);
 assert.ok(!writes.includes('article:'+date));
 const index=JSON.parse(store.get('index'));
 assert.equal(index.filter(r=>r.date===date).length,1);
 assert.ok(index.some(r=>r.date===workerRows[0].date));
});
