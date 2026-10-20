// Canonical daily front end deliberately embeds the original Game Lab game.
// This module only presents authenticated server-replayed rankings.
// It never trusts localStorage, screenshots, query parameters, or Lab messages
// as proof of a win. Only same-origin server-replayed daily moves qualify for ranked scoring.
const frame=document.getElementById('stackbreakerOriginal');
const status=document.getElementById('rankedStatus');
const list=document.getElementById('rankings');
const loaded=document.getElementById('frameStatus');
const rankedButton=document.getElementById('rankedRun');
const rankedState=document.getElementById('rankedRunState');
const gameOrigin=new URL(frame.src).origin;
let active=false,server=null,frameReady=false,inFlight=false,ranked=null;
const setRunLabel=(value)=>{rankedState.textContent=value;};
async function api(payload){
 const response=await fetch('/api/stackbreaker',{cache:'no-store',credentials:'same-origin',
  ...(payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})});
 const data=await response.json().catch(()=>({error:'Invalid server response'}));
 if(!response.ok)throw Error(data.error||'Server unavailable');
 return data;
}
function sendState(record){
 if(!frameReady||!record?.state||!record?.attempt||!record.scenario)return;
 if(record.state.id!==record.scenario.id||!record.day||!record.entry
  ||record.entry.puzzleId!==record.scenario.id)return;
 frame.contentWindow.postMessage({type:'dc-sb-ranked-state',day:record.day,
  puzzleId:record.scenario.id,state:record.state,moves:record.attempt.moves,
  status:record.attempt.status},gameOrigin);
 ranked=record;
 rankedButton.textContent=record.attempt.status==='started'?'RESUME YOUR ONE DAILY RUN':'TODAY\'S RUN FINISHED';
 rankedButton.disabled=record.attempt.status!=='started';
 setRunLabel(record.attempt.status==='started'?'Verified run in progress · '+record.attempt.moves+' server-accepted moves':
  'Today\'s official attempt is locked · '+record.attempt.status.toUpperCase());
}
async function checkRanked(){
 try{
  const data=await api();
  server=data;
  if(!data.eligible){
   rankedButton.disabled=true;rankedButton.textContent='PRACTICE-ONLY DATE';
   setRunLabel('Today\'s generated case is awaiting editorial review. No ranked attempt is available.');
   return;
  }
  if(data.attempt){
   ranked=data;rankedButton.textContent=data.attempt.status==='started'?'RESUME YOUR ONE DAILY RUN':'DAILY RUN COMPLETE';
   rankedButton.disabled=data.attempt.status!=='started';
   if(data.attempt.status==='started'&&frameReady)sendState(data);
   else setRunLabel('Your one official attempt has already been recorded for '+data.day+'.');
  }else{
   rankedButton.textContent='START ONE VERIFIED RUN';rankedButton.disabled=false;
   setRunLabel('One qualifying start per profile per UTC date. All moves are server-replayed.');
  }
 }catch(e){
  server=null;rankedButton.disabled=true;rankedButton.textContent='SIGN IN TO RANK';
  setRunLabel(e.message.includes('Sign in')?'Sign in to your community profile first. Guest practice uses the identical game without leaderboard credit.':
   'Server-verified mode is not available. Original game remains playable as unverified practice.');
 }
}
async function startRanked(){
 if(inFlight||!server?.eligible||!frameReady)return;
 inFlight=true;rankedButton.disabled=true;
 try{
  const current=await api();
  const outcome=current.attempt?current:await api({action:'start'});
  const canonical=outcome.state&&outcome.scenario?outcome:await api();
  server=canonical;sendState(canonical);
 }catch(e){setRunLabel('Cannot start or resume: '+e.message);await checkRanked();}
 finally{inFlight=false;}
}
rankedButton.addEventListener('click',startRanked);
window.addEventListener('message',async event=>{
 if(event.source!==frame.contentWindow||event.origin!==gameOrigin)return;
 const data=event.data;
 if(!data||typeof data!=='object')return;
 if(data.type==='dc-sb-ranked-ready'){
  frameReady=true;
  if(server?.attempt?.status==='started'&&server?.state)sendState(server);
  else await checkRanked();
  return;
 }
 if(data.type!=='dc-sb-ranked-move')return;
 if(inFlight||!ranked?.attempt||ranked.attempt.status!=='started'||
  data.day!==ranked.day||data.puzzleId!==ranked.entry?.puzzleId)return;
 inFlight=true;rankedButton.disabled=true;
 try{
  const result=await api({action:'move',seq:ranked.attempt.moves,move:data.move});
  const refreshed=await api();
  sendState(refreshed);
  if(result.attempt?.status==='won')await board();
 }catch(e){
  frame.contentWindow.postMessage({type:'dc-sb-ranked-error'},gameOrigin);
  setRunLabel('Move not accepted. Resyncing from authoritative server.');
  try{const refreshed=await api();sendState(refreshed)}catch{}
 }finally{inFlight=false;}
});
function info(message){status.textContent=message;}
frame.addEventListener('load',()=>{loaded.textContent='Original Stackbreaker loaded. Ranked results come only from your website-verified official attempt.';});
frame.addEventListener('error',()=>{loaded.textContent='Unable to embed the game. Use Open Original Game to play.';});
async function board(){
 info('Checking current UTC verified rankings…');
 list.replaceChildren();
 try{
  const response=await fetch('/api/stackbreaker?view=leaderboard',{cache:'no-store',credentials:'same-origin',headers:{'Accept':'application/json'}});
  if(!response.ok)throw Error('Leaderboard service unavailable');
  const payload=await response.json();
  if(!payload.ok||!Array.isArray(payload.entries)||payload.method!=='SERVER_REPLAY_ONLY')throw Error('Invalid verified ranking response');
  active=payload.enabled===true;
  info(active?'Verified daily rankings · '+payload.day+' UTC':'Ranked scoring is not enabled. Original Stackbreaker practice is free and unchanged.');
  for(const row of payload.entries){
   if(!Number.isInteger(row.rank)||!Number.isInteger(row.acceptedMoves))continue;
   const item=document.createElement('li');
   const name=document.createElement('span'),score=document.createElement('strong');
   name.textContent='#'+row.rank+'  '+String(row.handle||'').slice(0,24);
   score.textContent=row.acceptedMoves+' moves';
   item.append(name,score);list.append(item);
  }
  if(!payload.entries.length){
   const empty=document.createElement('li');
   empty.textContent=active?'No verified wins yet today.':'No ranked attempts are being accepted yet.';
   list.append(empty);
  }
 }catch(e){info('Verified rankings temporarily unavailable. Original Game Lab practice still works.');}
}
document.getElementById('refreshLeaderboard').addEventListener('click',board);
board();checkRanked();
