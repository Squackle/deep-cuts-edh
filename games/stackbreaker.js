import {loadScenarios,utcDay} from '../src/stackbreaker-verify/server-replay.js';
import {createGame,tapLand,playLand,activate,pass,legalActions,legalTargets,paymentOptions} from '../src/stackbreaker-verify/src/engine.js';
import {CARDS,LANDS} from '../src/stackbreaker-verify/src/cards.js';
import manifest from '../src/stackbreaker-verify/data/daily-manifest.json' with {type:'json'};
// Game Lab local results cannot be imported as server-verified proof.
const $=id=>document.getElementById(id);
const cases=loadScenarios(),byID=new Map(cases.map(x=>[x.id,x]));
let server=null,mode='practice',state=null,scenario=null,selected=null,busy=false,seq=0,day=utcDay();
const button=(text,fn,disabled=false)=>{
 const x=document.createElement('button');x.type='button';x.className='tile';x.disabled=disabled;
 x.textContent=text;x.addEventListener('click',fn);return x;
};
const text=(element,value)=>element.textContent=String(value??'');
function error(message=''){text($('error'),message);}
function practiceScenario(){
 const today=manifest.entries.find(x=>x.utcDate===utcDay());
 return byID.get(today?.puzzleId)||cases[0];
}
function setPractice(){
 mode='practice';scenario=practiceScenario();state=createGame(scenario);seq=0;selected=null;
 $('practice').setAttribute('aria-pressed','true');$('verified').setAttribute('aria-pressed','false');
 $('restart').disabled=false;render();error();
}
async function api(body=null){
 const init=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};
 const response=await fetch('/api/stackbreaker',{...init,cache:'no-store',credentials:'same-origin'});
 const data=await response.json().catch(()=>({error:'Invalid server response'}));
 if(!response.ok)throw new Error(data.error||'Server rejected action');
 return data;
}
async function connect(){
 try{
  const data=await api();server=data;day=data.day;
  const entry=data.entry;
  if(!data.eligible){
   text($('auth'),'Signed in · today is practice-only pending puzzle review. Local play is available.');
   $('verified').disabled=true;return;
  }
  if(!entry||!byID.has(entry.puzzleId))throw Error('Today’s source puzzle version does not match this page');
  $('verified').disabled=false;
  if(data.attempt){
   const stage=data.attempt.status;
   text($('verified'),stage==='started'?'RESUME VERIFIED ATTEMPT':'VIEW VERIFIED RESULT');
   text($('auth'),'Signed in · server-bound '+data.day+' attempt: '+stage+' ('+data.attempt.moves+' moves)');
  }else{
   text($('verified'),'START VERIFIED ATTEMPT');
   text($('auth'),'Signed in · daily puzzle eligible for server verification. One qualifying start per UTC day.');
  }
 }catch(e){
  server=null;$('verified').disabled=true;
  text($('auth'),/Sign in/i.test(e.message)?'Guest mode · sign in on My Profile for eligible verified attempts.':
   'Verification unavailable · local practice continues. '+e.message);
 }
}
async function enterVerified(){
 if(busy||!server?.eligible)return;
 busy=true;$('verified').disabled=true;error();
 try{
  const snapshot=server.attempt?await api():await api({action:'start'});
  server={...server,...snapshot,eligible:true};
  if(!snapshot.scenario||!snapshot.state||!byID.has(snapshot.scenario.id))
   throw Error('Server did not return a pinned playable state.');
  mode='verified';scenario=snapshot.scenario;state=snapshot.state;
  seq=snapshot.attempt?.moves||0;selected=null;
  $('practice').setAttribute('aria-pressed','false');$('verified').setAttribute('aria-pressed','true');
  $('restart').disabled=true;
  render();
 }catch(e){error(e.message);}
 finally{busy=false;$('verified').disabled=!server?.eligible;}
}
async function move(instruction){
 if(busy||!state||state.status!=='playing')return;
 if(mode==='verified'&&day!==utcDay()){error('UTC date rolled over. Reload for the new daily puzzle.');return;}
 busy=true;error();
 try{
  if(mode==='verified'){
   const result=await api({action:'move',seq,move:instruction});
   if(!result.state||!result.attempt)throw Error('Missing authoritative replay state');
   state=result.state;seq=result.attempt.moves;server.attempt=result.attempt;
  }else{
   if(instruction.type==='tap')state=tapLand(state,instruction.landId);
   else if(instruction.type==='play-land')state=playLand(state,instruction.handId);
   else if(instruction.type==='cast')state=activate(state,instruction.actionId,instruction.targetId??null,instruction.genericSpend??null);
   else if(instruction.type==='pass')state=pass(state);
   else throw Error('Unsupported local action');
   seq++;
  }
  selected=null;render();
 }catch(e){
  error(e.message);
  if(mode==='verified'){
   try{
    const fresh=await api();server={...server,...fresh};state=fresh.state||state;
    seq=fresh.attempt?.moves||seq;render();
   }catch{error('Cannot confirm server state. Reload before making another move.');}
  }
 }finally{busy=false;}
}
function chooseCard(id){selected=id;render();}
function render(){
 if(!state)return;
 text($('modeLabel'),mode==='verified'?'VERIFIED SERVER REPLAY · '+day:'LOCAL PRACTICE · UNVERIFIED');
 text($('caseTitle'),scenario.title);text($('intro'),scenario.intro);
 text($('playerLife'),state.life.player);text($('opponentLife'),state.life.opponent);
 text($('mana'),Object.entries(state.mana).filter(([,n])=>n>0).map(([k,v])=>v+k).join(' · ')||'EMPTY');
 text($('moves'),seq);
 const lands=$('lands');lands.replaceChildren();
 for(const l of state.lands){
  const x=button(l.card+(l.tapped?' · TAPPED':' · TAP FOR '+LANDS[l.card]?.mana),
   ()=>move({type:'tap',landId:l.id}),l.tapped||state.status!=='playing'||l.controller!=='player');
  x.dataset.tapped=String(!!l.tapped);lands.append(x);
 }
 const creatures=$('creatures');creatures.replaceChildren();
 for(const c of state.units.filter(x=>x.zone==='battlefield')){
  const t=document.createElement('div');t.className='tile';t.textContent=c.card+' · '+c.controller+' · '+(c.damage||0)+' damage';
  creatures.append(t);
 }
 if(!creatures.childElementCount){let x=document.createElement('p');x.textContent='No creatures on the battlefield.';creatures.append(x);}
 const stack=$('stack');stack.replaceChildren();
 for(const item of state.stack){
  const node=document.createElement('li');
  node.textContent=item.card+' · '+item.controller+(item.targetId?' · targeting '+item.targetId:'');
  stack.append(node);
 }
 if(!stack.childElementCount){let x=document.createElement('li');x.textContent='Stack empty';stack.append(x);}
 const hand=$('hand');hand.replaceChildren();
 const can=new Set(legalActions(state));
 for(const c of state.hand.filter(c=>!state.used.includes(c.id))){
  const x=button(c.card+(c.sourceId?' · activate':' · cast'),
   ()=>chooseCard(c.id),!can.has(c.id));
  x.setAttribute('aria-pressed',String(selected===c.id));
  hand.append(x);
 }
 for(const c of state.hand.filter(c=>!state.used.includes(c.id)&&LANDS[c.card])){
  const x=button('PLAY LAND '+c.card,()=>move({type:'play-land',handId:c.id}),
   state.status!=='playing'||state.landPlayed||state.phase!=='main'||state.activeActor!=='player'||state.stack.length>0);
  hand.append(x);
 }
 const card=state.hand.find(x=>x.id===selected&&!state.used.includes(x.id));
 const form=$('castForm');
 form.hidden=!card||!can.has(card.id)||state.status!=='playing';
 if(!form.hidden){
  text($('spellName'),card.card+(card.sourceId?' · activated ability':' · spell'));
  const targets=legalTargets(state,card);$('target').replaceChildren();
  for(const target of targets){
   const x=document.createElement('option');x.value=target===null?'__NONE__':target;
   x.textContent=target===null?'No target':target==='player'?'You':target==='opponent'?'Opponent':
     state.stack.find(s=>s.id===target)?.card||state.units.find(u=>u.id===target)?.card||target;
   $('target').append(x);
  }
  $('payment').replaceChildren();
  const options=card.sourceId?[{spend:{},label:'Activation cost'}]:paymentOptions(state,CARDS[card.card].cost);
  for(const option of options){
   const x=document.createElement('option');x.value=JSON.stringify(option.spend);x.textContent=option.label||'No generic mana';
   $('payment').append(x);
  }
  $('cast').disabled=options.length===0||targets.length===0;
 }
 $('pass').disabled=state.status!=='playing'||busy;
 $('restart').disabled=mode!=='practice';
 text($('result'),state.status==='won'?(mode==='verified'?'VERIFIED WIN · SERVER CONFIRMED':'PRACTICE SOLVED · UNVERIFIED'):
  state.status==='lost'?(mode==='verified'?'VERIFIED ATTEMPT FINISHED · NOT WON':'PRACTICE LOST · TRY AGAIN'):'PRIORITY WINDOW OPEN');
 const log=$('log');log.replaceChildren();
 for(const entry of state.log.slice(-12)){let x=document.createElement('li');x.textContent=entry;log.append(x);}
}
$('castForm').addEventListener('submit',e=>{
 e.preventDefault();if(!selected)return;
 const target=$('target').value,spend=JSON.parse($('payment').value||'{}');
 move({type:'cast',actionId:selected,targetId:target==='__NONE__'?null:target,genericSpend:spend});
});
$('cancel').addEventListener('click',()=>{selected=null;render();});
$('pass').addEventListener('click',()=>move({type:'pass'}));
$('restart').addEventListener('click',setPractice);
$('practice').addEventListener('click',setPractice);
$('verified').addEventListener('click',enterVerified);
setPractice();connect();
