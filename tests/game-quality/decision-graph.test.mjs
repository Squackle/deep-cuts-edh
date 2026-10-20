import test from 'node:test';import assert from 'node:assert/strict';
import {analyze} from '../../scripts/game-quality/decision-graph.mjs';
import {checkProgression} from '../../scripts/game-quality/progression.mjs';
const graph=(edges,wins=['win'])=>({initial:()=> 'start',key:s=>s,won:s=>wins.includes(s),next:function*(s){for(const n of edges[s]||[])yield[{to:n},n]}});
test('forced length and duplicate action permutations do not manufacture difficulty',()=>{
 const short=analyze(graph({start:['win']}));
 const long=analyze(graph({start:['a','a'],a:['b'],b:['c'],c:['win']}));
 assert.equal(short.pressure,0);assert.equal(long.pressure,0);assert.equal(long.shortestActions,4);
});
test('genuine constrained alternatives raise choice pressure at equal solution length',()=>{
 const easy=analyze(graph({start:['a','b'],a:['win'],b:['win']}));
 const hard=analyze(graph({start:['a','b','c','d'],a:['win'],b:['dead'],c:['dead'],d:['dead']}));
 assert.equal(easy.shortestActions,hard.shortestActions);assert.ok(hard.pressure>easy.pressure);assert.equal(hard.criticalChoices,1);
});
test('forced padding around a real decision leaves its rating unchanged',()=>{
 const a=analyze(graph({start:['win','dead']}));
 const b=analyze(graph({start:['a'],a:['b'],b:['c','dead'],c:['d'],d:['win']}));
 assert.equal(a.pressure,b.pressure);
});
test('safe cycles, losing cycles and merged routes are handled by reverse reachability',()=>{
 const r=analyze(graph({start:['a','trap'],a:['start','win'],trap:['trap']}));
 assert.equal(r.status,'complete');assert.equal(r.shortestActions,2);assert.ok(r.pressure>0);
 assert.equal(analyze(graph({start:['start']})).status,'unsolvable');
});
test('budget exhaustion never masquerades as difficulty or unsolvability',()=>{
 const a=analyze(graph({start:['a'],a:['win']}),{maxStates:2});assert.equal(a.status,'inconclusive');assert.equal(a.pressure,undefined);
 const b=analyze(graph({start:['win','dead']}),{maxEdges:1});assert.equal(b.status,'inconclusive');
});
test('progression gate refuses unknown, flat, or padded-reference curricula',()=>{
 const row=(band,pressure)=>({band,analysis:{status:'complete',pressure}});
 assert.equal(checkProgression([row(1,10),row(2,20)],{bands:2}).accepted,true);
 assert.equal(checkProgression([row(1,20),row(2,20)],{bands:2}).accepted,false);
 assert.equal(checkProgression([{band:1,analysis:{status:'inconclusive'}}],{bands:1}).accepted,false);
 assert.equal(checkProgression([{...row(1,10),reference:{shortcut:true}}],{bands:1}).accepted,false);
});
test('invalid budgets cannot silently disable the search limit',()=>{
 for(const n of [NaN,Infinity,0,-1,1.5])assert.throws(()=>analyze(graph({start:['win']}),{maxStates:n}),RangeError);
});

test('one proven unsolvable puzzle blocks certification even when coverage meets threshold',()=>{
 const rows=Array.from({length:9},()=>({band:1,analysis:{status:'complete',pressure:20}}));
 rows.push({band:1,analysis:{status:'unsolvable'}});
 assert.equal(checkProgression(rows,{bands:1}).accepted,false);
});
