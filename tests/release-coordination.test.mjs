import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {validatePR,validateIncubatorPR,findOverlaps,githubRequestURL,validPRNumber,parsePullRequestEvent,checkCurrentPullRequest} from "../scripts/release-coordination.mjs";
const main="Squackle/deep-cuts-edh",lab="Squackle/deep-cuts-game-lab-";
const fields=["Owner authorization: Explicit owner approval October 15","Files/Scope: Docs and workflow only","Concurrent work: no open PRs checked","Test plan: node --test","Rollback: revert release commit"].join("\n");
test("Coordination touches documentation and CI only; runtime edits blocked",()=>{
 const body="Workstream: Coordination\n"+fields;
 assert.deepEqual(validatePR({repo:main,body,files:["AGENTS.md","docs/DEVELOPMENT-LANES.md",".github/CODEOWNERS","scripts/release-coordination.mjs","tests/release-coordination.test.mjs"]}),[]);
 assert.ok(validatePR({repo:main,body,files:["library.js"]}).some(x=>x.includes("runtime")));
 assert.ok(validatePR({repo:lab,body,files:["src/engine.js"]}).some(x=>x.includes("runtime")));
});
test("Website PR can change library; Hive Run requires tested lab evidence",()=>{
 const site="Workstream: Website\n"+fields;
 assert.deepEqual(validatePR({repo:main,body:site,files:["library.js"]}),[]);
 assert.ok(validatePR({repo:main,body:site,files:["games/hive-run/src/main.js"]}).length>=3);
 const promotion=["Workstream: Game Lab Promotion",fields,
  "Lab source SHA: "+"a".repeat(40),"Rules version: hive-1.3",
  "Score/replay validation: main client/server deterministic suite passing"].join("\n");
 assert.deepEqual(validatePR({repo:main,body:promotion,files:["games/hive-run/src/main.js","src/hive-server/leaderboard.js"]}),[]);
});
test("Lab developer must document version; shared account is not assumed independent",()=>{
 const body=["Workstream: Game Lab",fields,"Rules version: unchanged","Main-site impact: none"].join("\n");
 assert.deepEqual(validatePR({repo:lab,body,files:["src/engine.js"]}),[]);
 assert.ok(validatePR({repo:lab,body:body.replace("Rules version: unchanged","Rules version: [TODO]"),files:["src/engine.js"]}).length>0);
});
test("PR templates with unfilled placeholders never pass",()=>{
 const body=["Workstream: Coordination","Owner authorization: [approval pending]","Files/Scope: [fill]","Concurrent work: [none]","Test plan: [run]","Rollback: [SHA]"].join("\n");
 assert.equal(validatePR({repo:main,body,files:["AGENTS.md"]}).length,5);
});
test("Newer overlapping open PR waits; unrelated files never block",()=>{
 const theirs=[{number:11,title:"old",files:["library.js","docs/A.md"]},
  {number:17,title:"newer",files:["library.js"]},
  {number:9,title:"unrelated",files:["games.html"]}];
 assert.deepEqual(findOverlaps(["library.js","styles.css"],theirs,12),[
  {number:11,title:"old",shared:["library.js"]}]);
 assert.deepEqual(findOverlaps(["styles.css"],theirs,12),[]);
});

test("Stackbreaker agent cannot touch Mana Heist, shared code or main",()=>{
 const ok=validateIncubatorPR({repo:main,branch:"game/stackbreaker-incubator-20261015",base:"experimental-review",lane:"Stackbreaker Prototype",files:["incubators/stackbreaker/AGENT_STARTER.md","incubators/stackbreaker/src/engine.js"]});
 assert.deepEqual(ok,[]);
 const bad=validateIncubatorPR({repo:main,branch:"game/stackbreaker-incubator-20261015",base:"main",lane:"Website",files:["incubators/stackbreaker/src/engine.js","incubators/mana-heist/src/engine.js","games.html"]});
 assert.ok(bad.some(x=>x.includes("Workstream")));
 assert.ok(bad.some(x=>x.includes("only change")));
 assert.ok(bad.some(x=>x.includes("cannot be merged")));
});
test("Mana Heist agent is symmetric; unrelated Website PR stays unblocked",()=>{
 assert.deepEqual(validateIncubatorPR({repo:main,branch:"game/mana-heist-incubator-20261015",base:"topic",lane:"Mana Heist Prototype",files:["incubators/mana-heist/src/solver.js"]}),[]);
 const bad=validateIncubatorPR({repo:main,branch:"game/mana-heist-incubator-20261015",base:"main",lane:"Mana Heist Prototype",files:["incubators/stackbreaker/README.md"]});
 assert.ok(bad.some(x=>x.includes("only change")));
 assert.ok(bad.some(x=>x.includes("cannot be merged")));
 assert.deepEqual(validateIncubatorPR({repo:main,branch:"site/library-20261015",base:"main",lane:"Website",files:["library.js"]}),[]);
 assert.ok(validateIncubatorPR({repo:main,branch:"site/lane-breaking",base:"main",lane:"Website",files:["incubators/stackbreaker/README.md"]}).length);
 assert.ok(validateIncubatorPR({repo:main,branch:"site/lane-breaking",base:"main",lane:"Mana Heist Prototype",files:["library.js"]}).length);
});
test("Hive Run game lab protection stays independent",()=>{
 assert.deepEqual(validateIncubatorPR({repo:lab,branch:"game/stackbreaker-test",base:"main",lane:"Game Lab",files:["src/engine.js"]}),[]);
});

test("API boundary permits only known repositories, read routes and numeric PR identifiers",()=>{
 assert.equal(githubRequestURL(main,"/pulls/123/files?per_page=100&page=1").href,"https://api.github.com/repos/"+main+"/pulls/123/files?per_page=100&page=1");
 assert.equal(githubRequestURL(lab,"/pulls?state=open&per_page=100&page=5").hostname,"api.github.com");
 for(const n of ["123","1/../../",0,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1,null,{}])assert.throws(()=>validPRNumber(n));
 assert.equal(validPRNumber(123),123);
 for(const p of ["//evil.invalid","/pulls/1/../../files?per_page=100&page=1","/pulls/1/files?per_page=100&page=1&secret=x","/pulls/1/files?per_page=100&page=6","/pulls/1/files?per_page=100&page=1#x"])assert.throws(()=>githubRequestURL(main,p));
 assert.throws(()=>githubRequestURL("evil.invalid","/pulls?state=open&per_page=100&page=1"));
});

test("event parsing retains only necessary metadata and rejects invalid shape",()=>{
 const pr={number:123,body:fields,head:{ref:"coord/test",secret:"synthetic"},base:{ref:"main"},extra:"synthetic"};
 assert.deepEqual(parsePullRequestEvent(JSON.stringify({pull_request:pr,secret:"synthetic"})),{number:123,body:fields,head:{ref:"coord/test"},base:{ref:"main"}});
 for(const bad of [null,{}, {pull_request:{...pr,number:"123"}},{pull_request:{...pr,body:{}}},{pull_request:{...pr,head:{}}}])assert.throws(()=>parsePullRequestEvent(JSON.stringify(bad)));
});
test("coordination transmits only fixed GET routes and never forwards event content",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"release-coordination-"));
 const path=join(dir,"event.json"),original=globalThis.fetch,seen=[];
 const pr={number:123,body:"Workstream: Coordination\n"+fields,head:{ref:"coord/test"},base:{ref:"main"},secret:"SYNTHETIC_PRIVATE_EVENT"};
 const env={GITHUB_EVENT_PATH:path,GITHUB_REPOSITORY:main,GITHUB_TOKEN:"synthetic-token"};
 try{
  writeFileSync(path,JSON.stringify({pull_request:pr}));
  globalThis.fetch=async (url,options)=>{
   seen.push(url.href);
   assert.equal(url.origin,"https://api.github.com");
   assert.equal(options.method,"GET");assert.equal(options.redirect,"error");
   assert.equal(options.body,undefined);assert.equal(options.headers.Authorization,"Bearer synthetic-token");
   assert.ok(!url.href.includes(pr.secret));
   return Response.json(url.pathname.endsWith("/files")?[{filename:"scripts/example.mjs"}]:[]);
  };
  assert.deepEqual(await checkCurrentPullRequest(env),{files:["scripts/example.mjs"],older:0});
  assert.deepEqual(seen,["https://api.github.com/repos/"+main+"/pulls/123/files?per_page=100&page=1","https://api.github.com/repos/"+main+"/pulls?state=open&per_page=100&page=1"]);
  writeFileSync(path,JSON.stringify({pull_request:{...pr,number:"123?secret="+pr.secret}}));
  await assert.rejects(checkCurrentPullRequest(env),/Invalid pull request number/);
  assert.equal(seen.length,2);
 }finally{globalThis.fetch=original;rmSync(dir,{recursive:true,force:true})}
});
