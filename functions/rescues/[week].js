import {reportHtml,htmlResponse} from '../../src/weekly-rescues-html.js';
import {loadReport} from '../../src/weekly-rescue-archive.js';
export async function onRequestGet({params}){
 const date=String(params.week||'');
 if(!/^20\d\d-\d\d-\d\d$/.test(date))return htmlResponse('<h1>Not found</h1>',404);
 try{
  const report=await loadReport(date);
  if(!report)return htmlResponse('<h1>Rescue Report not found</h1><p><a href="/rescues">Back to weekly archive</a></p>',404);
  return htmlResponse(reportHtml(report));
 }catch(error){console.error('Weekly Rescue read failed',String(error));return htmlResponse('<h1>Rescue Report unavailable</h1><p><a href="/rescues">Back to weekly archive</a></p>',503)}
}
