// Explicit local game checkout required; no silent skips or network access.
import assert from 'node:assert/strict';
import {loadGames} from './adapters.mjs';
import {analyze} from './decision-graph.mjs';
if(!process.argv[2])throw Error('Usage: node scripts/game-quality/integration.mjs <game-lab-checkout>');
const games=await loadGames(process.argv[2]);
assert.equal(games.manaLevels.length,500);assert.equal(games.stackLevels.length,250);
const original=games.baseMana[0];
const repeated=n=>({...original,turnLimit:n,stages:Array.from({length:n},()=>structuredClone(original.stages[0]))});
const two=analyze(games.mana(repeated(2))),six=analyze(games.mana(repeated(6)));
assert.equal(two.status,'complete');assert.equal(six.status,'complete');
assert.equal(two.pressure,six.pressure,'Repeating the same tap/cast/turn decision must not escalate pressure');
assert.ok(six.shortestActions>two.shortestActions);
assert.equal(games.ratings.evaluateVault(original).difficulty,17);
assert.equal(games.ratings.evaluateVault(repeated(6)).difficulty,60);
// Record the known counterexample honestly; do not require more actions in
// gameplay just to force the recorded line to be optimal.
const case7=games.stackLevels.find(p=>p.id==='sb-07');
const shortcut=games.shorterReference(case7);
assert.equal(shortcut.referenceResponses,2);assert.equal(shortcut.shortestKnownResponses,1);
console.log('PASS real engines: 500/250 inventory, repetition invariant, and sb-07 shorter legal win');
