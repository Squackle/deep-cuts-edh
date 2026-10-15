import test from "node:test";
import assert from "node:assert/strict";

const origin="https://deep-cuts-edh.pages.dev";
async function anonymous(pathname){
 const response=await fetch(origin+pathname,{redirect:"manual",signal:AbortSignal.timeout(20000),headers:{"User-Agent":"DeepCutsEDH-Owner-Access-Smoke/1.0"}});
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
