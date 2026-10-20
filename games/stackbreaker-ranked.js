// Website authority layer around the UNMODIFIED launched Game Lab Stackbreaker.
// Game interface, rules, animations and controls remain on the canonical Lab route.
const LAB='https://deep-cuts-game-lab.pages.dev';
const frame=document.getElementById('stackbreakerOriginal');
const start=document.getElementById('verified');
const auth=document.getElementById('auth');
const ranks=document.getElementById('leaderboard');
const rankStatus=document.getElementById('rankStatus');
let day=null,entry=null,attempt=null,boardReady=false,busy=false;
const text=(node,message)=>{node.textContent=message;};
const api=async(method='GET',payload)=>{
 const response=await fetch('/api/stackbreaker',{method,credentials:'same-origin',cache:'no-store',
  headers:method==='POST'?{'Content-Type':'application/json'}:undefined,
  body:payload?JSON.stringify(payload):undefined});
 const data=await response.json().catch(()=>({error:'Invalid website response'}));
 if(!response.ok)throw Object.assign(new Error(data.error||'Verification unavailable'),{status:response.status});
 return data;
};
const post=(message)=>{
 if(!boardReady||!frame.contentWindow)return;
 frame.contentWindow.postMessage(message,LAB);
};
function applyState(data){
 day=data.day||day;entry=data.entry||entry;attempt=data.attempt||null;
 if(day)document.getElementById('rankDate').textContent=day+' UTC · authoritative completed runs only';
 start.disabled=busy||!boardReady||!entry||!!attempt;
 start.textContent=attempt?'TODAY’S RUN ALREADY STARTED':'START MY ONE DAILY RUN';
 const availability=entry?'Eligible for verified play today.':'Today’s puzzle is awaiting editorial review; the original practice game is available.';
 text(auth,attempt?'Official run '+attempt.status+' · '+attempt.moves+' accepted actions · refreshing resumes the same run.':availability);
 if(attempt&&data.state&&entry){
  post({type:'dc-sb-ranked-state',day,puzzleId:entry.puzzleId,state:data.state,
   status:attempt.status,moves:attempt.moves});
 }
}
async function load(){
 try{const data=await api();applyState(data)}
 catch(e){start.disabled=true;text(auth,e.status===401?'Sign in to your Community profile to start your one official run.':e.message)}
}
async function submitMove(move){
 if(busy||!attempt||attempt.status!=='started'||!entry)return;
 busy=true;
 try{
  const data=await api('POST',{action:'move',seq:attempt.moves,move});
  await load();
  if(data?.attempt?.status==='won'||data?.attempt?.status==='lost')await leaderboard();
 }catch(e){
  post({type:'dc-sb-ranked-error'});
  await load();
  text(auth,'Move not verified: '+e.message+'. The original board was not credited.');
 }finally{busy=false}
}
async function leaderboard(){
 try{
  const r=await fetch('/api/stackbreaker-leaderboard',{credentials:'omit',cache:'no-store'});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Unavailable');
  ranks.replaceChildren();
  for(const [i,x] of (d.entries||[]).entries()){
   const li=document.createElement('li');
   const n=document.createElement('strong');n.textContent=(i+1)+'. '+x.handle;
   const detail=document.createElement('span');detail.textContent=x.moves+' actions · '+x.finishedAt+' UTC';
   li.append(n,detail);ranks.append(li);
  }
  text(rankStatus,(d.entries||[]).length?'Only website-verified wins are displayed.':'No verified winning runs published for this UTC day.');
 }catch(e){text(rankStatus,'Verified leaderboard unavailable: '+e.message)}
}
window.addEventListener('message',async event=>{
 if(event.origin!==LAB||event.source!==frame.contentWindow)return;
 const d=event.data;
 if(!d||typeof d!=='object'||typeof d.type!=='string')return;
 if(d.type==='dc-sb-ranked-ready'){
  boardReady=true;
  await load();
 }else if(d.type==='dc-sb-ranked-move'){
  if(d.day!==day||d.puzzleId!==entry?.puzzleId||!d.move||typeof d.move!=='object')return;
  await submitMove(d.move);
 }
});
start.addEventListener('click',async()=>{
 if(start.disabled||busy||!boardReady||!entry||attempt)return;
 busy=true;start.disabled=true;
 try{const data=await api('POST',{action:'start'});applyState({...data,day,entry})}
 catch(e){text(auth,'Cannot start daily run: '+e.message);await load()}
 finally{busy=false}
});
document.getElementById('refreshRank').addEventListener('click',leaderboard);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();leaderboard()}});
load();leaderboard();
