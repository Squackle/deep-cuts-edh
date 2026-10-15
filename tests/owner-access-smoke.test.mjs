import test from "node:test";
import assert from "node:assert/strict";

const origin="https://deep-cuts-edh.pages.dev";
async function anonymous(pathname,base=origin){
 const response=await fetch(base+pathname,{redirect:"manual",signal:AbortSignal.timeout(20000),headers:{"User-Agent":"DeepCutsEDH-Owner-Access-Smoke/1.0"}});
 return {status:response.status,location:response.headers.get("location")||"",contentType:response.headers.get("content-type")||""};
}
test("production public homepage stays anonymous",async()=>{
 const home=await anonymous("/");
 assert.equal(home.status,200,"Public homepage unexpectedly gated: "+JSON.stringify(home));
});
test("production owner console and private API requests cannot reach origin anonymously",async()=>{
 for(const path of ["/member-operations.html","/member-operations","/api/owner-members","/api/kofi-member-issue"]){
  const res=await anonymous(path);
  const hasAccessRedirect=/cloudflareaccess\.com|\/cdn-cgi\/access\//i.test(res.location);
  assert.ok([301,302,303,307,308,401,403].includes(res.status)&&hasAccessRedirect,
   "Owner path must be intercepted by Cloudflare Access before reaching origin: "+path+" "+JSON.stringify(res));
 }
});

test("immutable Cloudflare deployment alias also enforces Access for owner paths",async()=>{
 const alias="https://532c7468.deep-cuts-edh.pages.dev";
 const homepage=await anonymous("/",alias);
 assert.equal(homepage.status,200,"Deployment public homepage should remain accessible: "+JSON.stringify(homepage));
 for(const path of ["/member-operations.html","/api/owner-members"]){
  const res=await anonymous(path,alias);
  assert.ok([301,302,303,307,308,401,403].includes(res.status)&&/cloudflareaccess\\.com|\\/cdn-cgi\\/access\\//i.test(res.location),
   "Immutable deployment alias bypasses owner MFA: "+path+" "+JSON.stringify(res));
 }
});
