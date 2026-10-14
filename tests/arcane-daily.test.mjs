// Run with: node --test tests/arcane-daily.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {CIPHER_WORDS,BOARD_CATEGORIES,buildArcanePuzzle,cipherFeedback,boardMatch,boardOneAway} from '../src/arcane-game-data.js';

test('Cipher answers are only official five-letter creature types',()=>{
 // Verified against Magic Comprehensive Rules 205.3m (June 2026).
 const approved=new Set(('ALIEN ANGEL BEAST BISON CAMEL CHILD CLOWN DALEK DEMON DEVIL DJINN DRAKE DRONE DRUID DRYAD DWARF ELDER GAMER GIANT GNOLL GNOME GOLEM GUEST HARPY HIPPO HORSE HUMAN HYDRA HYENA KIRIN LAMIA LEMUR LICID LLAMA MOUNT MOUSE NINJA NOBLE NOMAD NYMPH OTTER OUPHE PILOT PLANT REBEL RHINO ROBOT ROGUE SABLE SATYR SCION SCOUT SHADE SHARK SHEEP SIREN SKUNK SLITH SLOTH SNAIL SNAKE SPAWN SPIKE SQUID SYNTH TROLL WEIRD WHALE').split(' '));
 assert.equal(CIPHER_WORDS.length,68);
 assert.equal(new Set(CIPHER_WORDS.map(x=>x[0])).size,CIPHER_WORDS.length);
 for(const [type,description] of CIPHER_WORDS){
  assert.ok(approved.has(type),type+' is not in the approved creature-type list');
  assert.match(type,/^[A-Z]{5}$/);
  assert.ok(description.length>=20);
 }
 assert.ok(!CIPHER_WORDS.some(x=>['HASTE','MORPH','TOKEN','EXILE'].includes(x[0])));
});
test('Word bank is curated, correctly sized and non-repeating',()=>{
 assert.ok(CIPHER_WORDS.length>=40);
 assert.equal(new Set(CIPHER_WORDS.map(c=>c[0])).size,CIPHER_WORDS.length);
 for(const [word,definition,example] of CIPHER_WORDS){
  assert.match(word,/^[A-Z]{5}$/);
  assert.ok(definition.length>12);
  assert.ok(example.length>3);
 }
});
test('Repeated letter feedback never creates phantom matches',()=>{
 assert.deepEqual(cipherFeedback('LEVEL','LEVER'),['correct','correct','correct','correct','absent']);
 assert.deepEqual(cipherFeedback('EEEAA','BEAST'),['absent','correct','absent','present','absent']);
 assert.deepEqual(cipherFeedback('AAAAA','BEAST'),['absent','absent','correct','absent','absent']);
});
test('Each curated connection belongs to exactly one four-card category',()=>{
 assert.ok(BOARD_CATEGORIES.length>=12);
 for(const g of BOARD_CATEGORIES)assert.equal(new Set(g[2]).size,4);
 assert.equal(new Set(BOARD_CATEGORIES.flatMap(g=>g[2])).size,BOARD_CATEGORIES.length*4);
});
test('Daily puzzle is stable and shifts among many answers',()=>{
 const seen=new Set(),boards=new Set();
 for(let i=0;i<55;i++){
  const day=new Date(Date.UTC(2026,9,14+i)).toISOString().slice(0,10);
  const w=buildArcanePuzzle('cipher',day),b=buildArcanePuzzle('board',day);
  assert.deepEqual(w,buildArcanePuzzle('cipher',day));
  assert.deepEqual(b,buildArcanePuzzle('board',day));
  assert.equal(b.groups.length,4);
  assert.equal(new Set(b.tiles).size,16);
  assert.ok(b.groups.every(g=>boardMatch(b,g.cards)?.title===g.title));
  seen.add(w.word);boards.add(b.groups.map(g=>g.title).sort().join(','));
 }
 assert.equal(seen.size,55); // All first 55 days must have distinct answers.
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
