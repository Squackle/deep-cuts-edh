/* One archive for every Weekly Rescue Report: Worker KV reports merged with the
 * reviewed editions kept in this repository (src/weekly-rescue-editions.js).
 * A repository edition replaces a Worker report with the same date; dates the
 * Worker missed are added. If the Worker is unreachable, repository editions are
 * still listed, so the archive never goes empty. */
import {EDITORIAL_EDITIONS} from './weekly-rescue-editions.js';
import {remoteJson} from './weekly-rescues-html.js';

const DATE=/^20\d\d-\d\d-\d\d$/;
const editions=new Map(EDITORIAL_EDITIONS.map(x=>[x.date,x]));

export const indexRow=item=>({date:item.date,commander:item.commander.name,theme:item.theme,headline:item.sections?.headline||'',imageUrl:item.commander.imageUrl||null});

// Merge Worker index rows with repository editions, newest first, one per date.
export function mergeIndex(workerRows,local=EDITORIAL_EDITIONS){
 const byDate=new Map();
 for(const row of Array.isArray(workerRows)?workerRows:[])
  if(row&&typeof row.date==='string'&&DATE.test(row.date)&&!byDate.has(row.date))byDate.set(row.date,row);
 for(const item of local)byDate.set(item.date,indexRow(item));
 return [...byDate.values()].sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
}

export function editionFor(date){return editions.get(date)||null}

// Returns {reports, unavailable}. unavailable=true means the Worker index could
// not be read and only repository editions are listed.
export async function loadArchive(fetchJson=remoteJson){
 try{
  const data=await fetchJson('/v1/index');
  return {reports:mergeIndex(data?.reports),unavailable:false};
 }catch(error){
  console.error('Weekly Rescue index upstream unavailable',String(error));
  return {reports:mergeIndex([]),unavailable:true};
 }
}

// Returns the report for a date, or null when it does not exist.
// Throws only when the Worker failed AND no repository edition exists.
export async function loadReport(date,fetchJson=remoteJson){
 if(!DATE.test(String(date||'')))return null;
 const local=editionFor(date);
 if(local)return local;
 try{
  const data=await fetchJson('/v1/report?date='+encodeURIComponent(date));
  return data?.report&&data.report.date===date?data.report:null;
 }catch(error){
  if(/\(404\)/.test(String(error?.message)))return null;
  throw error;
 }
}

export async function loadLatest(fetchJson=remoteJson){
 const {reports}=await loadArchive(fetchJson);
 return reports[0]||null;
}
