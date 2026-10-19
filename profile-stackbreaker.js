// My Profile-only authenticated Stackbreaker equipment. No Lab localStorage
// achievement or user-supplied badge claim can authorize a verified reward.
const root=document.getElementById('stackbreakerVerified');
if(root){
 const status=root.querySelector('[data-sb-status]');
 const list=root.querySelector('[data-sb-equipment]');
 const names={'daily-first':'Daily First Response','seven-dates':'Seven Daily Answers','monthly-rhythm':'Monthly Rhythm'};
 const rewards={'daily-first':{slot:'frame',rewardId:'gold'},'seven-dates':{slot:'vfx',rewardId:'prismatic'},'monthly-rhythm':{slot:'title',rewardId:'daily-adept'}};
 const show=text=>{status.textContent=text;};
 async function refresh(){
  show('Checking profile-owned Stackbreaker rewards…');
  let resp;
  try{resp=await fetch('/api/stackbreaker',{credentials:'same-origin',cache:'no-store'});}
  catch{show('Verified rewards are currently unavailable.');return;}
  if(resp.status===503){show('Verified profile rewards are not yet launched. Play Game Lab practice in the meantime.');return;}
  if(resp.status===401){show('Sign in to your Community profile to view verified rewards.');return;}
  if(!resp.ok){show('Stackbreaker rewards could not be loaded.');return;}
  let data;try{data=await resp.json()}catch{show('Invalid server response.');return;}
  if(!data.ok||!Array.isArray(data.awards))return;
  show('Verified Daily: '+(data.attempt?.status||'Not started')+' · '+data.awards.length+' profile-owned rewards');
  list.replaceChildren();
  for(const [id,spec] of Object.entries(rewards)){
   const owned=data.awards.includes(id);
   const div=document.createElement('div');div.className='cm-paper';
   const title=document.createElement('strong');title.textContent=names[id];
   const p=document.createElement('p');p.className='cm-note';
   p.textContent=owned?'Verified · '+spec.slot+' cosmetic':'Locked — complete verified qualifying daily attempts';
   const button=document.createElement('button');button.type='button';button.className='cm-btn cm-outline';
   button.textContent=(data.equipped?.[spec.slot]===spec.rewardId?'Equipped ✓':'Equip '+spec.slot);
   button.disabled=!owned||data.equipped?.[spec.slot]===spec.rewardId;
   button.addEventListener('click',async()=>{
    button.disabled=true;
    try{
     const res=await fetch('/api/stackbreaker',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'equip',slot:spec.slot,rewardId:spec.rewardId})});
     if(!res.ok)throw Error('Unable to equip');
     await refresh();
    }catch{show('Equipment update not confirmed.');button.disabled=false;}
   });
   div.append(title,p,button);list.append(div);
  }
 }
 refresh();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
