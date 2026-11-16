import test from 'node:test';
import assert from 'node:assert/strict';
import publisher from '../workers/weekly-rescue-publisher.js';
import {escaped,listHtml,reportHtml,safeCardImage,commanderArt} from '../src/weekly-rescues-html.js';
import {watchCardArt} from '../weekly-card-art.mjs';
import fs from 'node:fs';

const mem=()=>{const map=new Map();return {map,async get(k,mode){const v=map.get(k);return mode==='json'&&v?JSON.parse(v):v||null},async put(k,v){map.set(k,v)}}};
const paper=(name,oracle,colors=['U'],edhrec_rank=4000)=>({name,oracle_text:oracle,type_line:'Legendary Creature — Human Wizard',color_identity:colors,legalities:{commander:'legal'},lang:'en',games:['paper'],edhrec_rank,scryfall_uri:'https://scryfall.com/card/set/1/'+encodeURIComponent(name),image_uris:{normal:'https://cards.scryfall.io/normal/front/1/1/11111111-1111-4111-8111-111111111111.jpg?1700000000'},prices:{usd:'0.30'}});
const candidates=[paper('Three One','Whenever you cast a noncreature spell, draw a card. This ability triggers only during your turn.'),paper('Three Two','Whenever you cast a spell, scry 1. This ability triggers only once per spell you cast.'),paper('Three Three','Sacrifice an artifact: draw a card. Activate this ability only as a sorcery.')];
const evidence=['Evidence Alpha','Evidence Beta','Evidence Gamma','Evidence Delta','Evidence Epsilon','Evidence Zeta','Evidence Eta','Evidence Theta'];
const sourceFetch=globalThis.fetch;
const model=()=>({AI:{async run(_name,{messages}){if(messages.at(-1).content.includes('choose the strongest UNUSUAL'))return {response:JSON.stringify({commander:'Three One',usualBuild:'Spellslinger',theme:'Artifact-token value',hook:'Try casting noncreature engines',supportCards:evidence,selectionReason:'Offbeat synergy hypothesis'})};return {response:JSON.stringify({headline:'Alternative Commander engine',diagnosis:'Your commander draws on noncreature spells but conventional builds focus only on instants and sorceries for victory.',prescription:'Experiment with cheap artifact engines as castable noncreature spells. The supplied cards provide artifacts, utility and recurring value.',earlyGame:'Begin by developing your mana and card flow while retaining enough interaction for the board.',midGame:'Deploy repeated noncreature artifacts while preserving card flow and mana for tempo decisions.',lateGame:'Use accumulated incremental resource advantage to find interactive ways of closing the game.',risks:'The card advantage plan is vulnerable to tempo pressure, graveyard hate, and opponents who remove key pieces.',verdict:'This is an intriguing alternative to test against real opponents; neither deck strength nor novelty has been measured.',synergies:evidence.slice(0,6).map(name=>({name,why:'This card provides noncreature action to build the engine and interact with the commander.'}))})}}}});
async function withMock(fn){globalThis.fetch=async(url)=>{const s=String(url);if(s.includes('/cards/search'))return {ok:true,json:async()=>({data:candidates})};if(s.endsWith('/cards/collection'))return {ok:true,json:async()=>({data:evidence.map(name=>paper(name,'Create a 1/1 artifact creature token.'))})};throw Error('Unexpected URL '+s)};try{await fn()}finally{globalThis.fetch=sourceFetch}}

test('Friday 10 a.m. Central publishes once, with verified named cards and no member DB',async()=>{await withMock(async()=>{const kv=mem(),env={REPORTS:kv,...model()};let running;const event={waitUntil(x){running=x}};
 await publisher.scheduled(null,env,event);await running; // real date might not be Friday 10 a.m.: guard only
 const {publish}=await import('../workers/weekly-rescue-publisher.js');
 assert.equal(typeof publish,'function');
 const r=await publish(env,new Date('2026-10-30T15:00:00Z'));
 assert.equal(r.status,'published',JSON.stringify(r));assert.equal(r.date,'2026-10-30');
 const again=await publish(env,new Date('2026-10-30T15:00:00Z'));assert.equal(again.status,'already_published');
 const list=JSON.parse(kv.map.get('index'));assert.equal(list.length,1);assert.equal(list[0].commander,'Three One');
 const report=JSON.parse(kv.map.get('article:2026-10-30'));assert.equal(report.synergies.length,6);assert.equal(report.status,'AI-assisted and source-checked; not independently playtested');
 assert.ok(report.commander.imageUrl?.startsWith('https://cards.scryfall.io/normal/front/'));
 assert.equal(list[0].imageUrl,report.commander.imageUrl);
 const output=reportHtml(report);assert.ok(output.includes('https://scryfall.com/'));assert.ok(output.includes('STRATEG'));assert.ok(!output.includes('<script>alert'));
})});

test('DST and standard time both select 10 Central, not UTC midnight',async()=>{const {localReleaseWindow}=await import('../workers/weekly-rescue-publisher.js');assert.equal(localReleaseWindow(new Date('2026-10-30T15:00:00Z')),true);assert.equal(localReleaseWindow(new Date('2026-11-06T16:00:00Z')),true);assert.equal(localReleaseWindow(new Date('2026-11-06T15:00:00Z')),false);assert.equal(localReleaseWindow(new Date('2026-10-30T16:00:00Z')),false);assert.equal(localReleaseWindow(new Date('2026-11-05T16:00:00Z')),false)})

test('AI invalid candidate holds publication rather than inventing a report',async()=>{await withMock(async()=>{const kv=mem();const env={REPORTS:kv,AI:{async run(){return {response:'{"commander":"Invented Commander","supportCards":[]}'}}}};const {publish}=await import('../workers/weekly-rescue-publisher.js');const r=await publish(env,new Date('2026-10-30T15:00:00Z'));assert.equal(r.status,'held_for_review');assert.equal(kv.map.has('index'),false);assert.equal(kv.map.has('article:2026-10-30'),false)})});

test('HTML output escapes report text; archive empty has no fabricated reports',()=>{assert.equal(escaped('<script>"'), '&lt;script&gt;&quot;');const s=listHtml([]);assert.ok(s.includes('No autonomous weekly report'));assert.ok(s.includes('class="site-header"'));assert.ok(s.includes('weekly-index')===false)});


test('An editorial backfill is visibly labeled without claiming direct Scryfall API validation',()=>{
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
 assert.match(html,/source-checked using the method described in the editorial disclosure/);
 assert.doesNotMatch(html,/verified Scryfall card sources|Every linked card is an actual Scryfall record/);
 assert.match(html,/Backfilled from independent public card records/);
 assert.match(html,/source-checked card research/);
 assert.match(html,/Card lookup:.*Commander on Scryfall/);
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
 assert.match(html,/<img data-weekly-card-img src="https:\/\/cards\.scryfall\.io\/normal\/front\/a\/8\/a8564611-b678-4336-87e0-5a00a930de48\.jpg/);
 assert.match(html,/alt="Full Magic: The Gathering Commander card: Vhati il-Dal"/);
 assert.match(html,/width="220" height="307"/);
 assert.match(html,/VIEW FULL CARD ON SCRYFALL/);
 assert.match(html,/weekly-card-art\.mjs/);
 assert.ok(commanderArt(old)?.includes('a8564611-b678'));
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
