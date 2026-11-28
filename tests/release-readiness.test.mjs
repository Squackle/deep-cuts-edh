import test from "node:test";
import assert from "node:assert/strict";
import {assessPR,latestChecks,previewSafety,collectRepository,collectCloudflare,githubClient,renderReport,pilotPreflight,PREVIEW_PROJECT,PILOT_BRANCHES} from "../scripts/release-readiness.mjs";
const sha="a".repeat(40),base="b".repeat(40);
const pr={number:8,title:"Fixture",head:{sha,ref:"game/test"},base:{sha:base},html_url:"https://github.com/Squackle/deep-cuts-game-lab-/pull/8"};
const check=(name,id,conclusion="success",status="completed")=>({name,id,conclusion,status,app:{slug:"github-actions"}});
test("latest check per app/name; missing, pending and failed checks remain visible",()=>{
 const checks=[check("release-coordination",1,"failure"),check("release-coordination",2),check("browser",3,null,"in_progress"),check("provider",4,"failure")];
 assert.equal(latestChecks(checks).length,3);
 const p=assessPR(pr,checks,["release-coordination","site-quality"],["a"],[],{strict:true,mainSha:"c".repeat(40)});
 assert.deepEqual(p.requiredStates.map(x=>x.state),["pass","missing"]);
 assert.equal(p.technical,"HOLD");
 assert.ok(p.holds.includes("base snapshot changed during collection"));
 assert.ok(p.holds.includes("strict-base ancestry unverified"));
 const stale=assessPR(pr,[check("release-coordination",1)],["release-coordination"],["a"],[],{strict:true,mainSha:base,behindBy:2});
 assert.ok(stale.holds.includes("branch behind main by 2 commit(s)"));
 assert.equal(p.failures[0].name,"provider");
});
test("older path overlap blocks; future PR overlap does not override owner ordering",()=>{
 const p=assessPR(pr,[check("release-coordination",1)],["release-coordination"],["a"],[{number:7,files:["a"]},{number:9,files:["a"]}]);
 assert.deepEqual(p.overlaps,[{number:7,paths:["a"]}]);
 assert.equal(p.technical,"HOLD");
 assert.equal(assessPR(pr,[check("release-coordination",1)],["release-coordination"],["a"],[]).technical,"REVIEW");
 assert.equal(assessPR(pr,[],["release-coordination"],["a"],[],{checksKnown:false}).technical,"HOLD");
 assert.equal(assessPR(pr,[check("release-coordination",1)],["release-coordination"],null,[]).technical,"HOLD");
});
test("required checks only pass on completed success",()=>{
 const required=["release-coordination","site-quality"];
 const coordination=check(required[0],1);
 const scenarios=[
  [null,"missing"],
  [check(required[1],2,"skipped"),"skipped"],
  [check(required[1],2,"neutral"),"neutral"],
  [check(required[1],2,"action_required"),"failed"],
  [check(required[1],2,"unrecognized"),"unknown"],
  [check(required[1],2,"success","in_progress"),"pending"]
 ];
 for(const [candidate,state] of scenarios){
  const checks=candidate?[coordination,candidate]:[coordination];
  const result=assessPR(pr,checks,required,[],[]);
  assert.deepEqual(result.requiredStates,[{name:required[0],state:"pass"},{name:required[1],state}]);
  assert.equal(result.technical,"HOLD",state);
  assert.ok(result.holds.includes("required checks incomplete"),state);
 }
 const quality=check(required[1],2);
 const rerun=check(required[0],3,"skipped");
 assert.equal(assessPR(pr,[coordination,quality,rerun],required,[],[]).technical,"HOLD");
 const optional=[check("optional",3,"skipped"),check("informational",4,"neutral")];
 assert.equal(assessPR(pr,[coordination,quality,...optional],required,[],[]).technical,"REVIEW");
});
test("required checks pinned to a GitHub app use that app's own completed result",()=>{
 const context="release-coordination";
 const required=[{context,integration_id:21}];
 const unrelated={...check(context,3),app:{id:22,slug:"other"}};
 const expected={...check(context,1),app:{id:21,slug:"github-actions"}};
 const assess=checks=>assessPR(pr,checks,required,[],[]);
 assert.deepEqual(assess([unrelated]).requiredStates,[{name:context,state:"missing",app:21}]);
 assert.equal(assess([unrelated]).technical,"HOLD");
 assert.equal(assess([expected,unrelated]).technical,"REVIEW");
 const rerun={...expected,id:2,conclusion:"neutral"};
 assert.equal(assess([expected,rerun,unrelated]).requiredStates[0].state,"neutral");
});
test("preview guard detects shared KV, wildcard and unexpected Lab credentials; isolated exact list passes",()=>{
 const p={name:"deep-cuts-game-lab",source:{config:{preview_deployment_setting:"none",preview_branch_includes:["*"]}},deployment_configs:{production:{kv_namespaces:{LAB_PRESENCE:{namespace_id:"live"}}},preview:{kv_namespaces:{OTHER:{namespace_id:"live"}},env_vars:{TOKEN:{type:"secret_text",value:"DO_NOT_REPORT"}}}}};
 const bad=previewSafety(p);
 assert.deepEqual(bad.shared,["kv_namespaces:OTHER"]);
 assert.ok(bad.issues.includes("automatic previews disabled"));
 assert.ok(bad.issues.includes("unexpected Lab preview bindings/variables"));
 assert.ok(!JSON.stringify(bad).includes("DO_NOT_REPORT"));
 p.source.config.preview_deployment_setting="custom";
 assert.ok(previewSafety(p).issues.includes("preview branch allowlist is not exact"));
 p.source.config.preview_branch_includes=["coord/pilot"];
 p.deployment_configs.preview={kv_namespaces:{LAB_PRESENCE:{namespace_id:"isolated"}}};
 assert.deepEqual(previewSafety(p).issues,[]);
});
test("collector distinguishes absent schedules and deployment status from verified results",async()=>{
 const config={repo:"Squackle/deep-cuts-game-lab-",project:"deep-cuts-game-lab",required:["release-coordination"],gates:[103],audit:false};
 const get=async(repo,path)=>{
  if(path==="branches/main")return {commit:{sha:base}};
  if(path==="rules/branches/main")return [{type:"required_status_checks",parameters:{required_status_checks:[{context:"release-coordination",integration_id:21}],strict_required_status_checks_policy:false}}];
  if(path==="issues/103")return {state:"open",title:"Owner gate"};
  if(path.startsWith("deployments?"))return [];
  throw Error("unexpected "+path);
 };
 const pages=async(repo,path)=>{
  if(path==="pulls?state=open")return [pr];
  if(path.includes("/files"))return [{filename:"a"}];
  if(path.includes("/check-runs"))return [{...check("release-coordination",1),app:{id:21,slug:"github-actions"}}];
  if(path==="actions/workflows")return [];
  throw Error("unexpected "+path);
 };
 const r=await collectRepository(config,{get,pages});
 assert.equal(r.items[0].technical,"REVIEW");
 assert.equal(r.items[0].requiredStates[0].app,21);
 assert.equal(r.rulesVerified,true);
 assert.equal(r.scheduled[0].state,"not on default branch");
 assert.equal(r.approvals[0].state,"open");
 assert.deepEqual(r.errors,[]);
 const report=renderReport({generated:"fixture",repositories:[r]});
 assert.match(report,/not proof of deployed SHA/);
 assert.match(report,/owner approval/);
 assert.match(report,/No fresh npm audit/);
});
test("Cloudflare readback requires explicit credentials and never returns secret values",async()=>{
 assert.match((await collectCloudflare("deep-cuts-game-lab",{})).state,/unverified/);
 const env={CF_READ_TOKEN:"fixture-secret",CF_ACCOUNT_ID:"a".repeat(32)};
 const r=await collectCloudflare("deep-cuts-game-lab",env,async(url,options)=>{
  assert.equal(options.method,"GET");
  if(url.endsWith("/"+PREVIEW_PROJECT))return new Response(JSON.stringify({success:true,result:isolatedProject()}));
  if(url.includes("/deployments?")){
   const record=branch=>({deployment_trigger:{metadata:{commit_hash:sha,branch}},latest_stage:{name:"queued",status:"idle"}});
   return new Response(JSON.stringify({success:true,result:url.includes(PREVIEW_PROJECT)?[record(PILOT_BRANCHES[0]),record("game/outside")]:[record("game/test")]}));
  }
  assert.match(url,/\/pages\/projects\/deep-cuts-game-lab$/);
  return new Response(JSON.stringify({success:true,result:{name:"deep-cuts-game-lab",canonical_deployment:{deployment_trigger:{metadata:{commit_hash:sha}},latest_stage:{status:"success",name:"deploy"}},deployment_configs:{preview:{env_vars:{TOKEN:{value:"secret"}}}}}}));
 });
 assert.equal(r.sha,sha);
 assert.deepEqual(r.previews,[{sha,branch:"game/test",stage:"queued",status:"idle"}]);
 assert.deepEqual(r.isolated.previews,[{sha,branch:PILOT_BRANCHES[0],stage:"queued",status:"idle"}]);
 assert.ok(!JSON.stringify(r).includes("fixture-secret"));
 assert.ok(!JSON.stringify(r).includes('"value"'));
});
test("peer fallback never reuses private token for another origin",async()=>{
 const calls=[];
 const client=githubClient({token:"synthetic",own:"Squackle/deep-cuts-edh",fetcher:async(url,opts)=>{
  calls.push({url,auth:opts.headers.Authorization});
  return opts.headers.Authorization?new Response(null,{status:403}):new Response(JSON.stringify({ok:true}));
 }});
 assert.deepEqual(await client.get("Squackle/deep-cuts-game-lab-","branches/main"),{ok:true});
 assert.equal(calls.length,2);
 assert.equal(calls[1].auth,undefined);
 assert.ok(calls.every(x=>x.url.startsWith("https://api.github.com/repos/Squackle/")));
});

const isolatedProject=()=>({name:PREVIEW_PROJECT,source:{config:{production_branch:"main",production_deployments_enabled:false,preview_deployment_setting:"custom",preview_branch_includes:[...PILOT_BRANCHES],preview_branch_excludes:[]}},deployment_configs:{production:{},preview:{env_vars:{},kv_namespaces:{},compatibility_date:"2026-01-01",compatibility_flags:[],fail_open:true}}});
test("isolated preflight requires disabled production, approved refs and empty bindings on both environments",()=>{
 const valid=isolatedProject();
 assert.deepEqual(pilotPreflight(valid),{state:"CONFIGURATION MATCH ONLY",issues:[]});
 for(const environment of ["preview","production"]){
  for(const [key,value] of [["kv_namespaces",{LAB_PRESENCE:{namespace_id:"isolated"}}],["d1_databases",{DB:{id:"live"}}],["env_vars",{SECRET:{value:"never-print-me"}}],["future_resource",{x:"unrecognized"}]]){
   const changed=structuredClone(valid);changed.deployment_configs[environment][key]=value;
   const check=pilotPreflight(changed);assert.equal(check.state,"BLOCKED");assert.ok(!JSON.stringify(check).includes("never-print-me"));
  }
 }
 const bad=structuredClone(valid);bad.source.config.preview_branch_includes.push("game/*");
 assert.equal(pilotPreflight(bad).state,"BLOCKED");
 const enabled=structuredClone(valid);enabled.source.config.production_deployments_enabled=true;
 assert.equal(pilotPreflight(enabled).state,"BLOCKED");
 assert.equal(pilotPreflight({...valid,name:"deep-cuts-game-lab"}).state,"BLOCKED");
 delete valid.deployment_configs.preview;assert.equal(pilotPreflight(valid).state,"BLOCKED");
 assert.equal(pilotPreflight({}).state,"BLOCKED");
});
test("open code-scanning tracker remains an explicit unresolved release gate despite green checks",()=>{
 const r={repo:"Squackle/deep-cuts-edh",mainSha:base,requiredNames:["site-quality"],rulesVerified:true,strict:true,items:[],approvals:[{number:164,state:"open",url:"https://github.com/Squackle/deep-cuts-edh/issues/164",title:"Intake blocked"}],scheduled:[],deploymentStates:[],errors:[]};
 const summary=renderReport({generated:"fixture",repositories:[r]});
 assert.match(summary,/OPEN — intake\/remediation acceptance still required/);
 assert.match(summary,/Green CodeQL and npm audit are not alert closure/);
 r.approvals[0].state="closed";
 assert.match(renderReport({generated:"fixture",repositories:[r]}),/verify default-branch scanner evidence independently/);
});
