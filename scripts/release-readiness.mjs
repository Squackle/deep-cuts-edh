// Read-only release evidence collector. Public GitHub repositories; optional
// owner-approved read-only Cloudflare credential only on trusted main.
import {appendFileSync,readFileSync,writeFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
import {setTimeout as sleep} from "node:timers/promises";
export const REPOS=[
 {repo:"Squackle/deep-cuts-edh",project:"deep-cuts-edh",required:["release-coordination","site-quality"],gates:[38,87,95,108,151],audit:true},
 {repo:"Squackle/deep-cuts-game-lab-",project:"deep-cuts-game-lab",required:["release-coordination"],gates:[103,343],audit:false}
];
const MAX_PAGES=5;
const good=new Set(["success","neutral","skipped"]);
const bad=new Set(["failure","cancelled","timed_out","action_required","startup_failure","stale"]);
const markdown=s=>String(s??"").replace(/[\r\n|<>]/g," ").replace(/[\u0000-\u001f]/g," ").slice(0,180);
export function latestChecks(checks){
 const latest=new Map();
 for(const c of checks){
  const key=(c.app?.slug??"unknown")+":"+c.name;
  if(!latest.has(key)||Number(c.id)>Number(latest.get(key).id))latest.set(key,c);
 }
 return [...latest.values()];
}
export function assessPR(pr,checks,required,files,peers,{strict=false,mainSha=null,checksKnown=true}={}){
 const latest=latestChecks(checks);
 const status=name=>{
  const candidates=latest.filter(x=>x.name===name);
  if(!candidates.length)return "missing";
  if(candidates.some(c=>c.status==="completed"&&bad.has(c.conclusion)))return "failed";
  if(candidates.some(c=>c.status!=="completed"))return "pending";
  return candidates.every(c=>good.has(c.conclusion))?"pass":"unknown";
 };
 const requiredStates=required.map(name=>({name,state:status(name)}));
 const failures=latest.filter(c=>c.status==="completed"&&bad.has(c.conclusion)).map(c=>({name:c.name,conclusion:c.conclusion,url:c.html_url}));
 const pending=latest.filter(c=>c.status!=="completed").map(c=>c.name);
 const ours=new Set(files??[]);
 const older=peers.filter(p=>p.number<pr.number);
 const overlaps=older.filter(p=>Array.isArray(p.files)).map(p=>({number:p.number,paths:p.files.filter(x=>ours.has(x))})).filter(p=>p.paths.length);
 const unknownOverlap=!Array.isArray(files)||older.some(p=>!Array.isArray(p.files));
 const baseStale=!!(mainSha&&pr.base?.sha!==mainSha);
 const holds=[];
 if(pr.draft)holds.push("draft");
 if(!checksKnown||!requiredStates.length||requiredStates.some(x=>x.state!=="pass"))holds.push("required checks incomplete");
 if(failures.length)holds.push("other check failures");
 if(pending.length)holds.push("checks running");
 if(overlaps.length||unknownOverlap)holds.push(unknownOverlap?"overlap assessment incomplete":"older PR file overlap");
 if(strict&&baseStale)holds.push("base SHA changed");
 if(pr.mergeable===false)holds.push("not mergeable");
 // Never imply authorization or mergeability from a report.
 return {number:pr.number,title:pr.title,head:pr.head.sha,branch:pr.head.ref,base:pr.base?.sha,url:pr.html_url,requiredStates,failures,pending,overlaps,baseStale,holds,technical:holds.length?"HOLD":"REVIEW",approval:"owner release authorization not inferred"};
}
export function previewSafety(project){
 const p=project.deployment_configs?.production??{},v=project.deployment_configs?.preview??{},src=project.source?.config??{};
 const same=(a,b)=>{if(!a||!b)return false;const id=x=>typeof x==="string"?x:x.id??x.namespace_id??x.database_id??null;return id(a)!==null&&id(a)===id(b);};
 const shared=[];
 for(const kind of ["kv_namespaces","d1_databases","r2_buckets","durable_object_namespaces","services"]){
  for(const [name,value] of Object.entries(v[kind]??{})){
   if(Object.values(p[kind]??{}).some(x=>same(x,value)||JSON.stringify(x)===JSON.stringify(value)))shared.push(kind+":"+name);
  }
 }
 const extra=["d1_databases","r2_buckets","services","durable_object_namespaces","env_vars","ai","hyperdrive_bindings","queue_producers","analytics_engine_datasets","vectorize_bindings"].filter(k=>v[k]&&typeof v[k]==="object"&&Object.keys(v[k]).length);
 const issues=[];
 if(src.preview_deployment_setting==="none")issues.push("automatic previews disabled");
 if(shared.length)issues.push("shared production/preview resources");
 if(project.name==="deep-cuts-game-lab"&&extra.length)issues.push("unexpected Lab preview bindings/variables");
 if(src.preview_deployment_setting==="custom"&&(!src.preview_branch_includes?.length||src.preview_branch_includes.some(x=>x.includes("*"))))issues.push("preview branch allowlist is not exact");
 return {mode:src.preview_deployment_setting??"unknown",includes:src.preview_branch_includes??[],excludes:src.preview_branch_excludes??[],shared,extra,issues};
}
async function request(url,headers={},fetcher=fetch){
 let response;
 for(let attempt=0;attempt<2;attempt++){
  response=await fetcher(url,{method:"GET",headers,redirect:"error",signal:AbortSignal.timeout(15000)});
  if(response.status>=500&&attempt===0){await response.body?.cancel();await sleep(500);continue;}
  break;
 }
 if(!response.ok)throw new Error("HTTP "+response.status+" "+new URL(url).pathname);
 return response.json();
}
export function githubClient({token=process.env.GITHUB_TOKEN,own=process.env.GITHUB_REPOSITORY,fetcher=fetch}={}){
 const get=async(repo,path)=>{
  if(!REPOS.some(r=>r.repo===repo))throw Error("unsupported repository");
  const h={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"DeepCutsEDH-readiness"};
  const url="https://api.github.com/repos/"+repo+"/"+path;
  if(token){
   try{return await request(url,{...h,Authorization:"Bearer "+token},fetcher);}
   catch(e){if(repo===own||!/^HTTP (403|404) /.test(e.message))throw e;}
  }
  return request(url,h,fetcher);
 };
 const pages=async(repo,path,key=null)=>{
  const out=[];
  for(let page=1;page<=MAX_PAGES;page++){
   const x=await get(repo,path+(path.includes("?")?"&":"?")+"per_page=100&page="+page);
   const rows=key?x[key]:x;
   if(!Array.isArray(rows))throw Error("unexpected list response");
   out.push(...rows);
   if(rows.length<100)return out;
  }
  throw Error("pagination cap reached; incomplete");
 };
 return {get,pages};
}
async function safe(fn,errors,label){
 try{return await fn();}
 catch(e){errors.push(label+": "+markdown(e.message));return null;}
}
export async function collectRepository(config,client){
 const {repo,required,gates}=config,{get,pages}=client,errors=[];
 const main=await safe(()=>get(repo,"branches/main"),errors,"main");
 const mainSha=main?.commit?.sha??null;
 const rules=await safe(()=>get(repo,"rules/branches/main"),errors,"active main rules");
 const actual=Array.isArray(rules)?rules.filter(x=>x.type==="required_status_checks"):null;
 const contexts=actual?.flatMap(x=>x.parameters?.required_status_checks?.map(c=>c.context)??[])??[];
 const strict=actual?.some(x=>x.parameters?.strict_required_status_checks_policy)??false;
 const requiredNames=contexts.length?[...new Set(contexts)]:required;
 const prs=await safe(()=>pages(repo,"pulls?state=open"),errors,"open PRs")??[];
 const inputs=[];
 // Sequential bounded reads avoid provider abuse and simplify rate-limit behavior.
 for(const pr of prs){
  const files=await safe(()=>pages(repo,"pulls/"+pr.number+"/files"),errors,"PR "+pr.number+" files");
  const checks=await safe(()=>pages(repo,"commits/"+pr.head.sha+"/check-runs?filter=latest","check_runs"),errors,"PR "+pr.number+" checks");
  inputs.push({pr,number:pr.number,files:files?.map(x=>x.filename)??null,checks});
 }
 const items=inputs.map(x=>assessPR(x.pr,x.checks??[],requiredNames,x.files,inputs,{strict,mainSha,checksKnown:!!x.checks}));
 const approvals=[];
 for(const number of gates){
  const issue=await safe(()=>get(repo,"issues/"+number),errors,"issue "+number);
  approvals.push({number,state:issue?.state??"unknown",title:issue?.title??"not verified",url:issue?.html_url??"https://github.com/"+repo+"/issues/"+number});
 }
 const schedules=await safe(()=>pages(repo,"actions/workflows","workflows"),errors,"workflow inventory");
 const scheduledNames=config.audit?["security-daily.yml","arcade-nightly-synthetic.yml","dependency-audit.yml","recovery-rehearsal.yml"]:["lab-live-health.yml","lab-security.yml"];
 const scheduled=[];
 for(const name of scheduledNames){
  const wf=schedules?.find(x=>x.path===".github/workflows/"+name);
  if(!wf){scheduled.push({name,state:schedules?"not on default branch":"unknown"});continue;}
  const runs=await safe(()=>get(repo,"actions/workflows/"+wf.id+"/runs?event=schedule&branch=main&per_page=1"),errors,name+" schedule");
  const latest=runs?.workflow_runs?.[0];
  scheduled.push({name,state:latest?(latest.status==="completed"?latest.conclusion:latest.status):runs?"no scheduled run recorded":"unknown",url:latest?.html_url,sha:latest?.head_sha,at:latest?.created_at,workflowState:wf.state});
 }
 // GitHub provider deployment records are not equivalent to Cloudflare canonical readback.
 const deployments=await safe(()=>get(repo,"deployments?sha="+encodeURIComponent(mainSha??"")+"&per_page=10"),errors,"GitHub deployment records");
 const deploymentStates=[];
 for(const d of (deployments??[]).slice(0,10)){
  const statuses=await safe(()=>get(repo,"deployments/"+d.id+"/statuses?per_page=1"),errors,"deployment "+d.id);
  deploymentStates.push({environment:d.environment,state:statuses?.[0]?.state??"unknown",sha:d.sha,url:statuses?.[0]?.log_url??null});
 }
 return {repo,project:config.project,mainSha,requiredNames,rulesVerified:!!actual?.length&&contexts.length>0,strict,items,approvals,scheduled,deploymentStates,errors};
}
export async function collectCloudflare(project,env=process.env,fetcher=fetch){
 if(!env.CF_READ_TOKEN||!env.CF_ACCOUNT_ID)return {state:"unverified — optional Cloudflare read-only connection not configured"};
 if(!/^[a-f0-9]{32}$/i.test(env.CF_ACCOUNT_ID)||!REPOS.some(x=>x.project===project))return {state:"invalid read-only configuration"};
 const url="https://api.cloudflare.com/client/v4/accounts/"+env.CF_ACCOUNT_ID+"/pages/projects/"+project;
 try{
  const x=await request(url,{Authorization:"Bearer "+env.CF_READ_TOKEN},fetcher);
  if(!x.success||!x.result)return {state:"Cloudflare readback unavailable"};
  const p=x.result,d=p.canonical_deployment;
  return {state:"verified readback",sha:d?.deployment_trigger?.metadata?.commit_hash??null,stage:d?.latest_stage?.name??null,status:d?.latest_stage?.status??null,preview:previewSafety(p)};
 }catch(e){return {state:"Cloudflare readback unavailable"};}
}
export function renderReport(report){
 const lines=["# DeepCutsEDH release readiness","",report.generated,"","Read-only evidence, not merge/deploy authorization. REVIEW means technical checks observed, not approved. Unknown/missing evidence is not a pass."];
 for(const r of report.repositories){
  lines.push("","## "+r.repo,"","Main: "+(r.mainSha??"unknown")+"; required: "+r.requiredNames.join(", ")+" ("+(r.rulesVerified?"rules API":"documented fallback; rules unverified")+"); strict: "+(r.rulesVerified?String(r.strict):"unverified")+".",
   "Canonical Pages: "+markdown(r.cloudflare?.state)+"; "+markdown(r.cloudflare?.sha??"unknown SHA")+"; "+markdown(r.cloudflare?.status??"unknown status")+(r.cloudflare?.sha&&r.mainSha&&r.cloudflare.sha!==r.mainSha?" — SHA MISMATCH":"")+".");
  if(r.cloudflare?.preview)lines.push("Preview: "+markdown(r.cloudflare.preview.mode)+"; "+r.cloudflare.preview.issues.map(markdown).join("; "));
  lines.push("GitHub deployment records for main: "+(r.deploymentStates.length?r.deploymentStates.map(d=>markdown(d.environment)+": "+markdown(d.state)).join("; "):"none available; not proof of deployed SHA"),"",
   "| PR | Exact head | Required checks | Disposition / next step |","|---|---|---|---|");
  for(const p of r.items){
   const required=p.requiredStates.map(x=>markdown(x.name)+": "+x.state).join(", ");
   const details=[...p.holds,...p.failures.map(x=>markdown(x.name)+": "+x.conclusion),...p.overlaps.map(x=>"overlap #"+x.number+" ("+x.paths.map(markdown).join(", ")+")")];
   lines.push("| [#"+p.number+"]("+p.url+") "+markdown(p.title)+" | \`"+p.head+"\` | "+required+" | "+p.technical+": "+(details.join("; ")||"owner approval / verify deployed candidate")+" |");
  }
  lines.push("","### Scheduled checks (latest scheduled run)","");
  for(const s of r.scheduled)lines.push("- "+markdown(s.name)+": "+markdown(s.state)+(s.url?" ([run]("+s.url+"))":"")+(s.at?" — "+s.at:""));
  lines.push("","### Tracked approval / operational gates","");
  for(const a of r.approvals)lines.push("- [#"+a.number+"]("+a.url+") "+markdown(a.state)+" — "+markdown(a.title));
  if(r.errors.length)lines.push("","### Evidence unavailable","",...r.errors.map(e=>"- "+markdown(e)));
 }
 lines.push("","## Dependency advisory evidence","",report.audit?("Current checked-out lockfile ("+markdown(report.audit.revision)+"): "+markdown(report.audit.state)+(report.audit.counts?" — "+JSON.stringify(report.audit.counts):"")):"No fresh npm audit requested. Use latest dependency-audit workflow and #151; do not interpret an absent audit as zero advisories.","","Provider failures and repeated scheduled failures are reported once per check/PR. Inspect exact job logs before changes. No automatic issue creation, retries of red CI, or notifications outside Actions.");
 return lines.join("\n")+"\n";
}
export function auditEvidence(file,revision){
 try{
  const data=JSON.parse(readFileSync(file,"utf8"));
  if(!data.metadata?.vulnerabilities||data.error)return {revision,state:"audit unavailable"};
  const counts=data.metadata.vulnerabilities;
  return {revision,state:counts.total===0?"zero known advisories":"advisories present",counts:{low:counts.low,moderate:counts.moderate,high:counts.high,critical:counts.critical,total:counts.total}};
 }catch{return {revision,state:"audit unavailable"};}
}
export async function main(){
 const client=githubClient(),repositories=[];
 for(const c of REPOS){
  const report=await collectRepository(c,client);
  report.cloudflare=await collectCloudflare(c.project);
  repositories.push(report);
 }
 const report={generated:new Date().toISOString(),repositories,audit:process.env.READINESS_AUDIT_FILE?auditEvidence(process.env.READINESS_AUDIT_FILE,process.env.GITHUB_SHA??"local"):null};
 const summary=renderReport(report);
 console.log(summary);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 if(process.env.READINESS_OUTPUT)writeFileSync(process.env.READINESS_OUTPUT,JSON.stringify(report,null,2)+"\n");
 // A readiness report records known red gates without duplicating their alert.
 // Missing main/PR inventory is a collector failure, not a green snapshot.
 if(repositories.some(r=>!r.mainSha||r.errors.some(e=>e.startsWith("open PRs:"))))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error("Readiness collection failed:",markdown(e.message));process.exitCode=1;});
