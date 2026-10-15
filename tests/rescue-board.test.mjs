import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=path=>fs.readFileSync(path,"utf8");

test("Rescue Board is inside existing Nominations; no new nav or homepage clutter",()=>{
 const html=read("nominations.html");
 assert.match(html,/src="rescue-board.js"/);
 assert.match(html,/src="nomination.js"/);
 assert.ok(html.indexOf('src="rescue-board.js"')<html.indexOf('src="nomination.js"'));
 assert.match(html,/id="rescuePublishedList"/);
 assert.match(html,/class="rescue-board-stages"/);
 assert.match(html,/COMMUNITY MOST WANTED/);
 assert.match(html,/id="nominationForm"/);
 assert.doesNotMatch(read("index.html"),/rescue-board\.css|rescue-board\.js/);
});
test("Published report links are grounded in actual files and existing community evidence",()=>{
 const source=read("rescue-board.js");
 const report=read("reports/guide.js");
 const slugs=["chainer-dementia-master","alena-and-gilanra","commander-mustard","ekthi-contaminator-priest"];
 for(const slug of slugs){
  assert.ok(fs.existsSync("reports/"+slug+".html"),"Must link to real report "+slug);
  assert.ok(source.includes('"'+slug+'"'),"Published link should list "+slug);
  assert.ok(report.includes('"'+slug+'"'),"Evidence tab allowlist should cover "+slug);
 }
 assert.match(source,/Nominated · review before publication/);
 assert.match(source,/Sharing an idea uses the existing nomination form/);
 assert.match(report,/fetch\(u,\{headers/);
 assert.match(report,/fold\.addEventListener\("toggle"/);
 assert.match(report,/item\.title\.slice/);
 assert.doesNotMatch(source,/innerHTML|insertAdjacentHTML/);
 assert.doesNotMatch(report.slice(report.indexOf("allowedCases")),/innerHTML|insertAdjacentHTML/);
});
