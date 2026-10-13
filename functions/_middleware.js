/* Cloudflare Pages middleware. Keep the exact Google AdSense tag in public
 * HTML for Google's crawler/review, but remove it server-side for any
 * authenticated member whose verified email matches an active Ko-fi payment.
 * This avoids client-side flashes, network fetches and tracking for members.
 */
import {checkAdFree} from "../src/kofi-adfree.js";
const AD_TAG='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1885127351876276" crossorigin="anonymous"></script>';
const AD_PAGES=new Set([
 "/", "/index.html", "/library.html",
 "/reports/chainer-dementia-master.html",
 "/reports/alena-and-gilanra.html",
 "/reports/commander-mustard.html",
 "/reports/ekthi-contaminator-priest.html"
]);
export async function onRequest(context){
 const request=context.request;
 const url=new URL(request.url);
 if(request.method!=="GET"||!AD_PAGES.has(url.pathname))return context.next();
 const cookie=request.headers.get("Cookie")||"";
 if(!/(?:^|;\s*)__Host-dc_device=dcdevice1_[0-9a-f]{64}(?:;|$)/.test(cookie))return context.next();
 let adFree=false;
 try{
  const status=await checkAdFree(request,context.env);
  adFree=status.adFree;
 }catch(error){
  // If member status cannot be checked, protect signed-in members' ad-free
  // experience until service recovers. This does not grant paid permissions.
  console.warn("Advertising membership verification temporarily unavailable",String(error?.name||"error"));
  adFree=true;
 }
 if(!adFree)return context.next();
 const res=await context.next();
 if(!res.ok||!String(res.headers.get("Content-Type")||"").toLowerCase().includes("text/html"))return res;
 const html=await res.text();
 // Only the exact publisher script supplied by the owner can be removed.
 const safe=html.replace(AD_TAG,"");
 const headers=new Headers(res.headers);
 headers.delete("Content-Length");
 headers.delete("ETag");
 headers.set("Cache-Control","private, no-store, max-age=0");
 headers.set("Vary","Cookie");
 headers.set("X-DeepCuts-Ad-Free","member");
 return new Response(safe,{status:res.status,statusText:res.statusText,headers});
}
