import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("Shareable Case Files use only verified public records and never embed private account information",()=>{
 const html=fs.readFileSync("case-file.html","utf8");
 const js=fs.readFileSync("case-file.js","utf8");
 assert.match(html,/case-file\.js/);
 assert.match(html,/id="cfCanvas" width="1200" height="630"/);
 assert.match(html,/rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/case-file"/);
 assert.match(html,/href="\/release-polish\.css"/);
 assert.match(html,/href="\/library"/);
 assert.match(js,/validCommander/);
 assert.match(js,/\/api\/tool-cards/);
 assert.match(js,/\/api\/community\?action=deck&id=/);
 assert.match(js,/\^\[0-9a-f\]\{32\}/);
 assert.match(js,/canvas\.toBlob\(/);
 assert.doesNotMatch(js,/innerHTML|eval\(|community_profile_emails|key_hash|ownerAccess|profileKey|recovery/i);
 assert.doesNotMatch(html,/name="email"|name="password"|private collection/i);
});
test("Canvas is original local artwork, not third-party images, and does not fabricate earned awards",()=>{
 const js=fs.readFileSync("case-file.js","utf8");
 assert.match(js,/ctx\.fillText/);
 assert.match(js,/createLinearGradient/);
 assert.doesNotMatch(js,/drawImage|earned achievements|streak claimed|localStorage/);
 assert.match(js,/if\(!res\.ok\|\|!data\?\.deck\)/);
});
