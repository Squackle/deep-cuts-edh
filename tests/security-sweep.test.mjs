import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {auditSources,markdownReport,isAccessRedirect,walk,inventorySources,shouldFailSweep} from "../scripts/security-sweep.mjs";
const guarded={
 "functions/api/owner-ops.js":"import {ownerAuth} from '../src/owner-access.js'; export async function onRequestPost() { await ownerAuth(); }",
 "functions/api/owner-members.js":"await ownerAuth(request,env)",
 "functions/api/ad-entitlement.js":"await ownerAuth(request,env)",
 "functions/api/field-expansion.js":"await ownerAuth(request,env)",
 "functions/api/kofi-member-issue.js":"member_issuer_credentials",
 "src/owner-access.js":"export async function ownerAuth(){}",
 "functions/api/nominations.js":"TURNSTILE_SECRET owner_feature_flags",
 "functions/api/feedback.js":"TURNSTILE_SECRET owner_feature_flags",
 "_headers":"/member-operations.html\n  Cache-Control: no-store",
 ".github/workflows/release-coordination.yml":"name: Release coordination",
 "owner-dashboard.js":"ownerLock"
};
const audit=files=>auditSources(Object.keys(files),k=>files[k]);
test("owner authorization guard regression becomes a confirmed critical failure",()=>{
 const x={...guarded,"functions/api/owner-ops.js":"export async function onRequestPost() { return new Response('ok'); }"};
 const r=audit(x);
 assert.ok(r.findings.some(f=>f.where==="functions/api/owner-ops.js"&&f.status==="confirmed"&&f.severity==="critical"));
 const normal=audit(guarded);
 assert.equal(normal.findings.some(f=>f.status==="confirmed"&&f.severity==="critical"),false);
});
test("dynamic execution and unsafe HTML sinks get flagged for review",()=>{
 const x={...guarded,"src/example.js":"const bad = eval(input); node.innerHTML = userInput;"};
 const r=audit(x);
 assert.ok(r.findings.some(f=>f.category==="backdoor/code injection"&&f.where==="src/example.js"));
 assert.ok(r.findings.some(f=>f.category==="XSS surface"));
});
test("token-like source strings are flagged without leaking their values into reports",()=>{
 const secret="ghp_"+"Z".repeat(36);
 const x={...guarded,"src/test.js":'const token = "'+secret+'";'};
 const r=audit(x);
 assert.ok(r.findings.some(f=>f.category==="secret exposure"));
 const md=markdownReport({createdAt:"2026-10-15T00:00:00Z",revision:"test",inventory:r.inventory,live:[],findings:r.findings});
 assert.ok(!md.includes(secret));
});
test("missing Cloudflare coverage is described as requiring manual verification",()=>{
 const r=audit(guarded);
 assert.ok(r.findings.some(f=>f.category==="Cloudflare Access"&&f.status==="manual-review"));
 assert.ok(r.findings.some(f=>f.category==="identity & payments"&&f.status==="not-tested"));
});
test("owner key browser persistence gets elevated for inspection",()=>{
 const x={...guarded,"owner-v2.js":'sessionStorage.setItem("ownerKey", key)'};
 const r=audit(x);
 assert.ok(r.findings.some(f=>f.category==="credential handling"&&f.severity==="high"));
});

test("Cloudflare Access redirects require a trusted host boundary, not a URL substring",()=>{
 const origin="https://deep-cuts-edh.pages.dev/api/owner-ops";
 assert.equal(isAccessRedirect("https://muddy-field-8281.cloudflareaccess.com/cdn-cgi/access/login/",origin),true);
 assert.equal(isAccessRedirect("/cdn-cgi/access/login",origin),true);
 assert.equal(isAccessRedirect("https://muddy-field-8281.cloudflareaccess.com.attacker.example/",origin),false);
 assert.equal(isAccessRedirect("https://untrusted.example/path/cloudflareaccess.com",origin),false);
 assert.equal(isAccessRedirect("/login?dest=cloudflareaccess.com",origin),false);
 assert.equal(isAccessRedirect("http://muddy-field-8281.cloudflareaccess.com/",origin),false);
 assert.equal(isAccessRedirect("javascript:alert(1)",origin),false);
});


test("scanner inventories extensionless Pages configuration",()=>{
 const root=mkdtempSync(join(tmpdir(),"dc-security-"));
 try {
  for(const file of ["_headers","_redirects","_routes.json","sample.js","image.png"])writeFileSync(join(root,file),"fixture");
  assert.deepEqual(walk(root).sort(),["_headers","_redirects","_routes.json","sample.js"].sort());
 } finally {rmSync(root,{recursive:true,force:true});}
});
test("a public outage or failed Access check fails the sweep, not just its report",()=>{
 assert.equal(shouldFailSweep([],[{pass:false,check:"public GET"}]),true);
 assert.equal(shouldFailSweep([],[{pass:false,check:"Access interception"}]),true);
 assert.equal(shouldFailSweep([{status:"confirmed",severity:"critical"}],[]),true);
 assert.equal(shouldFailSweep([{status:"potential",severity:"high"}],[{pass:true,check:"public GET"}]),false);
});

test("bounded inventory reports every omission and respects the exact count limit",()=>{
 const root=mkdtempSync(join(tmpdir(),"dc-security-coverage-"));
 try{
  for(const file of ["a.js","b.js","c.js"])writeFileSync(join(root,file),"small");
  writeFileSync(join(root,"large.js"),"x".repeat(21));
  const exact=inventorySources(root,{maxFiles:3,maxBytes:20});
  assert.deepEqual(exact.paths,["a.js","b.js","c.js"]);
  assert.deepEqual(exact.coverage,{oversized:1,oversizedSample:["large.js"],limitOmitted:0});
  const capped=inventorySources(root,{maxFiles:2,maxBytes:20});
  assert.deepEqual(capped.paths,["a.js","b.js"]);
  assert.equal(capped.coverage.limitOmitted,1);
  assert.equal(capped.coverage.oversized,1);
  const report=markdownReport({createdAt:"test",revision:"test",inventory:{sources:2,api:0,workflows:0,coverage:capped.coverage},live:[],findings:[]});
  assert.match(report,/Eligible files omitted by count limit: 1/);
  assert.match(report,/Source candidates excluded by size limit: 1/);
  assert.match(report,/large\.js/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test("missing expected privileged route is a coverage failure, not a clean audit or confirmed exploit",()=>{
 const fixture={...guarded};
 delete fixture["functions/api/owner-ops.js"];
 const result=audit(fixture);
 assert.ok(result.findings.some(f=>f.where==="functions/api/owner-ops.js"&&f.status==="incomplete"));
 assert.equal(shouldFailSweep(result.findings,[]),true);
 assert.equal(shouldFailSweep([{severity:"medium",status:"incomplete",category:"scan coverage"}],[]),true);
 assert.equal(shouldFailSweep([{severity:"info",status:"not-tested"}],[]),false);
});
