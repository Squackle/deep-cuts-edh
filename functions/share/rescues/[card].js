/* GET /share/rescues/<YYYY-MM-DD>.svg|.png — branded social card for a
 * PUBLISHED Weekly Rescue Report. Reads the same public report API as
 * /rescues/<date>; an unknown or unpublished date returns 404, so no card can
 * be forged. The PNG (used for og:image) is rendered server-side from the SVG
 * and cached at the edge. The commander's card image is fetched server-side
 * from Scryfall's CDN (verified URL only) and embedded as a data URI. */
import {commanderArt} from '../../../src/weekly-rescues-html.js';
import {loadReport} from '../../../src/weekly-rescue-archive.js';
import {rescueCardModel,cardSvg,fetchCardArt,svgResponse,pngResponse,CARD_VERSION} from '../../../src/share-card.js';
const text=(body,status,extra={})=>new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff',...extra}});
const notFound=()=>text('Not found',404);

async function renderPng(svg,env,request){
 // Loaded lazily so the SVG path never pays for WebAssembly start-up.
 const {renderCardPng}=await import('../../../src/share-card-png-worker.js');
 const loadFont=async path=>{
  const res=await env.ASSETS.fetch(new Request(new URL(path,request.url)));
  if(!res.ok)throw Error('Font unavailable '+res.status);
  return res.arrayBuffer();
 };
 return renderCardPng(svg,loadFont);
}

export async function onRequestGet({request,env,params,waitUntil}){
 const match=/^(20\d\d-\d\d-\d\d)\.(svg|png)$/.exec(String(params.card||''));
 if(!match)return notFound();
 const [,date,format]=match;
 const cache=typeof caches!=='undefined'?caches.default:null;
 const cacheKey=cache?new Request(new URL(`/share/rescues/${date}.${format}?v=${CARD_VERSION}`,request.url)):null;
 if(cache){try{const hit=await cache.match(cacheKey);if(hit)return hit}catch{}}
 let report;
 try{report=await loadReport(date)}
 catch(error){
  console.error('Share card report read failed',String(error));return text('Card temporarily unavailable',503,{'Retry-After':'300'})
 }
 if(!report||report.date!==date)return notFound();
 let model;
 try{model=rescueCardModel(report)}catch{return notFound()}
 // commanderArt() only returns Scryfall CDN card URLs (safeCardImage).
 const art=await fetchCardArt(commanderArt(report));
 const svg=cardSvg(model,{art});
 const store=response=>{
  // Cards without art (Scryfall hiccup) are not cached, so they self-heal.
  if(cache&&art){const put=cache.put(cacheKey,response.clone()).catch(()=>{});waitUntil?waitUntil(put):put}
  return response;
 };
 if(format==='svg')return store(svgResponse(svg));
 try{
  return store(pngResponse(await renderPng(svg,env,request)));
 }catch(error){
  console.error('Share card PNG render failed',String(error));
  return text('Card image temporarily unavailable',503,{'Retry-After':'300'});
 }
}
