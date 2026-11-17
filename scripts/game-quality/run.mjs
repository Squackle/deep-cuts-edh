import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadGames} from './adapters.mjs';
import {analyze} from './decision-graph.mjs';
import {checkProgression} from './progression.mjs';
const root=process.argv[2],output=process.argv[3];
if(!root||!output)throw Error('Usage: node scripts/game-quality/run.mjs <local-game-lab-checkout> <report.json> [maxStates] [--gate]');
const flags=process.argv.slice(4),budget=flags.filter(x=>x!=='--gate');
if(budget.length>1)throw Error('Expected one state budget and optional --gate');
const maxStates=Number(budget[0]||1500);
if(!Number.isSafeInteger(maxStates)||maxStates<1)throw Error('maxStates must be a positive safe integer');
const sha=()=>execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceSha=sha();
const games=await loadGames(root),rows=[];
for(const [game,levels,adapter]of [['mana-heist',games.manaLevels,games.mana],['stackbreaker',games.stackLevels,games.stack]]){
 for(let i=0;i<levels.length;i++){
  const p=levels[i],result=analyze(adapter(p),{maxStates,maxEdges:maxStates*20});
  // Routes remain local synthetic game data; no player progress is accessed.
  const {route,decisions,...analysis}=result;
  rows.push({game,id:p.id,band:Math.floor(i/50)+1,title:p.title,analysis,
   ...(game==='stackbreaker'?{reference:games.shorterReference(p)}:{legacyEstimate:games.ratings.evaluateVault(p).difficulty})});
  if((i+1)%50===0)console.log(game+': '+(i+1)+' / '+levels.length);
 }
}
const inventory=games.readiness.structuralAudit();
if(sha()!==sourceSha)throw Error('Source HEAD changed during analysis; rerun on an isolated checkout');
const report={version:1,sourceSha,maxStates,
 methodology:'Complete reachable-state graph or explicit inconclusive. Choice pressure is a non-empirical proxy on the first shortest-action winning route; steps are not a score term. Stackbreaker auto-pools current basic lands, excludes tapping permutations, and uses every engine-exposed target/payment/pass action. This is not independent MTG rules certification.',
 gates:Object.fromEntries(['mana-heist','stackbreaker'].map(game=>[game,checkProgression(rows.filter(r=>r.game===game),{bands:game==='mana-heist'?10:5})])),
 manaInventory:inventory.summary,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({gates:report.gates,states:rows.reduce((a,r)=>a+r.analysis.states,0),shortcuts:rows.filter(r=>r.reference?.shortcut).length},null,2));
if(process.argv.includes('--gate')&&Object.values(report.gates).some(g=>!g.accepted))process.exitCode=1;
