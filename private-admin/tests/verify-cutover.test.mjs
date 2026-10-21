import test from "node:test";
import assert from "node:assert/strict";
import {verify} from "../scripts/verify-cutover.mjs";
const app="deepcuts-edh-security-staging.pages.dev";
const testDB="e1ca9158-1767-49c6-b4db-4ef8626b6b75";
const testHive="fda85a95-0613-43a7-898c-baa2ff20b643";
const liveDB="5f870895-4281-45d2-b331-45c8182e1079";
const liveHive="47254394-3679-43f3-9ca3-9a14155d5a17";
const branchA="security/isolated-test-lane-20261020";
const branchB="coord/private-admin-all-phases-prep-20261020";
function snapshot(mode="synthetic"){
 const prod=mode==="live";
 return {
  mode,expected_sha:"012345abcdef",
  project:{
   name:"deepcuts-edh-security-staging",
   production_branch:prod?branchB:"coord/isolate-security-staging-20261019",
   source:{config:{preview_deployment_setting:"custom",preview_branch_includes:[branchA,branchB]}},
   deployment_configs:{
    preview:{d1_databases:{DB:{id:testDB},HIVE_DB:{id:testHive}}},
    production:{
     d1_databases:{DB:{id:prod?liveDB:testDB},HIVE_DB:{id:prod?liveHive:testHive}},
     kv_namespaces:prod?{SITE_PRESENCE:{namespace_id:"2eef4f0809514ef0a50d5a4e4a817106"}}:{},
     env_vars:prod?{PRIVATE_ADMIN_MODE:{type:"plain_text",value:"live"},PRIVATE_ADMIN_ENABLED:{type:"plain_text",value:"true"}}:{}
    }
   },
   canonical_deployment:{deployment_trigger:{metadata:{commit_hash:"012345abcdef"}},latest_stage:{status:"success"}}
  },
  apps:[app,"*."+app].map(domain=>({domain,type:"self_hosted",policies:[{
   decision:"allow",include:[{email:{email:"owner@example.invalid"}}],exclude:[]
  }]}))
 };
}
test("Phase 1 synthetic readiness snapshot is accepted",()=>{
 assert.equal(verify(snapshot()).mode,"synthetic");
});
test("Phase 4 live snapshot with isolated previews and exact SHA is accepted",()=>{
 assert.equal(verify(snapshot("live")).ready,true);
});
test("Fails closed if preview accidentally binds live member D1",()=>{
 const x=snapshot("live");
 x.project.deployment_configs.preview.d1_databases.DB.id=liveDB;
 assert.throws(()=>verify(x),/preview DB/);
});
test("Fails closed if wildcard previews enabled",()=>{
 const x=snapshot();x.project.source.config.preview_branch_includes=["*"];
 assert.throws(()=>verify(x),/preview branches|wildcard/);
});
test("Fails closed if Access wildcard lacks owner policy",()=>{
 const x=snapshot();x.apps.pop();
 assert.throws(()=>verify(x),/Access app/);
});
test("Fails closed if Access permits bypass",()=>{
 const x=snapshot();x.apps[0].policies[0].decision="bypass";
 assert.throws(()=>verify(x),/Access policy/);
});
test("Fails closed if deploy SHA mismatches",()=>{
 const x=snapshot("live");x.project.canonical_deployment.deployment_trigger.metadata.commit_hash="wrong";
 assert.throws(()=>verify(x),/deployment.*SHA/);
});
test("Fails closed when public project mistaken for admin project",()=>{
 const x=snapshot();x.project.name="deep-cuts-edh";
 assert.throws(()=>verify(x),/wrong Pages project/);
});
