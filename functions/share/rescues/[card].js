/* GET /share/rescues/<YYYY-MM-DD>.svg — branded social card for a PUBLISHED
 * Weekly Rescue Report. Reads the same public report API as /rescues/<date>;
 * an unknown or unpublished date returns 404, so no card can be forged. */
import {remoteJson} from '../../../src/weekly-rescues-html.js';
import {rescueCardModel,cardSvg,svgResponse} from '../../../src/share-card.js';
const notFound=()=>new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}});
export async function onRequestGet({params}){
 const match=/^(20\d\d-\d\d-\d\d)\.svg$/.exec(String(params.card||''));
 if(!match)return notFound();
 let data;
 try{data=await remoteJson('/v1/report?date='+encodeURIComponent(match[1]))}
 catch(error){console.error('Share card report read failed',String(error));return new Response('Card temporarily unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Retry-After':'300'}})}
 if(!data?.report||data.report.date!==match[1])return notFound();
 try{return svgResponse(cardSvg(rescueCardModel(data.report)))}
 catch{return notFound()}
}
