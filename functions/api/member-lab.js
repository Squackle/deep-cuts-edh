import {reply,authorize,originOK,json} from "../../src/member-auth.js";
const land=c=>/\bland\b/i.test(c?.type_line||"")||/^(?:plains|island|swamp|mountain|forest|wastes)$/i.test(c?.name||"");
function classify(c){
 const text=String(c.oracle_text||"").toLowerCase(),roles=[];
 if(land(c))return ["lands"];
 if(/search your library for .*land|add (\{|one mana|two mana)|\bsol ring\b/i.test(text+" "+c.name))roles.push("ramp");
 if(/draw (a|one|two|three|x|that many) cards?|draw cards equal|investigate/i.test(text))roles.push("draw");
 if(/destroy target|exile target|counter target|return target .* (?:hand|owner)|deals? .* damage to target/i.test(text))roles.push("interaction");
 if(/destroy all|exile all|each creature gets -|destroy each/i.test(text))roles.push("wipe");
 if(/hexproof|indestructible|phase out|ward/i.test(text))roles.push("protection");
 return roles;
}
function clean(raw){
 if(!raw||!Array.isArray(raw.cards)||!Array.isArray(raw.commanders)||raw.cards.length>250)return null;
 const commanders=raw.commanders.filter(x=>typeof x==="string"&&x.length>=2&&x.length<=130).slice(0,2);
 const cards=raw.cards.map(x=>({name:String(x?.name||"").slice(0,130),qty:Number(x?.qty),type_line:String(x.card?.type_line||"").slice(0,140),oracle_text:String(x.card?.oracle_text||"").slice(0,2200),cmc:Number(x.card?.cmc||0)}));
 if(!commanders.length||cards.some(x=>!x.name||!Number.isInteger(x.qty)||x.qty<1||x.qty>250)||cards.reduce((a,b)=>a+b.qty,0)>250)return null;
 return {cards,commanders};
}
function diagnose(d){
 const count=d.cards.reduce((n,x)=>n+x.qty,0)+d.commanders.length;
 const counts={lands:0,ramp:0,draw:0,interaction:0,wipe:0,protection:0};
 let weightedMV=0,spellCount=0,unknown=0;
 for(const card of d.cards){
  const roles=classify(card);
  for(const r of roles)counts[r]+=card.qty;
  if(!land(card)){weightedMV+=Math.min(16,Math.max(0,card.cmc))*card.qty;spellCount+=card.qty}
  if(!card.type_line)unknown+=card.qty;
 }
 const curve=spellCount?weightedMV/spellCount:0;
 const targets={lands:curve>3.7?38:36,ramp:10,draw:10,interaction:9,wipe:2,protection:3};
 const priority=Object.entries(targets).map(([role,target])=>({role,current:counts[role],target,missing:Math.max(0,target-counts[role])})).sort((a,b)=>b.missing-a.missing);
 const recommendations=priority.filter(x=>x.missing).map(x=>({role:x.role,suggested:x.missing,reason:({
  lands:"More early land drops help cast the commander consistently.",
  ramp:"Mana acceleration lets your commander and key engines arrive sooner.",
  draw:"More card flow helps recover after removal and avoids empty hands.",
  interaction:"More flexible answers keep opponents' engines from running away.",
  wipe:"Reset buttons give you a chance to rebuild when behind.",
  protection:"Protect the commander and the board pieces your plan needs."
 })[x.role]}));
 const suspects=d.cards.filter(x=>!land(x)&&x.cmc>=6).sort((a,b)=>b.cmc-a.cmc).slice(0,8).map(x=>({name:x.name,reason:"High mana value ("+x.cmc+"). Consider whether its impact justifies the cost or if a cheaper card fills the same role."}));
 const sources=d.cards.filter(land).map(x=>x.name).slice(0,20);
 return {count,legalSize:count===100,commanders:d.commanders,counts,curve:Number(curve.toFixed(2)),unknown,targets,recommendations,suspects,landExamples:sources,disclaimer:"Role and cut suggestions are heuristics, not confirmed rules or playtesting. Check card metadata, color sources and synergy manually."};
}
function simulate(d){
 const pool=[];for(const c of d.cards)for(let n=0;n<c.qty;n++)pool.push(land(c)?"L":"S");
 const commanderCount=d.commanders.length;
 const total=pool.length+commanderCount;
 if(total!==100)return {error:"Probability Lab requires exactly 100 cards including commanders."};
 const cost=Math.max(1,Math.min(12,Number(d.commanderCost)||4));
 const runs=1500,results={turn3:0,turn4:0,turn5:0,keepable:0},landDistribution=Array(8).fill(0);
 function once(){
  let hand=[],idx=0,turn=0,lands=0;
  const deck=pool.slice();
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
  function draw(){if(idx<deck.length)hand.push(deck[idx++])}
  for(let i=0;i<7;i++)draw();
  const opening=hand.filter(x=>x==="L").length;
  landDistribution[Math.min(7,opening)]++;
  if(opening>=2&&opening<=5)results.keepable++;
  for(let t=1;t<=5;t++){
   if(t>1)draw();
   if(hand.includes("L")){hand.splice(hand.indexOf("L"),1);lands++}
   if(t===3&&lands>=cost)results.turn3++;
   if(t===4&&lands>=cost)results.turn4++;
   if(t===5&&lands>=cost)results.turn5++;
  }
 }
 for(let i=0;i<runs;i++)once();
 return {runs,commanderCost:cost,landDistribution,keepable:Number((results.keepable/runs*100).toFixed(1)),turn3:Number((results.turn3/runs*100).toFixed(1)),turn4:Number((results.turn4/runs*100).toFixed(1)),turn5:Number((results.turn5/runs*100).toFixed(1)),warning:"Goldfish land-drop simulation (no mulligans, ramp, color requirements, opponents, commander tax or game-win modeling). No win-rate claim."};
}
export async function onRequestPost({request,env}){
 if(!originOK(request))return reply({error:"Wrong origin."},403);
 let raw;try{raw=await json(request,85000)}catch{return reply({error:"Deck input too large or malformed."},400)}
 const action=raw.action||"dossier";
 const level=action==="dossier"?"informant":"detective";
 const verified=await authorize(request,env,level);if(verified.error)return verified.error;
 const d=clean(raw.deck);if(!d)return reply({error:"Enter a valid deck."},400);
 if(action==="dossier")return reply({ok:true,result:diagnose(d)});
 if(action==="probability")return reply({ok:true,result:simulate({...d,commanderCost:raw.commanderCost})});
 if(action==="collection"){
  const owned=new Set(String(raw.owned||"").split(/\r?\n|,/).map(x=>x.trim().replace(/^\d+x?\s+/i,"").toLowerCase()).filter(Boolean).slice(0,5000));
  const has=[],missing=[];
  for(const c of d.cards)(owned.has(c.name.toLowerCase())?has:missing).push({name:c.name,qty:c.qty});
  return reply({ok:true,result:{owned:has,missing,ownedCards:has.reduce((n,c)=>n+c.qty,0),totalCards:d.cards.reduce((n,c)=>n+c.qty,0),warning:"Compares names, not your available card quantities or printings."}});
 }
 return reply({error:"Unknown lab action."},400);
}
