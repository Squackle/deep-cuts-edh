// PHASE 5 PLAN ONLY. NEVER deletes or writes anything.
// Run after live admin acceptance and use its output to assemble a separate
// protected-branch retirement PR. Shared public/member APIs must be preserved.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const retireOnlyAfterCutover=[
 "member-operations.html","member-operations.js",
 "diagnostics.html","diagnostics.js","diagnostics.css",
 "owner-dashboard.js","owner-dashboard.css","owner-v2.js","owner-v2.css",
 "owner-console.js","owner-evidence.js","owner-adfree.js",
 "owner-services.js","owner-services.css",
 "functions/api/owner-ops.js","functions/api/owner-members.js",
 "functions/api/kofi-diagnostics.js","functions/api/kofi-member-issue.js"
];
const preservePublic=[
 "functions/api/kofi-webhook.js","functions/api/stripe-webhook.js",
 "functions/api/member.js","functions/api/account.js",
 "functions/api/ad-entitlement.js","functions/api/field-expansion.js",
 "functions/api/site-presence.js","functions/api/profile-recovery.js",
 "functions/api/community.js","functions/api/arcane-games.js"
];
const splitShared=[
 {path:"functions/api/ad-entitlement.js",remove:"owner-only POST reconciliation",retain:"public/verified ad-free GET"},
 {path:"functions/api/field-expansion.js",remove:"owner feature_evidence POST case",retain:"regular member evidence and collection actions"}
];
for(const name of [...retireOnlyAfterCutover,...preservePublic]){
 if(!fs.existsSync(path.join(repo,name)))throw Error("Source contract changed, review before any cleanup: "+name);
}
for(const item of splitShared){
 const source=fs.readFileSync(path.join(repo,item.path),"utf8");
 if(!source.includes(item.path.includes("field-expansion")?"feature_evidence":"onRequestPost"))
  throw Error("Shared endpoint changed; examine manually: "+item.path);
}
console.log(JSON.stringify({
 operation:"DRY-RUN-ONLY",writesPerformed:0,prRequired:true,
 adminAcceptanceRequired:true,removeWhenApproved:retireOnlyAfterCutover,
 preserve:preservePublic,splitShared,warning:"Do not delete public payment intake, login, presence, member entitlements or other shared HTTP handlers."
},null,2));
