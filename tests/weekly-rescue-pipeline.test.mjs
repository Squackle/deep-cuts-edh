import test from 'node:test';
import assert from 'node:assert/strict';
import publisher from '../workers/weekly-rescue-publisher.js';
import {escaped,listHtml,reportHtml} from '../src/weekly-rescues-html.js';

const mem=()=>{const map=new Map();return {map,async get(k,mode){const v=map.get(k);return mode==='json'&&v?JSON.parse(v):v||null},async put(k,v){map.set(k,v)}}};
const paper=(name,oracle,colors=['U'],edhrec_rank=4000)=>({name,oracle_text:oracle,type_line:'Legendary Creature — Human Wizard',color_identity:colors,legalities:{commander:'legal'},lang:'en',games:['paper'],edhrec_rank,scryfall_uri:'https://scryfall.com/card/set/1/'+encodeURIComponent(name),prices:{usd:'0.30'}});
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
 const output=reportHtml(report);assert.ok(output.includes('https://scryfall.com/'));assert.ok(output.includes('STRATEG'));assert.ok(!output.includes('<script>alert'));
})});

test('DST and standard time both select 10 Central, not UTC midnight',async()=>{const {localReleaseWindow}=await import('../workers/weekly-rescue-publisher.js');assert.equal(localReleaseWindow(new Date('2026-10-30T15:00:00Z')),true);assert.equal(localReleaseWindow(new Date('2026-11-06T16:00:00Z')),true);assert.equal(localReleaseWindow(new Date('2026-11-06T15:00:00Z')),false);assert.equal(localReleaseWindow(new Date('2026-10-30T16:00:00Z')),false);assert.equal(localReleaseWindow(new Date('2026-11-05T16:00:00Z')),false)})

test('AI invalid candidate holds publication rather than inventing a report',async()=>{await withMock(async()=>{const kv=mem();const env={REPORTS:kv,AI:{async run(){return {response:'{"commander":"Invented Commander","supportCards":[]}'}}}};const {publish}=await import('../workers/weekly-rescue-publisher.js');const r=await publish(env,new Date('2026-10-30T15:00:00Z'));assert.equal(r.status,'held_for_review');assert.equal(kv.map.has('index'),false);assert.equal(kv.map.has('article:2026-10-30'),false)})});

test('HTML output escapes report text; archive empty has no fabricated reports',()=>{assert.equal(escaped('<script>"'), '&lt;script&gt;&quot;');const s=listHtml([]);assert.ok(s.includes('No autonomous weekly report'));assert.ok(s.includes('class="site-header"'));assert.ok(s.includes('weekly-index')===false)});
