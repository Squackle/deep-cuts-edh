import test from 'node:test';import assert from 'node:assert/strict';
import {analyze} from '../../scripts/game-quality/decision-graph.mjs';
const graph=(edges,wins=['win'])=>({initial:()=> 'start',key:s=>s,won:s=>wins.includes(s),next:function*(s){for(const n of edges[s]||[])yield[{to:n},n]}});
test('shortest strategy risk range is route-order invariant',()=>{
 const a=analyze(graph({start:['risk','safe'],risk:['winRisk','trap'],safe:['winSafe']},['winRisk','winSafe']),{includeStrategyRange:true});
 const b=analyze(graph({start:['safe','risk'],risk:['winRisk','trap'],safe:['winSafe']},['winRisk','winSafe']),{includeStrategyRange:true});
 assert.notEqual(a.pressure,b.pressure);assert.deepEqual(a.strategyRange,b.strategyRange);
 assert.deepEqual(a.strategyRange,{minCriticalChoices:0,maxCriticalChoices:1,minPeakBits:0,maxPeakBits:1,strategiesDiffer:true});
});
test('forced steps and equivalent legal actions do not increase risk range',()=>{
 const a=analyze(graph({start:['a'],a:['win','win','dead']}),{includeStrategyRange:true});
 const b=analyze(graph({start:['pre'],pre:['a'],a:['win','dead']}),{includeStrategyRange:true});
 assert.deepEqual(a.strategyRange,b.strategyRange);
});
test('cycle, alternate depths and already-won initial position',()=>{
 const a=analyze(graph({start:['a','win'],a:['a','late'],late:['win']}),{includeStrategyRange:true});
 assert.equal(a.shortestActions,1);assert.equal(a.strategyRange.minCriticalChoices,0);assert.equal(a.strategyRange.maxCriticalChoices,0);
 const won=analyze({...graph({}),initial:()=> 'win'},{includeStrategyRange:true});
 assert.equal(won.shortestActions,0);assert.deepEqual(won.strategyRange,{minCriticalChoices:0,maxCriticalChoices:0,minPeakBits:0,maxPeakBits:0,strategiesDiffer:false});
});
test('new diagnostic opt-in leaves committed evidence unchanged',()=>{
 const a=analyze(graph({start:['win','dead']}));
 assert.equal(Object.hasOwn(a,'strategyRange'),false);
 const b=analyze(graph({start:['win','dead']}),{includeStrategyRange:true});
 assert.deepEqual({...b,strategyRange:undefined},{...a,strategyRange:undefined});
});
test('inconclusive cases never claim a shortest strategy range',()=>{
 const a=analyze(graph({start:['a'],a:['win']}),{maxStates:2,includeStrategyRange:true});
 assert.equal(a.status,'inconclusive');assert.equal(a.strategyRange,undefined);
});
