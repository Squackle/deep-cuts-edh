/* GET / — the homepage with the newest Weekly Rescue already in the HTML.
 * Without this, browsers first painted the static fallback (an older week)
 * and the client script swapped in the latest commander half a second later. */
import {applyLatestToHomeHtml} from '../src/home-weekly-ssr.js';
import {loadLatest} from '../src/weekly-rescue-archive.js';
import {WORKER_ORIGIN} from '../src/weekly-rescues-html.js';

// The homepage must never wait long on the report service.
const quickJson=async path=>{
 const r=await fetch(WORKER_ORIGIN+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(2500),cf:{cacheTtl:60,cacheEverything:true}});
 if(!r.ok)throw Error('Weekly report service unavailable ('+r.status+')');
 return r.json();
};

export async function onRequestGet(context){
 const response=await context.next();
 if(!response.ok||!/text\/html/i.test(response.headers.get('Content-Type')||''))return response;
 let latest=null;
 try{latest=await loadLatest(quickJson)}catch(error){console.error('Homepage weekly feature unavailable',String(error))}
 if(!latest)return response;
 const html=await response.text();
 const headers=new Headers(response.headers);
 headers.delete('Content-Length');headers.delete('ETag');
 headers.set('Cache-Control','public, max-age=0, must-revalidate');
 return new Response(applyLatestToHomeHtml(html,latest),{status:response.status,headers});
}
