// Run with: node --test tests/arcane-daily.test.mjs
import test from 'node:test';
import {onRequestGet as arcaneGet} from '../functions/api/arcane-games.js';
import assert from 'node:assert/strict';
// Cron prewarm is part of daily-game integrity; include its isolated tests in existing CI.
import './daily-puzzle-clock.test.mjs';
// P1 Conspiracy Board Central midnight, shuffle and practice nonrepetition.
import './conspiracy-board-variety.test.mjs';
import {CIPHER_WORDS,CIPHER_TYPES,BOARD_CATEGORIES,buildArcanePuzzle,cipherFeedback,cipherLetters,cipherPattern,boardMatch,boardOneAway,chicagoDate} from '../src/arcane-game-data.js';

test('Full creature subtype catalog is valid and archived five-letter editions stay available',()=>{
 // Rule 205.3m includes 324 types, including a two-word type and punctuation.
 assert.equal(CIPHER_TYPES.length,324);
 assert.equal(new Set(CIPHER_TYPES.map(x=>x[0])).size,CIPHER_TYPES.length);
 assert.equal(CIPHER_WORDS.length,68);
 const all=new Set(CIPHER_TYPES.map(x=>x[0]));
 for(const [type,description] of CIPHER_TYPES){
  assert.match(type,/^[A-Z]+(?:[ ’-][A-Z]+)*$/);
  assert.ok(cipherLetters(type).length>=2&&cipherLetters(type).length<=24);
  assert.equal(cipherPattern(type).replace(/_/g,''),type.replace(/[A-Z]/g,''));
  assert.ok(description.length>=20);
 }
 for(const [legacy] of CIPHER_WORDS)assert.ok(all.has(legacy),legacy);
 for(const name of ['ELF','TIME LORD','ASSEMBLY-WORKER','C’TAN','SHI’AR','SHAPESHIFTER','TRISKELAVITE'])
  assert.ok(all.has(name),'missing '+name);
 assert.ok(!all.has('HASTE')&&!all.has('MORPH')&&!all.has('EXILE'));
});
test('The daily pool spans short, long and punctuation-bearing creature types',()=>{
 const lengths=new Set(CIPHER_TYPES.map(x=>cipherLetters(x[0]).length));
 assert.ok(lengths.has(3)&&lengths.has(5)&&lengths.has(10)&&lengths.has(14));
 assert.equal(buildArcanePuzzle('cipher','2026-10-14').edition,'creature-types-v2');
 assert.equal(buildArcanePuzzle('cipher','2026-10-15').edition,'creature-types-v3');
 const first=buildArcanePuzzle('cipher','2026-10-15');
 assert.ok(CIPHER_TYPES.some(([word])=>word===first.word));
});
test('Repeated letter feedback never creates phantom matches',()=>{
 assert.deepEqual(cipherFeedback('LEVEL','LEVER'),['correct','correct','correct','correct','absent']);
 assert.deepEqual(cipherFeedback('EEEAA','BEAST'),['absent','correct','absent','present','absent']);
 assert.deepEqual(cipherFeedback('AAAAA','BEAST'),['absent','absent','correct','absent','absent']);
});
test('Variable-length feedback ignores separators and preserves duplicate-letter rules',()=>{
 assert.deepEqual(cipherFeedback('TIMELORD','TIME LORD'),Array(8).fill('correct'));
 assert.deepEqual(cipherFeedback('ASSEMBLYWORKER','ASSEMBLY-WORKER'),Array(14).fill('correct'));
 assert.deepEqual(cipherFeedback('CTAN','C’TAN'),Array(4).fill('correct'));
 assert.deepEqual(cipherFeedback('SHIAR','SHI’AR'),Array(5).fill('correct'));
 assert.deepEqual(cipherFeedback('AAA','BAT'),['absent','correct','absent']);
 assert.throws(()=>cipherFeedback('ABCDE','DRAGON'),RangeError);
});
test('Each curated connection belongs to exactly one four-card category',()=>{
 assert.ok(BOARD_CATEGORIES.length>=12);
 for(const g of BOARD_CATEGORIES)assert.equal(new Set(g[2]).size,4);
 assert.equal(new Set(BOARD_CATEGORIES.flatMap(g=>g[2])).size,BOARD_CATEGORIES.length*4);
});
test('Daily puzzle is stable and shifts among many answers',()=>{
 const seen=new Set(),boards=new Set(),lengths=new Set();
 for(let i=0;i<CIPHER_TYPES.length;i++){
  const day=new Date(Date.UTC(2026,9,15+i)).toISOString().slice(0,10);
  const w=buildArcanePuzzle('cipher',day),b=buildArcanePuzzle('board',day);
  assert.deepEqual(w,buildArcanePuzzle('cipher',day));
  assert.deepEqual(b,buildArcanePuzzle('board',day));
  assert.equal(b.groups.length,4);
  assert.equal(new Set(b.tiles).size,16);
  assert.ok(b.groups.every(g=>boardMatch(b,g.cards)?.title===g.title));
  seen.add(w.word);lengths.add(cipherLetters(w.word).length);boards.add(b.groups.map(g=>g.title).sort().join(','));
 }
 assert.equal(seen.size,CIPHER_TYPES.length); // No duplicate until every type has appeared.
 assert.ok(lengths.size>=8,'Too few lengths in the annual rotation');
 assert.ok(boards.size>20);
});
test('Connection one-away feedback does not count already-solved groups',()=>{
 const p=buildArcanePuzzle('board','2026-10-14');
 const g=p.groups[0],other=p.groups[1];
 assert.equal(boardMatch(p,g.cards)?.title,g.title);
 assert.equal(boardMatch(p,[...g.cards.slice(0,3),other.cards[0]]),null);
 assert.equal(boardOneAway(p,[...g.cards.slice(0,3),other.cards[0]],[]),true);
 assert.equal(boardOneAway(p,[...g.cards.slice(0,3),other.cards[0]],[g.title]),false);
});

test('Conspiracy Board v2 changes October 22 and rotates without adjacent-day category repeats',()=>{
 const previous=buildArcanePuzzle('board','2026-10-21');
 const today=buildArcanePuzzle('board','2026-10-22');
 const oldToday=['SPOT REMOVAL','TOKEN DOUBLERS','COUNTERMAGIC','TREASURE MAKERS'];
 assert.equal(previous.edition,'hand-curated-v1','Do not rewrite historic dated puzzles');
 assert.equal(today.edition,'hand-curated-v2');
 assert.equal(today.groups.length,4);
 assert.equal(new Set(today.tiles).size,16);
 assert.equal(today.groups.some(g=>oldToday.includes(g.title)),false,
  'October 22 new puzzle must contain four different groups from its original frozen board');
 const all=new Set(BOARD_CATEGORIES.map(g=>g[0]));
 let prior=new Set();
 const signatures=[];
 for(let i=0;i<52;i++){
  const date=new Date(Date.UTC(2026,9,22+i)).toISOString().slice(0,10);
  const puzzle=buildArcanePuzzle('board',date);
  assert.equal(puzzle.edition,'hand-curated-v2');
  assert.deepEqual(puzzle,buildArcanePuzzle('board',date),'Everybody must get the same deterministic daily puzzle');
  assert.equal(new Set(puzzle.tiles).size,16);
  assert.equal(new Set(puzzle.groups.map(g=>g.title)).size,4);
  for(const group of puzzle.groups){
   assert.ok(all.has(group.title));
   assert.equal(boardMatch(puzzle,group.cards)?.title,group.title);
   assert.ok(!prior.has(group.title),'Repeated category on adjacent date: '+date+' '+group.title);
  }
  prior=new Set(puzzle.groups.map(g=>g.title));
  signatures.push(puzzle.groups.map(g=>g.title).join('/'));
  if(i%4===3){
   const groupNames=signatures.slice(-4).flatMap(s=>s.split('/'));
   assert.equal(new Set(groupNames).size,16,'All 16 groups must be featured once in a 4-day cycle');
  }
 }
 assert.ok(new Set(signatures).size>10,'Rotating days should not repeat a small set of boards');
});
test('Conspiracy Board practice mode remains independently randomized and stable by seed',()=>{
 const first=buildArcanePuzzle('board','practice','practice',78321);
 const second=buildArcanePuzzle('board','practice','practice',78321);
 const alternative=buildArcanePuzzle('board','practice','practice',78322);
 assert.deepEqual(first,second);
 assert.equal(first.groups.length,4);
 assert.equal(first.edition,'hand-curated-v1');
 assert.notDeepEqual(first.tiles,alternative.tiles);
});

test('Oct 22 frozen board automatically refreshes only when no signed-in run exists',async()=>{
 const day=chicagoDate();
 if(day!=='2026-10-22')return; // Runtime clock only controls same-day hotfix test.
 const original={groups:BOARD_CATEGORIES.slice(0,4).map(([title,description,cards])=>({title,description,cards})),
  tiles:BOARD_CATEGORIES.slice(0,4).flatMap(g=>g[2]),edition:'hand-curated-v1'};
 const url='https://deep-cuts-edh.pages.dev/api/arcane-games?game=board&action=state&mode=daily';
 const request=new Request(url);
 for(const started of [false,true]){
  let snapshot=JSON.stringify(original),changes=0;
  const db={prepare(sql){
   let args=[];
   return {
    bind(...parts){args=parts;return this},
    async first(){
     if(sql.includes('SELECT payload FROM daily_arcane_puzzles'))return {payload:snapshot};
     return null;
    },
    async all(){return {results:[]}},
    async run(){
     if(sql.startsWith('UPDATE daily_arcane_puzzles')){
      if(!started&&JSON.parse(snapshot).edition==='hand-curated-v1'){
       snapshot=args[0];changes++;return {meta:{changes:1}};
      }
      return {meta:{changes:0}};
     }
     throw Error('Unexpected database write: '+sql);
    }
   };
  }};
  const response=await arcaneGet({request,env:{DB:db}});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.tiles.length,16);
  assert.equal(changes,started?0:1,'Must not replace frozen puzzle after signed-in play begins');
  const chosen=JSON.parse(snapshot);
  assert.equal(chosen.edition,started?'hand-curated-v1':'hand-curated-v2');
  if(!started){
   assert.deepEqual(chosen.groups,buildArcanePuzzle('board',day).groups);
   assert.deepEqual(chosen.tiles,buildArcanePuzzle('board',day).tiles);
  }
 }
});
