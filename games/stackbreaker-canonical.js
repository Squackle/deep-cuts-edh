// Canonical daily front end deliberately embeds the original Game Lab game.
// This module only presents authenticated server-replayed rankings.
// It never trusts localStorage, screenshots, query parameters, or Lab messages
// as proof of a win. Once-per-day scored moves require a separately audited
// same-origin relay before verified mode may be enabled.
const frame=document.getElementById('stackbreakerOriginal');
const status=document.getElementById('rankedStatus');
const list=document.getElementById('rankings');
const loaded=document.getElementById('frameStatus');
let active=false;
function info(message){status.textContent=message;}
frame.addEventListener('load',()=>{loaded.textContent='Original Game Lab Stackbreaker loaded. Its local Daily option remains unverified until ranked integration is enabled.';});
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
board();
