import test from 'node:test';
import assert from 'node:assert/strict';
import publisher from '../workers/weekly-rescue-publisher.js';
import {escaped,listHtml,reportHtml,safeCardImage,commanderArt} from '../src/weekly-rescues-html.js';
import {watchCardArt} from '../weekly-card-art.mjs';
import fs from 'node:fs';
import {strongArticle} from './helpers/strong-article.mjs';

const mem=()=>{const map=new Map();return {map,async get(k,mode){const v=map.get(k);return mode==='json'&&v?JSON.parse(v):v||null},async put(k,v){map.set(k,v)}}};
const paper=(name,oracle,colors=['U'],edhrec_rank=4000)=>({name,oracle_text:oracle,type_line:'Legendary Creature — Human Wizard',color_identity:colors,legalities:{commander:'legal'},lang:'en',games:['paper'],edhrec_rank,scryfall_uri:'https://scryfall.com/card/set/1/'+encodeURIComponent(name),image_uris:{normal:'https://cards.scryfall.io/normal/front/1/1/11111111-1111-4111-8111-111111111111.jpg?1700000000'},prices:{usd:'0.30'}});
const candidates=[paper('Three One','Whenever you cast a noncreature spell, draw a card. This ability triggers only during your turn.'),paper('Three Two','Whenever you cast a spell, scry 1. This ability triggers only once per spell you cast.'),paper('Three Three','Sacrifice an artifact: draw a card. Activate this ability only as a sorcery.')];
const evidence=['Evidence Alpha','Evidence Beta','Evidence Gamma','Evidence Delta','Evidence Epsilon','Evidence Zeta','Evidence Eta','Evidence Theta'];
const sourceFetch=globalThis.fetch;
const model=()=>({AI:{async run(_name,{messages}){if(messages.at(-1).content.includes('choose the strongest UNUSUAL'))return {response:JSON.stringify({commander:'Three One',usualBuild:'Spellslinger',theme:'Artifact-token value',hook:'Try casting noncreature engines',supportCards:evidence,selectionReason:'Offbeat synergy hypothesis'})};return {response:JSON.stringify(strongArticle(evidence))}}}});
function mockRoute(raw){
 try{
  const u=new URL(String(raw));
  if(u.origin!=='https://api.scryfall.com'||u.username||u.password||u.hash)return null;
  if(u.pathname==='/cards/search'){
   const q=u.searchParams;
   if([...q].length!==5||q.get('q')!=='is:commander legal:commander game:paper'||q.get('order')!=='edhrec'||q.get('dir')!=='asc'||q.get('unique')!=='cards'||!['2','3','4','5','6','7','8','9','10'].includes(q.get('page')))return null;
   return 'search';
  }
  if(u.pathname==='/cards/collection'&&!u.search)return 'collection';
  return null;
 }catch{return null}
}
async function withMock(fn){globalThis.fetch=async(url,options)=>{const route=mockRoute(url);if(route==='search'&&(!options?.method||options.method==='GET'))return {ok:true,json:async()=>({data:candidates})};if(route==='collection'&&options?.method==='POST')return {ok:true,json:async()=>({data:evidence.map(name=>paper(name,'Create a 1/1 artifact creature token.'))})};throw Error('Unexpected fixture request '+String(url))};try{await fn()}finally{globalThis.fetch=sourceFetch}}
const commanderLink=(html,uri)=>html.includes('<a href="'+uri+'" target="_blank" rel="noopener noreferrer">VIEW COMMANDER ORACLE ↗</a>');
test('Weekly source assertions require exact commander link and API routes',()=>{
 const uri='https://scryfall.com/card/set/1/Three%20One';
 const link=u=>'<a href="'+u+'" target="_blank" rel="noopener noreferrer">VIEW COMMANDER ORACLE ↗</a>';
 assert.equal(commanderLink(link(uri),uri),true);
 for(const bad of ['https://evil.example/?next='+uri,uri+'/extra','https://scryfall.com.evil.example/card/set/1/Three%20One','https://scryfall.com@evil.example/card/set/1/Three%20One'])assert.equal(commanderLink(link(bad),uri),false);
 const search='https://api.scryfall.com/cards/search?q=is%3Acommander+legal%3Acommander+game%3Apaper&order=edhrec&dir=asc&unique=cards&page=3';
 assert.equal(mockRoute(search),'search');
 for(const bad of [search+'&extra=1',search+'&page=4',search.replace('page=3','page=0'),search.replace('order=edhrec','order=name'),search.replace('dir=asc','dir=desc'),search.replace('https:','http:'),search+'#extra','not a URL'])assert.equal(mockRoute(bad),null);
 assert.equal(mockRoute('https://api.scryfall.com/cards/collection'),'collection');
 for(const bad of ['https://evil.example/cards/search','https://api.scryfall.com.evil.example/cards/search','https://api.scryfall.com/cards/search-extra','https://api.scryfall.com:8443/cards/collection','https://user@api.scryfall.com/cards/search','https://api.scryfall.com/cards/collection?extra=1'])assert.equal(mockRoute(bad),null);
});

test('Friday 10 a.m. Central publishes once, with verified named cards and no member DB',async()=>{await withMock(async()=>{const kv=mem(),env={REPORTS:kv,...model()};let running;const event={waitUntil(x){running=x}};
 await publisher.scheduled(null,env,event);await running; // real date might not be Friday 10 a.m.: guard only
 const {publish}=await import('../workers/weekly-rescue-publisher.js');
 assert.equal(typeof publish,'function');
 const r=await publish(env,new Date('2026-10-30T15:00:00Z'));
 assert.equal(r.status,'published',JSON.stringify(r));assert.equal(r.date,'2026-10-30');
 const again=await publish(env,new Date('2026-10-30T15:00:00Z'));assert.equal(again.status,'already_published');
 const list=JSON.parse(kv.map.get('index'));assert.equal(list.length,1);assert.equal(list[0].commander,'Three One');
 const report=JSON.parse(kv.map.get('article:2026-10-30'));assert.equal(report.synergies.length,6);assert.equal(report.status,'AI-assisted and source-checked; not independently playtested');
 assert.equal(report.commander.imageUrl,candidates[0].image_uris.normal);
 assert.equal(list[0].imageUrl,report.commander.imageUrl);
 const output=reportHtml(report);assert.equal(report.commander.scryfall,candidates[0].scryfall_uri);assert.ok(commanderLink(output,candidates[0].scryfall_uri));assert.ok(output.includes('STRATEG'));assert.ok(!output.includes('<script>alert'));
})});

test('DST and standard time both select 10 Central, not UTC midnight',async()=>{const {localReleaseWindow}=await import('../workers/weekly-rescue-publisher.js');assert.equal(localReleaseWindow(new Date('2026-10-30T15:00:00Z')),true);assert.equal(localReleaseWindow(new Date('2026-11-06T16:00:00Z')),true);assert.equal(localReleaseWindow(new Date('2026-11-06T15:00:00Z')),false);assert.equal(localReleaseWindow(new Date('2026-10-30T16:00:00Z')),false);assert.equal(localReleaseWindow(new Date('2026-11-05T16:00:00Z')),false)})

test('AI invalid candidate holds publication rather than inventing a report',async()=>{await withMock(async()=>{const kv=mem();const env={REPORTS:kv,AI:{async run(){return {response:'{"commander":"Invented Commander","supportCards":[]}'}}}};const {publish}=await import('../workers/weekly-rescue-publisher.js');const r=await publish(env,new Date('2026-10-30T15:00:00Z'));assert.equal(r.status,'held_for_review');assert.equal(kv.map.has('index'),false);assert.equal(kv.map.has('article:2026-10-30'),false)})});

test('HTML output escapes report text; archive empty has no fabricated reports',()=>{assert.equal(escaped('<script>"'), '&lt;script&gt;&quot;');const s=listHtml([]);assert.ok(s.includes('No autonomous weekly report'));assert.ok(s.includes('class="site-header"'));assert.ok(s.includes('weekly-index')===false)});


test('Weekly case pages omit evidence and editorial disclosure sections while retaining report content',()=>{
 const sample={
  date:'2026-10-30',createdAt:'2026-11-04T16:32:24.424Z',
  status:'AI-assisted source-checked editorial backfill; not independently playtested',
  commander:{name:'Vhati il-Dal',scryfall:'https://scryfall.com/card/tpr/214/vhati-il-dal',edhrecCardUseRank:null},
  theme:'One-Toughness Control',hook:'A careful source-checked hypothesis.',
  usualBuild:'Approximate control',selectionReason:'Source-grounded and qualified.',
  sections:{headline:'One point can change a combat step',diagnosis:'Hypothesis only',prescription:'Hypothesis only',earlyGame:'Plan',midGame:'Plan',lateGame:'Plan',risks:'Risks',verdict:'Provisional'},
  synergies:[{name:'Pestilence',url:'https://scryfall.com/card/usg/147/pestilence',oracle:'One damage to all creatures and players.',why:'Qualified card interaction, not a confirmed win.'}],
  methodology:'Backfilled from independent public card records while Scryfall API was rate limited.'
 };
 const html=reportHtml(sample);
 assert.match(html,/EDITORIAL BACKFILL/);
 assert.match(html,/November 4, 2026/);
 assert.match(html,/not published on its original scheduled date/);
 assert.doesNotMatch(html,/04 \/ Evidence cards|Editorial disclosure &amp; evidence|class="weekly-disclosure"|class="weekly-evidence"/);
 assert.doesNotMatch(html,/Backfilled from independent public card records|Card lookup:|source-checked using the method described in the editorial disclosure/);
 assert.match(html,/04 \/ What could go wrong/);
 assert.match(html,/05 \/ Our provisional verdict/);
 assert.match(html,/VIEW COMMANDER ORACLE/);
 assert.match(html,/source-checked card research/);
 const regular=reportHtml({...sample,status:'AI-assisted and source-checked; not independently playtested'});
 assert.doesNotMatch(regular,/EDITORIAL BACKFILL/);
});

test('Every weekly report has a full Commander card alongside the headline, including the Oct 30 legacy backfill',()=>{
 const old={
  date:'2026-10-30',createdAt:'2026-11-04T16:32:24Z',status:'AI-assisted source-checked editorial backfill',
  commander:{name:'Vhati il-Dal',scryfall:'https://scryfall.com/card/tpr/214/vhati-il-dal'},
  theme:'One-Toughness Control',hook:'The smallest damage wins the largest fight.',
  selectionReason:'An original source-checked card interaction.',usualBuild:'Golgari control',
  sections:{headline:'Make the table afraid of one damage',diagnosis:'Research',prescription:'Research',earlyGame:'Plan',midGame:'Plan',lateGame:'Plan',risks:'Risks',verdict:'Test it'},
  synergies:[],methodology:'Source checked separately'
 };
 const html=reportHtml(old);
 assert.match(html,/class="games-masthead weekly-report-hero"/);
 assert.match(html,/class="weekly-commander-art"/);
 assert.match(html,/data-weekly-art-state="loading"/);
 assert.ok(html.includes('<img data-weekly-card-img src="https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448"'));
 assert.match(html,/alt="Full Magic: The Gathering Commander card: Vhati il-Dal"/);
 assert.match(html,/width="220" height="307"/);
 assert.match(html,/VIEW FULL CARD ON SCRYFALL/);
 assert.match(html,/weekly-card-art\.mjs/);
 assert.equal(commanderArt(old),'https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448');
 const css=fs.readFileSync('weekly-rescues.css','utf8');
 assert.match(css,/\.weekly-report-hero\{display:grid;/);
 assert.match(css,/\.weekly-commander-art img\{[^}]*object-fit:contain/);
 assert.match(css,/@media\(max-width:640px\)\{\.weekly-report-hero\{grid-template-columns:1fr/);
});
test('Untrusted or absent card art cannot inject images; fallback keeps a source link',()=>{
 const bad={
  date:'2026-11-06',commander:{name:'Other Commander',scryfall:'https://scryfall.com/card/example/1',imageUrl:'https://cards.scryfall.io.evil.test/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg'},
  theme:'Other',hook:'Other',selectionReason:'Other',usualBuild:'Other',sections:{},synergies:[],methodology:'Other'
 };
 const html=reportHtml(bad);
 assert.match(html,/data-weekly-art-state="unavailable"/);
 assert.match(html,/Card artwork is unavailable here/);
 assert.doesNotMatch(html,/evil\.test/);
 assert.match(html,/VIEW FULL CARD ON SCRYFALL/);
 assert.equal(safeCardImage(bad.commander.imageUrl),null);
 assert.equal(safeCardImage('javascript:alert(1)'),null);
 assert.equal(safeCardImage('https://cards.scryfall.io/normal/front/a/8/not-a-uuid.jpg'),null);
 assert.equal(safeCardImage('https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448'),
 'https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448');
});
test('Weekly card image failures show readable fallback instead of a broken visual',()=>{
 const handlers={};const figure={dataset:{weeklyArtState:'loading'}};
 const image={complete:false,naturalWidth:0,hidden:false,addEventListener(name,fn){handlers[name]=fn}};
 assert.equal(watchCardArt(figure,image),true);
 handlers.error();
 assert.equal(figure.dataset.weeklyArtState,'unavailable');
 assert.equal(image.hidden,true);
 image.naturalWidth=488;handlers.load();
 assert.equal(figure.dataset.weeklyArtState,'loaded');
 assert.equal(image.hidden,false);
 const cached={complete:true,naturalWidth:488,hidden:false,addEventListener(){}};
 const fig={dataset:{weeklyArtState:'loading'}};
 assert.equal(watchCardArt(fig,cached),true);
 assert.equal(fig.dataset.weeklyArtState,'loaded');
});
