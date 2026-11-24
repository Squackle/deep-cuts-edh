// Editorial-only review tool. No production requests, writes, publication,
// checkout approval or changes to the original deck draft data.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const basics=new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes','Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);
const key=s=>String(s).trim().toLowerCase();
const cents=s=>typeof s==='string'&&/^\d+(?:\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):null;
export function budgetDrafts(doc){
 if(doc?.schemaVersion!==1||!doc.cases)throw Error('Invalid premade deck data');
 return Object.entries(doc.cases).filter(([,v])=>!v.preview&&v.tiers?.budget).map(([slug,v])=>{
  const sections=v.tiers.budget.sections,rows=[],seen=new Set();
  if(!Array.isArray(sections))throw Error(slug+': missing sections');
  for(const section of sections)for(const line of section.cards){
   const match=/^(\d{1,3}) (\S.*?)$/.exec(line);
   if(!match)throw Error(slug+': invalid card line');
   const qty=Number(match[1]),name=match[2];
   if(qty<1||qty>100||seen.has(key(name))||(!basics.has(name)&&qty!==1))throw Error(slug+': invalid quantity or duplicate '+name);
   seen.add(key(name));rows.push({role:section.role,name,qty});
  }
  const commanders=rows.filter(x=>x.role==='Commander');
  if(rows.reduce((n,x)=>n+x.qty,0)!==100||![1,2].includes(commanders.length)||commanders.some(c=>c.qty!==1))throw Error(slug+': incomplete list');
  return {slug,rows,commanders:commanders.map(x=>x.name)};
 });
}
export function reviewDraft(draft,cards){
 const lookup=new Map(cards.map(c=>[key(c.name),c]));
 const commanderCards=draft.commanders.map(n=>lookup.get(key(n)));
 const issues=[];
 if(commanderCards.some(c=>!c||!Array.isArray(c.color_identity)))issues.push('Commander identity unavailable');
 const colors=new Set(commanderCards.flatMap(c=>c?.color_identity||[]));
 if(commanderCards.some(c=>c&&!/Legendary Creature/.test(c.type_line||'')&&!/can be your commander/i.test(c.oracle_text||'')))issues.push('Commander eligibility requires manual review');
 if(draft.commanders.length===2&&!commanderCards.every(c=>c&&/^Partner(?:\s|$)/m.test(c.oracle_text||'')))issues.push('Partner eligibility requires manual review');
 let knownCents=0,unknownCopies=0;
 const rows=draft.rows.map(row=>{
  const card=lookup.get(key(row.name));
  const problems=[];
  if(!card)problems.push('missing record');
  else{
   if(card.legalities?.commander!=='legal')problems.push('Commander legality not legal');
   if(!card.games?.includes('paper'))problems.push('not a paper printing');
   if(!Array.isArray(card.color_identity)||card.color_identity.some(x=>!colors.has(x)))problems.push('color identity not confirmed');
   if(row.qty>1&&!/\bBasic Land\b/.test(card.type_line||''))problems.push('repeated nonbasic');
  }
  const price=card?.finishes?.includes('nonfoil')&&card.games?.includes('paper')?cents(card.prices?.usd):null;
  if(price===null)unknownCopies+=row.qty;else knownCents+=price*row.qty;
  for(const problem of problems)issues.push(row.name+': '+problem);
  return {...row,printing:card?{id:card.id,set:card.set,collectorNumber:card.collector_number,url:card.scryfall_uri}:null,unitCents:price,subtotalCents:price===null?null:price*row.qty,problems};
 });
 return {slug:draft.slug,count:rows.reduce((n,x)=>n+x.qty,0),colors:[...colors].sort(),rows,knownCents,unknownCopies,totalCents:unknownCopies?null:knownCents,cardDataChecksPassed:issues.length===0,issues};
}
// Explicit network action only when invoked as a CLI; the offline tests never
// call Scryfall. Use default returned printing, NOT a cheapest-printing claim.
export async function collectCardRecords(names,{fetchImpl=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const unique=[...new Map(names.map(n=>[key(n),n])).values()],records=[];
 for(let i=0;i<unique.length;i+=75){
  if(i)await wait(650);
  const response=await fetchImpl('https://api.scryfall.com/cards/collection',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'DeepCutsEDH-EditorialReview/1.0 (+https://deep-cuts-edh.pages.dev/)'},signal:AbortSignal.timeout(20000),body:JSON.stringify({identifiers:unique.slice(i,i+75).map(name=>({name}))})});
  if(!response.ok)throw Error('Scryfall collection request failed: '+response.status);
  const data=await response.json();
  if(!Array.isArray(data?.data))throw Error('Malformed collection response');
  records.push(...data.data);
 }
 return records;
}
async function main(){
 const drafts=budgetDrafts(JSON.parse(await readFile(new URL('../reports/premade-decks.json',import.meta.url),'utf8')));
 if(!process.argv.includes('--fetch')){
  console.log(JSON.stringify({status:'structure-only',decks:drafts.map(d=>({slug:d.slug,count:d.rows.reduce((n,x)=>n+x.qty,0),distinct:d.rows.length,commanders:d.commanders}))},null,2));return;
 }
 const records=await collectCardRecords(drafts.flatMap(d=>d.rows.map(r=>r.name)));
 const decks=drafts.map(d=>reviewDraft(d,records));
 console.log(JSON.stringify({retrievedAt:new Date().toISOString(),source:'Scryfall collection API; returned nonfoil paper printings, USD; basics included; excludes taxes/shipping; not lowest price or a purchase quote',decks},null,2));
 if(decks.some(d=>!d.cardDataChecksPassed||d.unknownCopies))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
