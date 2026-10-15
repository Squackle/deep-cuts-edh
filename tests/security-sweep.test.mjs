import test from "node:test";
import assert from "node:assert/strict";
import {auditSources,markdownReport} from "../scripts/security-sweep.mjs";
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
