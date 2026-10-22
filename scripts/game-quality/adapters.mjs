import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Loads an explicitly supplied local checkout. Never downloads games or contacts APIs.
export async function loadGames(root){
 const load=p=>import(pathToFileURL(resolve(root,p)).href);
 const [mh,levels,ratings,readiness,sb,cards,galaxies,commander]=await Promise.all([
  load('mana-heist/src/engine.js'),load('mana-heist/src/levels.js'),load('mana-heist/src/difficulty-metrics.js'),load('mana-heist/src/readiness-audit.js'),
  load('stackbreaker/src/engine.js'),load('stackbreaker/src/cards.js'),load('stackbreaker/src/galaxies.js'),load('stackbreaker/src/commander.js')]);
 const core=['scenarios','campaign-expansion'].flatMap(n=>JSON.parse(readFileSync(resolve(root,'stackbreaker/data/'+n+'.json'),'utf8')));
 const scenarios=[...core,...galaxies.generateStages(core)].map(commander.commanderScenario);
 const mana=p=>({initial:()=>mh.initial(p),key:s=>mh.key(s),won:s=>mh.completed(p,s),
  next:function*(s){for(const a of mh.actions(p,s)){const out=mh.reduce(p,s,a);if(!out.ok)throw Error(out.error);yield[a,out.state]}}});
 const stack=p=>{
  // This normalization only supports the current response snapshots. Their
  // lands are free single-output mana abilities; no land-targeting effects or
  // phase transition exists here. Tapping permutations are not decisions.
  if(p.activeActor!=='opponent'||p.lands.some(l=>!cards.LANDS[l.card]))throw Error('Unsupported Stackbreaker snapshot');
  return {initial:()=>{let s=sb.createGame(p);for(const l of s.lands.filter(l=>l.controller==='player'&&!l.tapped))s=sb.tapLand(s,l.id);return s},
   key:s=>JSON.stringify([s.life,s.mana,s.units,s.stack,[...s.used].sort(),s.enchantments,s.passCount,s.currentActor,s.status]),
   won:s=>s.status==='won',lost:s=>s.status==='lost',
   next:function*(s){
    yield[{type:'pass'},sb.pass(s)];
    for(const id of sb.legalActions(s)){
     const a=s.hand.find(a=>a.id===id);
     for(const target of sb.legalTargets(s,a))for(const pay of a.sourceId?[{spend:null}]:sb.paymentOptions(s,cards.CARDS[a.card].cost))
      yield[{type:'cast',id,target,payment:pay.spend},sb.activate(s,id,target,pay.spend)];
    }
   }};
 };
 function shorterReference(p){
  let start=stack(p).initial(),shortest=p.solution.length,route=p.solution,checked=0;
  // Exhaustive SUBSETS of the supplied line, not exhaustive legal solutions.
  for(let mask=0;mask<2**p.solution.length;mask++){
   const candidate=p.solution.filter((_,i)=>mask&(1<<i));if(candidate.length>=shortest)continue;
   let state=start;checked++;
   try{for(const[id,target]of candidate)state=sb.activate(state,id,target);
    if(sb.autoplay(state).status==='won'){shortest=candidate.length;route=candidate;}
   }catch{ /* An invalid subset is not a winning counterexample. */ }
  }
  return {referenceResponses:p.solution.length,shortestKnownResponses:shortest,shortcut:shortest<p.solution.length,route,checked};
 }
 return {manaLevels:levels.LEVELS,baseMana:levels.BASE_LEVELS,stackLevels:scenarios,mana,stack,shorterReference,ratings,readiness};
}
