import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {renderWeeklyDispatch} from "../src/weekly-dispatch-template.js";
const base={weekLabel:"Oct 25, 2026",featured:{title:"Commander Mustard",url:"/reports/commander-mustard"},stories:[{title:"A featured public investigation",url:"/community"}],games:[{title:"Play Cold Case",url:"/games/cold-case"}]};
test("Digest previews contain real source links, HTML + plain text, but never email recipients or secrets",()=>{
 const d=renderWeeklyDispatch({...base,preview:true});
 assert.equal(d.preview,true);
 assert.match(d.html,/Commander Mustard/);
 assert.match(d.html,/https:\/\/deep-cuts-edh\.pages\.dev\/reports\/commander-mustard/);
 assert.match(d.text,/Play Cold Case/);
 assert.doesNotMatch(d.html,/api\/profile|GOOGLE_MAILER_SECRET|Bearer|token=[A-Za-z0-9_-]{24}/i);
 const script=fs.readFileSync("src/weekly-dispatch-template.js","utf8");
 assert.doesNotMatch(script,/sendEmail|MailApp|resend\.com|fetch\(|\.send\(/);
});
test("Recipient-ready issue rejects missing opt-in unsubscribe link or physical mailing address",()=>{
 assert.throws(()=>renderWeeklyDispatch(base),/unsubscribe URL/);
 assert.throws(()=>renderWeeklyDispatch({...base,unsubscribeUrl:"https://deep-cuts-edh.pages.dev/unsubscribe?token="+"a".repeat(35)}),/postal address/);
 const d=renderWeeklyDispatch({...base,unsubscribeUrl:"https://deep-cuts-edh.pages.dev/unsubscribe?token="+"a".repeat(35),postalAddress:"123 Example Avenue, Austin, TX 78701"});
 assert.equal(d.preview,false);
 assert.match(d.text,/Unsubscribe:/);
});
test("Published content cannot inject HTML, impersonate URLs, redirect off-site or send an empty digest",()=>{
 assert.throws(()=>renderWeeklyDispatch({...base,featured:{title:"Fake",url:"https://evil.example/phishing"},preview:true}),/Only public/);
 assert.throws(()=>renderWeeklyDispatch({...base,featured:{title:"Fake",url:"/member-operations"},preview:true}),/Unapproved/);
 assert.throws(()=>renderWeeklyDispatch({...base,stories:[],games:[],preview:true}),/empty/);
 const malicious=renderWeeklyDispatch({...base,stories:[{title:"<script>alert(1)</script>",url:"/community"}],preview:true});
 assert.doesNotMatch(malicious.html,/<script>alert/);
 assert.match(malicious.html,/&lt;script&gt;/);
});
