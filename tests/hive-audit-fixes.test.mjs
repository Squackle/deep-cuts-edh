import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {onRequestGet} from "../functions/api/hive-profile.js";
const css=readFileSync(new URL("../games/hive-run/styles.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../games/hive-run/index.html",import.meta.url),"utf8");
const game=readFileSync(new URL("../games/hive-run/src/main.js",import.meta.url),"utf8");
const wf=readFileSync(new URL("../.github/workflows/site-quality.yml",import.meta.url),"utf8");
test("Game Only hides page instructions but retains return-home link and boss overlay",()=>{
 assert.match(css,/body\.game-only \.arcade-frame>\.mutation-guide\{display:none!important\}/);
 assert.match(html,/id="fieldGuide"/);
 assert.match(html,/class="arcade-home-link"/);
 assert.match(html,/id="bossBriefing"/);
 assert.match(css,/body\.game-only \.arcade-home-link/);
});
test("public metrics remain hidden even when URL contains debug query",()=>{
 assert.match(html,/id="devDiagnostics" hidden/);
 assert.doesNotMatch(game,/searchParams\.get\("debug"\)/);
 assert.match(css,/\.dev-diagnostics\[hidden\]\{display:none!important\}/);
});
test("production site-quality is required on every main push",()=>{
 assert.match(wf,/on:\s*\n\s*push:\s*\n\s*branches: \[main/);
 assert.match(wf,/pull_request:/);
 assert.match(wf,/node scripts\/site-release-check\.mjs/);
});
test("verified profile evolution is taken from the best scoring run, not a different run",async()=>{
 let query="";
 const env={
  DB:{prepare(){return{bind(){return{async first(){return{id:"p",handle:"Squackle"}}}}}}},
  HIVE_DB:{prepare(sql){query=sql;return{bind(profileId){assert.equal(profileId,"p");return{async all(){return{results:[{mode:"hunt",rulesVersion:"hive-1.0.2",bestScore:5000,bestEvolution:7,rankedRuns:3}]}}}}}}}
 };
 const r=await onRequestGet({env,request:new Request("https://deep-cuts-edh.pages.dev/api/hive-profile?handle=Squackle")});
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).records,[{mode:"hunt",rulesVersion:"hive-1.0.2",bestScore:5000,bestEvolution:7,rankedRuns:3}]);
 assert.match(query,/ROW_NUMBER\(\) OVER/);
 assert.match(query,/PARTITION BY mode,rules_version/);
 assert.match(query,/ORDER BY score DESC,kills DESC,created_at ASC,id ASC/);
 assert.match(query,/WHERE placement=1/);
 assert.doesNotMatch(query,/MAX\(evolutions\)/);
 const profileUI=readFileSync(new URL("../hive-profile.js",import.meta.url),"utf8");
 assert.match(profileUI,/evolution '\+record\.bestEvolution\+' in that run/);
});
