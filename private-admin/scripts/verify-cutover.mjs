// Offline release gate. Input is a sanitized Cloudflare readback JSON file;
// it never calls APIs or writes any database/Access/project resources.
// Example: node scripts/verify-cutover.mjs /path/to/readback.json
import fs from "node:fs";
import {fileURLToPath} from "node:url";
const SYNTHETIC={
 DB:"e1ca9158-1767-49c6-b4db-4ef8626b6b75",
 HIVE_DB:"fda85a95-0613-43a7-898c-baa2ff20b643"
};
const LIVE={
 DB:"5f870895-4281-45d2-b331-45c8182e1079",
 HIVE_DB:"47254394-3679-43f3-9ca3-9a14155d5a17",
 SITE_PRESENCE:"2eef4f0809514ef0a50d5a4e4a817106"
};
const PROJECT="deepcuts-edh-security-staging";
const TEST_BRANCH="security/isolated-test-lane-20261020";
const ADMIN_BRANCH="coord/private-admin-all-phases-prep-20261020";
const fail=reason=>{throw Error("CUTOVER GATE FAILED: "+reason)};
export function verify(snapshot){
 const {project,apps,mode,expected_sha}=snapshot||{};
 if(!project||project.name!==PROJECT)fail("wrong Pages project");
 if(!["synthetic","live"].includes(mode))fail("mode must be synthetic or live");
 const src=project.source?.config||{};
 const include=src.preview_branch_includes||[];
 if(!["custom","specific_branches"].includes(src.preview_deployment_setting))
  fail("custom preview branch control not evidenced");
 if(!include.includes(TEST_BRANCH)||!include.includes(ADMIN_BRANCH))
  fail("both limited preview branches must be included during migration");
 if(include.includes("*")||include.some(x=>x==="main"))
  fail("wildcard or main preview build includes are prohibited");
 const cfg=project.deployment_configs||{};
 for(const name of ["DB","HIVE_DB"]){
  const actual=cfg.preview?.d1_databases?.[name]?.id;
  if(actual!==SYNTHETIC[name])fail("preview "+name+" must use isolated staging D1");
  const prod=cfg.production?.d1_databases?.[name]?.id;
  const expected=mode==="live"?LIVE[name]:SYNTHETIC[name];
  if(prod!==expected)fail("production "+name+" is not at the expected "+mode+" UUID");
 }
 if(mode==="live"){
  if(project.production_branch!==ADMIN_BRANCH)fail("live production branch not admin branch");
  if(cfg.production?.kv_namespaces?.SITE_PRESENCE?.namespace_id!==LIVE.SITE_PRESENCE)
   fail("admin live presence KV must match public site");
  if(cfg.production?.env_vars?.PRIVATE_ADMIN_MODE?.value!=="live"||
    cfg.production?.env_vars?.PRIVATE_ADMIN_ENABLED?.value!=="true")
   fail("admin runtime flags absent");
  if(!expected_sha||project.canonical_deployment?.deployment_trigger?.metadata?.commit_hash!==expected_sha||
    project.canonical_deployment?.latest_stage?.status!=="success")
   fail("Pages production deploy does not match verified admin release SHA");
 }else if(project.production_branch===ADMIN_BRANCH&&
     cfg.production?.env_vars?.PRIVATE_ADMIN_ENABLED?.value==="true"){
  fail("synthetic-only stage should not be enabled as production admin");
 }
 if(!Array.isArray(apps)||apps.length<2)fail("missing canonical/wildcard Access policy evidence");
 for(const domain of [PROJECT+".pages.dev","*."+PROJECT+".pages.dev"]){
  const app=apps.find(x=>x.domain===domain);
  if(!app||app.type!=="self_hosted"||!Array.isArray(app.policies)||app.policies.length!==1)
   fail("Access app and exclusive owner policy required for "+domain);
  const p=app.policies[0];
  if(p.decision!=="allow"||p.include?.length!==1||!p.include[0]?.email?.email||
     (p.exclude||[]).length>0||p.bypass)
   fail("Access policy not restricted to one owner email on "+domain);
 }
 return {ready:true,mode,project:PROJECT,preview:["DB","HIVE_DB"].map(x=>x+": isolated"),
  live:mode==="live",accessVerifiedByPolicyReadback:true};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)fail("usage: node scripts/verify-cutover.mjs snapshot.json");
  const data=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  console.log(JSON.stringify(verify(data),null,2));
 }catch(e){console.error(String(e.message));process.exitCode=1;}
}
