// Authenticated Stackbreaker website lane. Pinned gameplay source from
// Game Lab commit 9533987e5ec28cdbbbf07175a6cda5813b580d16.
// Deliberately fail-closed until its additive D1 schema and QA gate are ready.
import daily from './data/daily-manifest.json' with {type:'json'};
import core from './data/scenarios.json' with {type:'json'};
import expansion from './data/campaign-expansion.json' with {type:'json'};
import {generateStages} from './src/galaxies.js';
import {commanderScenario} from './src/commander.js';
import {RULES_VERSION} from './src/cards.js';
import {createGame,tapLand,playLand,activate,pass} from './src/engine.js';
export const LAB_SOURCE_SHA='9533987e5ec28cdbbbf07175a6cda5813b580d16';
export const STACKBREAKER_SERVER_RULES=RULES_VERSION;
export const MAX_ACCEPTED_MOVES=140;
const fail=(message)=>{throw Error(message);};
const only=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)
 &&Object.keys(obj).every(k=>keys.includes(k));
let cached;
export function loadScenarios(){
 if(!cached){
  const originals=[...core,...expansion];
  const base=[...originals,...generateStages(originals)];
  if(base.length!==250||new Set(base.map(x=>x.id)).size!==250)fail('Campaign scenario mismatch');
  cached=base.map((s,i)=>commanderScenario(s,i));
 }
 return cached;
}
export function utcDay(now=new Date()){
 const date=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(date.getTime()))fail('Invalid server clock');
 return date.toISOString().slice(0,10);
}
export function approvedDailyEntry(day){
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
 const entry=daily.entries.find(x=>x.utcDate===day);
 if(!entry||entry.rulesVersion!==RULES_VERSION||entry.puzzleRevision!==1||entry.manifestVersion!==1)return null;
 // Editorial gate: the 60 auto-generated cases are engine-tested, but still
 // lack human review. No authenticated scores for them until review.
 if(!/^sb-\d{2}$/.test(entry.puzzleId))return null;
 return entry;
}
export function currentDaily(now=new Date()){
 return approvedDailyEntry(utcDay(now));
}
export function boundScenario(entry){
 if(!entry||entry.rulesVersion!==RULES_VERSION)return null;
 const scenario=loadScenarios().find(x=>x.id===entry.puzzleId);
 return scenario&&scenario.version===RULES_VERSION?scenario:null;
}
export async function digestScenario(scene){
 const bytes=new TextEncoder().encode(JSON.stringify(scene));
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return [...hash].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function replayServerMoves(scene,moves){
 if(!Array.isArray(moves)||moves.length>MAX_ACCEPTED_MOVES)fail('Too many moves');
 let state=createGame(scene),casts=0,passes=0;
 for(const m of moves){
  if(state.status!=='playing'||!only(m,['type','landId','handId','actionId','targetId','genericSpend']))fail('Invalid move envelope');
  const before=JSON.stringify(state);
  if(m.type==='tap'&&only(m,['type','landId'])&&typeof m.landId==='string')state=tapLand(state,m.landId);
  else if(m.type==='play-land'&&only(m,['type','handId'])&&typeof m.handId==='string')state=playLand(state,m.handId);
  else if(m.type==='cast'&&only(m,['type','actionId','targetId','genericSpend'])&&typeof m.actionId==='string'){
   state=activate(state,m.actionId,m.targetId??null,m.genericSpend??null);casts++;
  }else if(m.type==='pass'&&only(m,['type'])){state=pass(state);passes++;}
  else fail('Unsupported or malformed replay move');
  if(JSON.stringify(state)===before)fail('Move had no effect');
 }
 return {state,score:{status:state.status,completed:state.status==='won',acceptedActionCount:moves.length,
  castAndActivationCount:casts,priorityPassCount:passes,hintUsed:false,undoUsed:false}};
}
