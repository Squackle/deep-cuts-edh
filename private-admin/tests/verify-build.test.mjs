import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=loc=>fs.readFile(path.join(root,loc),"utf8");
const list=loc=>fs.readdir(path.join(root,loc));
test("private Pages root contains only six explicit HTTP route handlers",async()=>{
 const actual=(await list("functions/api")).sort();
 assert.deepEqual(actual,["ad-entitlement.js","field-expansion.js","kofi-diagnostics.js",
  "kofi-member-issue.js","owner-members.js","owner-ops.js"].sort());
 for(const disallowed of ["account.js","member.js","kofi-webhook.js","stripe-webhook.js",
   "community.js","security-staging-harness.js","site-presence.js","profile-recovery.js"]){
  assert.ok(!actual.includes(disallowed),"Disallowed HTTP entry: "+disallowed);
 }
 const routes=JSON.parse(await read("public/_routes.json"));
 assert.deepEqual(routes,{version:1,include:["/*"],exclude:[]});
});
test("private pages and scripts are intentionally narrow",async()=>{
 const assets=(await list("public")).sort();
 for(const missing of ["members.html","supporters.html","index.js","security-staging-acceptance.html"]){
  assert.ok(!assets.includes(missing),"Public-site asset must not be published: "+missing);
 }
 const start=await read("public/index.html");
 assert.match(start,/member-operations\.html/);
 assert.match(start,/diagnostics\.html/);
 const owner=await read("public/member-operations.html");
 assert.match(owner,/ownerUnlock|owner-dashboard\.js/);
 assert.match(owner,/owner-console\.js/);
 assert.match(owner,/https:\/\/deep-cuts-edh\.pages\.dev\/members\.html/);
 assert.doesNotMatch(owner,/dcissuer1_[a-f0-9]{64}/);
 const diag=await read("public/diagnostics.html");
 assert.doesNotMatch(diag,/header-profile\.js/);
 const serverPaths=(await list("src")).sort();
 assert.ok(serverPaths.includes("owner-access.js"));
 assert.ok(serverPaths.includes("owner-presence.js"));
 assert.ok(serverPaths.includes("owner-field-expansion.js"));
 const routesText=await read("functions/api/field-expansion.js");
 assert.match(routesText,/data?.action|"feature_evidence"/);
 assert.match(routesText,/ownerAuth/);
});
test("fail closed until Access, hostname and deployment mode are verified",async()=>{
 const module=await import(pathToFileURL(path.join(root,"functions/_middleware.js")).href);
 const host="https://deepcuts-edh-security-staging.pages.dev/";
 const preview="https://security-isolated-test-lane-20261020.deepcuts-edh-security-staging.pages.dev/";
 const jwt="synthetic-untrusted-header";
 async function invoke(url,env,header){
  return module.onRequest({request:new Request(url,{headers:header?{"Cf-Access-Jwt-Assertion":jwt}:{}}),
   env,next:()=>new Response("authorized",{status:200})});
 }
 assert.equal((await invoke(host,{},true)).status,503);
 assert.equal((await invoke(host,{PRIVATE_ADMIN_ENABLED:"true",PRIVATE_ADMIN_MODE:"live"},false)).status,403);
 assert.equal((await invoke(host,{PRIVATE_ADMIN_ENABLED:"true",PRIVATE_ADMIN_MODE:"synthetic"},true)).status,404);
 assert.equal((await invoke(preview,{PRIVATE_ADMIN_ENABLED:"true",PRIVATE_ADMIN_MODE:"live"},true)).status,404);
 assert.equal((await invoke("https://deep-cuts-edh.pages.dev/",{PRIVATE_ADMIN_ENABLED:"true",PRIVATE_ADMIN_MODE:"live"},true)).status,404);
 assert.equal((await invoke(host,{PRIVATE_ADMIN_ENABLED:"true",PRIVATE_ADMIN_MODE:"live"},true)).status,200);
 assert.equal((await invoke(preview,{PRIVATE_ADMIN_ENABLED:"true",PRIVATE_ADMIN_MODE:"synthetic"},true)).status,200);
});
test("server modules do not contain full owner keys or live D1 bindings",async()=>{
 const names=["functions/api/owner-ops.js","functions/api/owner-members.js",
 "functions/api/kofi-member-issue.js","src/owner-access.js"];
 for(const name of names){
  const text=await read(name);
  assert.doesNotMatch(text,/dcissuer1_[a-f0-9]{64}/);
  assert.doesNotMatch(text,/d89f64c390644385ea9db0ce2f4f17a0/);
 }
});
