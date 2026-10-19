import {renderRescueReportFeed} from '../src/rescue-report-feed.js';
// No subscriber database, signup, cron, or email is invoked by this public feed.
export async function onRequestGet({request,env}) {
 try {
  const res=await env.ASSETS.fetch(new Request(new URL('/index.html',request.url)));
  if (!res.ok) throw new Error('Public homepage asset unavailable');
  return new Response(renderRescueReportFeed(await res.text()), {
   status:200, headers:{
    'Content-Type':'application/rss+xml; charset=utf-8',
    'Cache-Control':'public, max-age=1800',
    'X-Content-Type-Options':'nosniff'
   }
  });
 } catch (error) {
  console.warn('Published Rescue Report RSS unavailable',String(error?.message||'error'));
  return new Response('Published report feed temporarily unavailable',{
   status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}
  });
 }
}
