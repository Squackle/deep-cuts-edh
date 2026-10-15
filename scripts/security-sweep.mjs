#!/usr/bin/env node
// Safe, on-demand security sweep. No private keys, data mutations, aggressive probes, or secrets in reports.
// Human-assisted audit remains necessary for MFA owner success paths and account-to-account access tests.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT=path.resolve(here,"..");
const EXCLUDE=new Set([".git","node_modules","security-report-output","dist","build","coverage",".wrangler"]);
const SOURCE=/\.(?:js|mjs|cjs|ts|jsx|tsx|html|yml|yaml|json|env|sh)$/i;
const CRAWL_LIMIT=3000, FILE_LIMIT=1_000_000;
const redact=s=>String(s??"").replace(/(Bearer\s+)[\w-]{20,}/gi,"$1[REDACTED]").slice(0,400);
export function walk(root,dir=root,list=[]){
 if(list.length>CRAWL_LIMIT)return list;
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(EXCLUDE.has(item.name))continue;
  const full=path.join(dir,item.name);
  if(item.isDirectory())walk(root,full,list);
  else if(item.isFile()&&(SOURCE.test(item.name)||item.name===".env"||item.name.startsWith(".env."))&&fs.statSync(full).size<=FILE_LIMIT)list.push(path.relative(root,full).replaceAll("\\","/"));
 }
 return list;
}
export function auditSources(files,read){
 const findings=[],inventory={sources:files.length,api:files.filter(p=>p.startsWith("functions/api/")).length,workflows:files.filter(p=>p.startsWith(".github/workflows/")).length};
 const add=(severity,status,category,where,summary,remediation)=>findings.push({severity,status,category,where,summary,remediation});
 const get=p=>files.includes(p)?String(read(p)):"";
 const guarded=[
  ["functions/api/owner-ops.js","ownerAuth"],
  ["functions/api/owner-members.js","ownerAuth"],
  ["functions/api/ad-entitlement.js","ownerAuth"],
  ["functions/api/field-expansion.js","ownerAuth"],
  ["functions/api/kofi-member-issue.js","member_issuer_credentials"]
 ];
 for(const [p,needle] of guarded){
  if(!get(p)){add("medium","unverified","owner API",p,"Expected privileged route not inventoried.","Confirm routing and server-only authorization.");continue}
  if(!get(p).includes(needle))add("critical","confirmed","owner API",p,"Expected server-side owner authorization marker missing.","Restore authorization and add a negative-path regression test before release.");
 }
 const access="Cloudflare Access settings cannot be proven by repository code; separately verify exact-email policy, MFA and aliases using the Cloudflare API.";
 add("info","manual-review","Cloudflare Access","Cloudflare Zero Trust",access,"Confirm application route list and TOTP enforcement, test owner/non-owner with separate authorized sessions.");
 const ownerUI=["owner-dashboard.js","owner-v2.js","owner-console.js","member-operations.js"];
 for(const p of ownerUI){
  const s=get(p);if(!s)continue;
  if(/(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(/.test(s))add("high","potential","credential handling",p,"Storage write detected in owner UI; verify sensitive keys or records are not persisted.","Remove private key persistence or document the exact non-sensitive field.");
 }
 const html=get("member-operations.html");
 const dashboard=get("owner-dashboard.js");
 if(html&&!html.includes("ownerLock")&&!dashboard.includes('lockButton.id = "ownerLock"')&&!dashboard.includes('lockButton.id="ownerLock"'))
  add("high","potential","session hygiene","member-operations.html","Owner lock control absent from markup and dynamic dashboard creation.","Restore Lock & clear and regression-test private data panels.");
 const headers=get("_headers");
 if(headers&&!/\/member-operations\.html[\s\S]*?Cache-Control:\s*no-store/i.test(headers))add("medium","potential","headers","_headers","Owner page no-store response rule missing.","Add private no-store headers and verify on production.");
 for(const p of ["functions/api/nominations.js","functions/api/feedback.js"]){
  const s=get(p);
  if(s&&!s.includes("TURNSTILE_SECRET"))add("high","potential","public submissions",p,"Human-verification gate not found.","Restore Turnstile validation and rate limiting.");
  if(s&&!s.includes("owner_feature_flags"))add("medium","potential","operations",p,"Submission pause control no longer referenced.","Restore owner-controlled pause safeguard.");
 }
 const isApplication=p=>p.startsWith("src/")||p.startsWith("functions/")||(p.endsWith(".js")&&!p.startsWith("tests/")&&!p.startsWith("scripts/"));
 let unsafeSinks=0, shell=0, secrets=0;
 const secretPatterns=[
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,"private-key material"],
  [/github_pat_[A-Za-z0-9_]{30,}/,"GitHub token-shaped value"],
  [/gh[pousr]_[A-Za-z0-9]{35,}/,"GitHub token-shaped value"],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,"AWS access-key-shaped value"],
  [/\bsk_live_[0-9A-Za-z]{20,}\b/,"payment secret-shaped value"]
 ];
 for(const p of files){
  const s=get(p);
  if(!s)continue;
  for(const [re,what] of secretPatterns){
   if(re.test(s)){secrets++;add("critical","potential","secret exposure",p,"Repository contains "+what+". Value was deliberately withheld.","Investigate privately, revoke/rotate if real, and scan Git history without publishing credentials.");}
  }
  if(isApplication(p)){
   if(/\b(?:eval\s*\(|new\s+Function\s*\(|document\s*\.\s*write\s*\()/.test(s)){shell++;add("high","potential","backdoor/code injection",p,"Dynamic code execution or document.write pattern detected.","Review input provenance; eliminate execution of untrusted strings.");}
   if(/\.innerHTML\s*=|insertAdjacentHTML\s*\(/.test(s)&&unsafeSinks++<14)add("medium","manual-review","XSS surface",p,"HTML-string rendering detected; verify all dynamic input is escaped or trusted.","Use textContent/DOM APIs or safe sanitization for untrusted content.");
   if(/fetch\(\s*(?:req(?:uest)?\.|data\.|[a-zA-Z_$][\w$]*\s*\))/.test(s)&&p.startsWith("functions/"))add("medium","manual-review","SSRF surface",p,"Dynamic outbound fetch pattern; inspect destination allowlist.","Use fixed trusted origins, timeouts and response bounds.");
  }
  if(p.startsWith(".github/workflows/")){
   if(/pull_request_target\s*:|permissions:\s*write-all|(?:curl|wget)[^\n]*\|\s*(?:bash|sh)/i.test(s))
    add("high","potential","CI / supply chain",p,"Elevated or network-executed workflow pattern.","Limit workflow privileges, pin trusted actions and isolate PR execution.");
  }
 }
 const apiPaths=files.filter(p=>p.startsWith("functions/api/")&&p.endsWith(".js"));
 for(const p of apiPaths){
  const endpoint=get(p);
  if(endpoint.includes("onRequestPost(")){
   const authMarkers=["ownerAuth","auth(","TURNSTILE_SECRET","member_issuer_credentials","verifyHuman","signature","tokenOK","originOK","goodOrigin","verification_token","stripe.webhooks"];
   const protectedBy=authMarkers.some(m=>endpoint.includes(m));
   const retired=(p.endsWith("/account.js")&&endpoint.includes("return retired();"))||(p.endsWith("/stripe-webhook.js")&&endpoint.includes("status:410"));
   const diagnostic=p.endsWith("/kofi-diagnostics.js")&&endpoint.includes("KOFI_ADMIN_DIAGNOSTICS_HASH")&&endpoint.includes("Authorization")&&endpoint.includes("Access denied.");
   if(!protectedBy&&!retired&&!diagnostic)add("medium","manual-review","API authorization",p,"POST handler needs authorization review. Pattern check alone cannot prove vulnerability.","Confirm handler authorization with safe negative tests.");
   if(diagnostic)add("info","manual-review","separate diagnostics credential",p,"Diagnostics relies on a separately hashed bearer secret; no public GET.","Review deliberately isolated diagnostics access and secret rotation; consider Access defense in depth.");
  }
 }
 if(!get(".github/workflows/release-coordination.yml"))add("medium","potential","release controls","GitHub Actions","Release coordination workflow missing.","Restore workstream and PR collision safeguards.");
 if(!files.some(x=>x==="package-lock.json"||x==="npm-shrinkwrap.json"||x==="pnpm-lock.yaml"||x==="yarn.lock"))
  add("info","not-tested","dependency audit","repository","No dependency lockfile; an npm audit result would not cover this source-only project.","Use pinned versions for any future runtime dependencies and run a dependency audit when a lockfile exists.");
 add("info","not-tested","identity & payments","staging environment","Real owner MFA success, second-account IDOR, paid Ko-fi events and credential rotation cannot safely be automated against production.","Use synthetic staging users, payment fixtures and explicit operator approval.");
 return {inventory,findings};
}
async function check(url,{expectAccess=false,publicOk=false}={}){
 try{
  const r=await fetch(url,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"DeepCutsEDH-SafeSecuritySweep/1.0","Accept":"text/html,application/json"}});
  const loc=r.headers.get("location")||"";
  let status=r.status;
  // Confirm a same-host canonical redirect reaches an accessible public resource.
  if(publicOk&&[301,302,307,308].includes(status)&&loc){
   const destination=new URL(loc,url);
   if(destination.origin===new URL(url).origin){
    const follow=await fetch(destination.href,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(12000),headers:{"User-Agent":"DeepCutsEDH-SafeSecuritySweep/1.0"}});
    status=follow.status;
   }
  }
  const passed=expectAccess?([301,302,303,307,308,401,403].includes(r.status)&&((loc.includes("cloudflareaccess.com")||loc.includes("/cdn-cgi/access/"))||r.status===403)):
   publicOk?status===200:status<500;
  return {path:new URL(url).pathname,host:new URL(url).hostname,code:status,pass:passed,check:expectAccess?"Access interception":publicOk?"public GET":"HTTP health"};
 }catch(e){return {path:new URL(url).pathname,host:new URL(url).hostname,code:null,pass:false,check:"network timeout / unavailable"}}
}
export async function auditLive(){
 const host="https://deep-cuts-edh.pages.dev";
 const alias="https://532c7468.deep-cuts-edh.pages.dev";
 const checks=await Promise.all([
  check(host+"/",{publicOk:true}),
  check(host+"/nominations.html",{publicOk:true}),
  check(host+"/member-operations.html",{expectAccess:true}),
  check(host+"/api/owner-members",{expectAccess:true}),
  check(host+"/api/kofi-member-issue",{expectAccess:true}),
  check(host+"/api/owner-ops",{expectAccess:true}),
  check(alias+"/member-operations.html",{expectAccess:true}),
  check(alias+"/api/owner-ops",{expectAccess:true})
 ]);
 return checks;
}
function riskOrder(x){return ({critical:0,high:1,medium:2,low:3,info:4})[x]??5}
export function markdownReport(report){
 const {inventory,findings,live,createdAt,revision}=report;
 const count=Object.fromEntries(["critical","high","medium","low","info"].map(x=>[x,findings.filter(f=>f.severity===x).length]));
 const lines=["# DeepCutsEDH — security sweep","",`Time (UTC): ${createdAt}`,`Source revision: ${revision}`,"",
  "> This is a **non-destructive automated first pass**, not a penetration-testing certificate. Potential findings are NOT confirmed vulnerabilities. No secrets, response bodies or private records are included.", "",
  "## Scope and counts","",`- Source files scanned: ${inventory.sources}`,`- API files inventoried: ${inventory.api}`,`- GitHub workflows inventoried: ${inventory.workflows}`,
  `- Potential issues by severity: ${JSON.stringify(count)}`,"", "## Safe live checks","",
  "| Host | Path | Check | Status | Result |","|---|---|---|---|---|",
  ...(live?.length?live.map(x=>`| ${x.host} | \`${x.path}\` | ${x.check} | ${x.code??"Unavailable"} | ${x.pass?"PASS":"INVESTIGATE"} |`):["| Not run | — | Run workflow with network-enabled runner | — | NOT TESTED |"]),
  "","## Findings and unresolved review items",""];
 if(!findings.length)lines.push("No rule-based findings. This does **not** prove absence of vulnerabilities.");
 for(const f of [...findings].sort((a,b)=>riskOrder(a.severity)-riskOrder(b.severity)))
  lines.push(`- **${f.severity.toUpperCase()} / ${f.status} / ${f.category}** — \`${f.where}\`: ${redact(f.summary)} **Next:** ${redact(f.remediation)}`);
 lines.push("","## Review not covered by automatic checks","","- Positive Cloudflare MFA login and exact-email restriction require a real owner and an authorized negative test identity.","- Account-to-account permissions, recovery challenges, payments, webhook replay and game-score forgery need safe staging fixtures and explicit review.","- Database restores, fuzzing, rate-limit stress, brute force and payment actions were deliberately **not** run.","- Cloudflare Access account policy verification and secret scanning history require connected, read-only administrator review.","","## Remediation disposition","","This report does not claim that a flagged finding was closed until a targeted code fix, regression test, CI pass, and confirmed deployment are linked. Record fixes in a private security issue/PR and mark open vs closed after verification.","");
 return lines.join("\n");
}
export async function run({root=DEFAULT_ROOT,live=false}={}){
 const paths=walk(root),audit=auditSources(paths,p=>fs.readFileSync(path.join(root,p),"utf8"));
 const checks=live?await auditLive():[];
 for(const x of checks)if(!x.pass)audit.findings.push({severity:x.check==="Access interception"?"critical":"medium",status:"potential",category:"live access",where:x.host+x.path,summary:"Unexpected status for "+x.check+" ("+(x.code??"unavailable")+").",remediation:"Review Access route matching and origin response using authorized read-only tools."});
 const report={version:1,createdAt:new Date().toISOString(),revision:process.env.GITHUB_SHA||"local",inventory:audit.inventory,live:checks,findings:audit.findings};
 const dir=path.join(root,"security-report-output");fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,"report.json"),JSON.stringify(report,null,2)+"\n");
 fs.writeFileSync(path.join(dir,"report.md"),markdownReport(report)+"\n");
 if(checks.some(x=>!x.pass))console.log("Safe live checks requiring follow-up:",checks.filter(x=>!x.pass).map(x=>x.host+x.path+" HTTP "+(x.code??"unavailable")).join("; "));
 console.log(`Security sweep complete. ${audit.inventory.sources} files; ${audit.findings.length} findings/review items; ${checks.filter(x=>x.pass).length}/${checks.length} safe live checks. Reports: security-report-output/report.md and report.json`);
 // Only halt automated release on high-confidence owner-auth guard regressions.
 if(audit.findings.some(x=>x.status==="confirmed"&&x.severity==="critical")||checks.some(x=>!x.pass&&x.check==="Access interception"))process.exitCode=1;
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 run({live:process.argv.includes("--live")}).catch(e=>{console.error("Security sweep could not finish:",e.name);process.exitCode=1});
