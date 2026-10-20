/* Cloudflare Pages middleware. Keep the exact Google AdSense tag in public
 * HTML for Google's crawler/review, but remove it server-side for any
 * authenticated member whose verified email matches an active Ko-fi payment.
 * This avoids client-side flashes, network fetches and tracking for members.
 */
import {checkAdFree} from "../src/kofi-adfree.js";
const AD_TAG='<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1885127351876276" crossorigin="anonymous"></script>';
const AD_PAGES=new Set([
 "/", "/index.html", "/library", "/library.html",
 "/reports/chainer-dementia-master", "/reports/chainer-dementia-master.html",
 "/reports/alena-and-gilanra", "/reports/alena-and-gilanra.html",
 "/reports/commander-mustard", "/reports/commander-mustard.html",
 "/reports/ekthi-contaminator-priest", "/reports/ekthi-contaminator-priest.html"
]);
const PUBLIC_BADGE='<link rel="stylesheet" href="/site-presence.css"><script defer src="/site-presence.js"></script>';
const HOME_BADGE='<script defer src="/site-presence.js"></script>';
function isPublicHTMLPath(path){
 if(path.startsWith("/api/")||path.startsWith("/games/hive-run/api/")||path.startsWith("/member-operations")||
    path.startsWith("/diagnostics")||path.startsWith("/google"))return false;
 if(path.includes("/."))return false;
 const tail=path.split("/").pop()||"";
 return !tail.includes(".")||tail.endsWith(".html");
}
function decorate(response,path,method){
 if(method!=="GET"||!isPublicHTMLPath(path)||!response.ok||!/text\/html/i.test(response.headers.get("Content-Type")||""))return response;
 // Cloudflare provides HTMLRewriter globally; Node test harnesses may not.
 if(typeof HTMLRewriter==="undefined")return response;
 // Homepage already includes site-presence.css in home-styles.css; append
 // only the presence script there, and keep the previous badge elsewhere.
 const badge=path==="/"||path==="/index.html"?HOME_BADGE:PUBLIC_BADGE;
 return new HTMLRewriter().on("head",{element(element){element.append(badge,{html:true})}}).transform(response);
}
export async function onRequest(context){
 const request=context.request;
 const url=new URL(request.url);
 // The root middleware also runs in front of static assets. A Pages _redirects
 // rule may not execute on Function-served requests, so enforce this here too.
 if((request.method==="GET"||request.method==="HEAD")&&url.pathname==="/games/index.html")
  return Response.redirect(new URL("/games",url),301);
 if(request.method!=="GET"||!AD_PAGES.has(url.pathname))return decorate(await context.next(),url.pathname,request.method);
 const cookie=request.headers.get("Cookie")||"";
 if(!/(?:^|;\s*)__Host-dc_device=dcdevice1_[0-9a-f]{64}(?:;|$)/.test(cookie))return decorate(await context.next(),url.pathname,request.method);
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
 if(!adFree)return decorate(await context.next(),url.pathname,request.method);
 const res=await context.next();
 if(!res.ok||!String(res.headers.get("Content-Type")||"").toLowerCase().includes("text/html"))return decorate(res,url.pathname,request.method);
 const html=await res.text();
 // Only the exact publisher script supplied by the owner can be removed.
 const safe=html.replace(AD_TAG,"");
 const headers=new Headers(res.headers);
 headers.delete("Content-Length");
 headers.delete("ETag");
 headers.set("Cache-Control","private, no-store, max-age=0");
 headers.set("Vary","Cookie");
 headers.set("X-DeepCuts-Ad-Free","member");
 return decorate(new Response(safe,{status:res.status,statusText:res.statusText,headers}),url.pathname,request.method);
}
