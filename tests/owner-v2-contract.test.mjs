import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Command Center V2 retains old owner auth, forms and 2.0 UI",()=>{
 const html=read("member-operations.html");
 for(const id of ["opsForm","complimentaryForm","ownerEvidenceForm","ownerAdFreeForm","issuedKeySection","ownerConsole"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/owner-dashboard\.js/);assert.match(html,/owner-v2\.js/);
 assert.match(html,/owner-v2\.css/);
 const ui=read("owner-v2.js");
 for(const label of ["Welcome back.","Content","Community","Games","Business","Site","Security"]){
  assert.ok(ui.includes(label),label);
 }
 assert.doesNotMatch(ui,/localStorage|sessionStorage|eval\(|innerHTML|document\.cookie/);
 assert.match(ui,/MutationObserver/);
 assert.match(ui,/ownerLock/);
});

test("V2 backend and real switch enforcement require server owner authorization",()=>{
 const api=read("functions/api/owner-ops.js");
 assert.match(api,/await ownerAuth\(request,env\)/);
 assert.match(api,/owner_action_audit/);
 assert.match(api,/No restore action|No database restoration|Backups and restores/);
 assert.doesNotMatch(api,/env\.(?:CLOUDFLARE|GITHUB|KOFI)_API_TOKEN/);
 const nom=read("functions/api/nominations.js");
 const feedback=read("functions/api/feedback.js");
 assert.match(nom,/owner_feature_flags WHERE flag=\?/);
 assert.match(nom,/public_nominations/);
 assert.match(feedback,/owner_feature_flags WHERE flag=\?/);
 assert.match(feedback,/public_feedback/);
 const schema=read("db/owner-command-center-v2.sql");
 for(const table of ["owner_editorial_queue","owner_feature_flags","owner_action_audit"])assert.ok(schema.includes(table));
});

test("Owner V2 operational reports do not claim unimplemented external integrations",()=>{
 const api=read("functions/api/owner-ops.js");
 const ui=read("owner-v2.js");
 assert.match(api,/not web traffic/);
 assert.match(api,/not a complete bank reconciliation/);
 assert.match(ui,/AdSense approval and earnings are not currently available/);
 assert.match(ui,/No database restoration/);
});
