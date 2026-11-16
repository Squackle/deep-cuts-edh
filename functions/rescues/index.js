import {remoteJson,listHtml,staticArchiveHtml,htmlResponse} from '../../src/weekly-rescues-html.js';

// /rescues has a published static asset AND a Pages Function; Functions win at
// routing. Read that asset through the Pages ASSETS binding so on-page budget
// strategy, canonical metadata and internal links remain identical in SSR.
export async function onRequestGet({request,env}){
 let staticHtml;
 try{
  const asset=await env.ASSETS.fetch(new Request(new URL('/rescues',request.url)));
  if(!asset.ok)throw Error('Canonical Rescue Report asset unavailable ('+asset.status+')');
  staticHtml=await asset.text();
 }catch(error){
  console.error('Rescue index static asset unavailable',String(error));
  return htmlResponse(listHtml([]),503);
 }
 try{
  const data=await remoteJson('/v1/index');
  return htmlResponse(staticArchiveHtml(staticHtml,data.reports));
 }catch(error){
  console.error('Rescue index upstream unavailable',String(error));
  return htmlResponse(staticArchiveHtml(staticHtml,[],{unavailable:true}));
 }
}
