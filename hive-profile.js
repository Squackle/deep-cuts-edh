export async function attachHiveRecords(root,handle){
 const panel=document.createElement('section');panel.className='cm-paper';
 const heading=document.createElement('h3');heading.textContent='HIVE RUN · VERIFIED RECORDS';panel.append(heading);root.append(panel);
 try{
  const response=await fetch('/api/hive-profile?handle='+encodeURIComponent(handle),{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw Error('unavailable');const data=await response.json();
  for(const record of data.records){const p=document.createElement('p');p.textContent=(record.mode==='classic'?'Brood Trail':'Predator Hunt')+' · '+String(record.rulesVersion||'legacy').replace('hive-','')+': '+Number(record.bestScore).toLocaleString()+' points · evolution '+record.bestEvolution+' · '+record.rankedRuns+' ranked runs';panel.append(p)}
  if(!data.records.length){const p=document.createElement('p');p.className='cm-note';p.textContent='No verified Hive Run scores yet. Open the game on this site after signing in and remembering your device; earlier guest scores remain unverified.';panel.append(p)}
  const a=document.createElement('a');a.href='/games/hive-run/';a.textContent='ENTER THE HIVE ↗';panel.append(a);
 }catch{panel.remove()}
}
