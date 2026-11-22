import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,json} from '../src/member-auth.js';
const token='dcdevice1_'+'a'.repeat(64);
const request=headers=>new Request('https://audit.invalid/api/member-data',{headers});
function fixture(tier='detective',revoked=false){
 const queries=[];
 return {queries,DB:{prepare(sql){queries.push(sql);return {
  bind(){return this},
  async first(){
   if(sql.includes('JOIN member_accounts'))return {id:'synthetic',device_id:'synthetic-device',status:'active',tier};
   if(sql.includes('member_complimentary_grants'))return {tier,expires_at:Math.floor(Date.now()/1000)+3600,revoked_at:revoked?1:null};
   throw Error('Unexpected query');
  },async run(){return {meta:{changes:1}}}
 }}}};
}
test('Regression: explicit invalid membership bearer cannot fall back to another cookie identity',async()=>{
 for(const Authorization of ['Bearer invalid','Basic invalid','']){
  const env=fixture();
  const r=await authorize(request({Authorization,Cookie:'dc_member_device='+token}),env);
  assert.equal(r.error?.status,401);assert.equal(env.queries.length,0);
 }
});
test('Member cookie-only and valid explicit bearer continue to work',async()=>{
 for(const headers of [{Cookie:'dc_member_device='+token},{Authorization:'Bearer '+token}]){
  const env=fixture();const result=await authorize(request(headers),env,'detective');
  assert.equal(result.account.id,'synthetic');assert.equal(result.error,undefined);
 }
});
test('Tier restrictions and revoked grants reject access without updating last-seen',async()=>{
 for(const [tier,revoked] of [['informant',false],['chief',true]]){
  const env=fixture(tier,revoked);const result=await authorize(request({Cookie:'dc_member_device='+token}),env,'detective');
  assert.equal(result.error.status,403);assert.equal(env.queries.some(q=>q.startsWith('UPDATE')),false);
 }
});
test('Malformed member JSON envelopes are rejected before handlers dereference them',async()=>{
 for(const body of ['null','[]','"string"','42'])
  await assert.rejects(json(new Request('https://audit.invalid',{method:'POST',body})),/request/i);
 assert.deepEqual(await json(new Request('https://audit.invalid',{method:'POST',body:'{"action":"list"}'})),{action:'list'});
});
