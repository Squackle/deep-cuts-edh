import test from 'node:test';
import assert from 'node:assert/strict';
import publisher,{publish,parseStoredIndex,proposalIssues} from '../workers/weekly-rescue-publisher.js';
const row=(date,commander='Leader')=>({date,commander,theme:'Distinct strategy',headline:'A genuine headline'});
const article=(date,commander='Leader')=>({date,commander:{name:commander},theme:'Distinct strategy',sections:{headline:'A genuine headline'}});
const memory=(entries=[])=>{const map=new Map(entries),writes=[];return {map,writes,async get(k,t){const v=map.get(k)??null;return t==='json'&&v!==null?JSON.parse(v):v},async put(k,v){writes.push(k);map.set(k,v)}}};
const friday=new Date('2026-11-06T16:00:00Z');
test('publisher index rejects corrupt envelopes and invalid dates, preserves unique newest-first rows',()=>{
 assert.deepEqual(parseStoredIndex(null),[]);
 const old=row('2026-10-30'),latest=row('2026-11-20');
 assert.deepEqual(parseStoredIndex(JSON.stringify([old,latest,old])),[latest,old]);
 for(const invalid of ['{','null','{}',JSON.stringify([row('2026-02-31')]),JSON.stringify([row('2026-11-20'),null])])assert.throws(()=>parseStoredIndex(invalid),/Stored report index/);
});
test('corrupt index never becomes a successful empty response or a replacement publication',async()=>{
 const invalid='{"broken":true}',kv=memory([['index',invalid]]);
 let calls=0;
 const env={REPORTS:kv,AI:{async run(){calls++;throw Error('not reached')}}};
 for(const route of ['index','latest']){
  const res=await publisher.fetch(new Request('https://publisher.test/v1/'+route),env);
  assert.equal(res.status,503);assert.equal(res.headers.get('cache-control'),'no-store');
 }
 const result=await publish(env,friday);
 assert.equal(result.status,'held_for_review');assert.match(result.reason,/Stored report index/);
 assert.equal(calls,0);assert.equal(kv.map.get('index'),invalid);assert.ok(!kv.writes.includes('article:2026-11-06'));
});
test('repairing an older article is idempotent and never replaces the latest edition',async()=>{
 const date='2026-11-06',raw=JSON.stringify(article(date,'Older')),latest=row('2026-11-20','Newer');
 const kv=memory([['index',JSON.stringify([latest])],['article:'+date,raw]]);
 const env={REPORTS:kv,AI:{async run(){throw Error('must not regenerate')}}};
 assert.equal((await publish(env,friday)).status,'already_published');
 assert.equal((await publish(env,friday)).status,'already_published');
 assert.equal(kv.map.get('article:'+date),raw);assert.ok(!kv.writes.includes('article:'+date));
 const index=JSON.parse(kv.map.get('index'));
 assert.deepEqual(index.map(x=>x.date),['2026-11-20',date]);
 const res=await publisher.fetch(new Request('https://publisher.test/v1/latest'),env);
 assert.equal((await res.json()).report.commander,'Newer');
 const bad=await publisher.fetch(new Request('https://publisher.test/v1/report?date=2026-02-31'),env);
 assert.equal(bad.status,400);
});
test('outline quality checks reject invented candidates, duplicate evidence and impossible theme before article generation',()=>{
 const pool=[{name:'Real Leader'}],good={commander:'Real Leader',usualBuild:'Control',theme:'Artifact token value',hook:'Try a different plan',selectionReason:'Clear alternative',supportCards:Array.from({length:7},(_,i)=>'Card '+i)};
 assert.deepEqual(proposalIssues(good,pool),[]);
 assert.match(proposalIssues({...good,commander:'Invented',theme:'One two three four five six seven',hook:'infinite mana',supportCards:Array(7).fill('Card A'),selectionReason:''},pool).join('\n'),/nonexistent candidate/);
 const issues=proposalIssues({...good,theme:'One two three four five six seven',hook:'infinite mana',supportCards:Array(7).fill('Card A'),selectionReason:''},pool);
 for(const expected of ['Invalid selectionReason','theme must be 2 to 6 words','theme or hook promises infinite effects','Invalid evidence card list'])assert.ok(issues.includes(expected));
});
