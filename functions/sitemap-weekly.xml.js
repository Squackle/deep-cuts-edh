// Public dated-report discovery. Separate from the static site sitemap so
// weekly publication never requires a manual sitemap edit or fake lastmod.
import {loadArchive} from '../src/weekly-rescue-archive.js';
import {remoteJson} from '../src/weekly-rescues-html.js';
const ORIGIN='https://deep-cuts-edh.pages.dev';
const isDate=value=>typeof value==='string'&&/^20\d\d-\d\d-\d\d$/.test(value)&&
 Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function weeklySitemap(reports){
 const dates=[...new Set(reports.filter(row=>row&&isDate(row.date)&&
  typeof row.commander==='string'&&row.commander.trim()&&typeof row.theme==='string'&&row.theme.trim()).map(row=>row.date))].sort();
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  dates.map(date=>'  <url><loc>'+ORIGIN+'/rescues/'+date+'</loc></url>').join('\n')+'\n</urlset>\n';
}
export async function serveWeeklySitemap(fetchJson=remoteJson,{head=false}={}){
 // A partial archive is useful to visitors, but a partial successful sitemap
 // during an outage would misleadingly drop published remote-only reports.
 const {reports,unavailable}=await loadArchive(async path=>{
  const data=await fetchJson(path);
  if(!Array.isArray(data?.reports))throw Error('Invalid archive index');
  return data;
 });
 if(unavailable)return new Response(head?null:'Weekly report sitemap temporarily unavailable.',{status:503,headers:{
  'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Retry-After':'300','X-Content-Type-Options':'nosniff'
 }});
 return new Response(head?null:weeklySitemap(reports),{headers:{
  'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=300, s-maxage=300','X-Content-Type-Options':'nosniff'
 }});
}
export const onRequestGet=()=>serveWeeklySitemap();
export const onRequestHead=()=>serveWeeklySitemap(remoteJson,{head:true});
