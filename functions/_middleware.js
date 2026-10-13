/* Sitewide defense-in-depth for both Cloudflare Pages static assets and Functions. */
const csp="base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
export async function onRequest(context){
 const path=new URL(context.request.url).pathname;
 if(context.request.method==="POST"&&path.startsWith("/api/")&&path!=="/api/kofi-webhook"){
  if(context.request.headers.get("Sec-Fetch-Site")==="cross-site"){
   return new Response(JSON.stringify({error:"Cross-site API requests are not accepted."}),{status:403,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
 }
 const response=await context.next();
 const headers=new Headers(response.headers);
 headers.set("X-Content-Type-Options","nosniff");
 headers.set("X-Frame-Options","DENY");
 headers.set("Referrer-Policy","no-referrer");
 headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=()");
 headers.set("Content-Security-Policy",csp);
 headers.set("Strict-Transport-Security","max-age=31536000");
 if(path.startsWith("/api/")&&path!=="/api/supporter-gallery"||
    path==="/diagnostics.html"||path==="/diagnostics.js"||path==="/members.html"||path==="/member-operations.html"||path==="/member-operations.js")
  headers.set("Cache-Control","no-store, private");
 if(path==="/diagnostics.html"||path==="/diagnostics.js"||path==="/members.html"||path==="/member-operations.html"||path==="/member-operations.js"||path==="/api/kofi-diagnostics"||path==="/api/kofi-member-issue")
  headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
