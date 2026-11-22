import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localReleaseWindow} from '../workers/weekly-rescue-publisher.js';

// This is a source-controlled specification, not a configuration that GitHub
// automatically applies to Cloudflare. Deploy it separately and verify readback.
const schedule=JSON.parse(readFileSync(new URL('../workers/weekly-rescue-schedule.json',import.meta.url),'utf8'));
const minutes=[0,15,30,45];

test('Cloudflare schedule uses FRI, not numeric 5 (Thursday)',()=>{
 assert.equal(schedule.worker,'deep-cuts-weekly-publisher');
 assert.equal(schedule.timeZone,'America/Chicago');
 assert.equal(schedule.releaseLocalHour,10);
 assert.deepEqual(schedule.crons,[
  '0,15,30,45 15 * * FRI',
  '0,15,30,45 16 * * FRI'
 ]);
 for(const cron of schedule.crons)assert.match(cron,/^0,15,30,45 (15|16) \* \* FRI$/);
});

test('all Friday schedules yield four valid local 10am releases per week across DST',()=>{
 let weeks=0;
 for(let t=Date.parse('2026-10-30T00:00:00Z');t<=Date.parse('2027-11-26T00:00:00Z');t+=86400000){
  const day=new Date(t);
  if(day.getUTCDay()!==5)continue;
  weeks++;
  const valid=[];
  for(const hour of [15,16])for(const minute of minutes){
   const at=new Date(t+hour*3600000+minute*60000);
   if(localReleaseWindow(at))valid.push(at.toISOString());
  }
  assert.equal(valid.length,4,'Exactly four valid 10am local triggers: '+day.toISOString());
  const expectedHour=valid[0].slice(11,13);
  assert.ok(expectedHour==='15'||expectedHour==='16');
  assert.ok(valid.every(iso=>iso.slice(11,13)===expectedHour));
 }
 assert.ok(weeks>=50);
});

test('historically misconfigured Thursday triggers cannot publish',()=>{
 for(const date of ['2026-11-05','2026-11-12','2027-03-11']){
  for(const hour of [15,16])for(const minute of minutes){
   assert.equal(localReleaseWindow(new Date(date+'T'+String(hour)+':'+String(minute).padStart(2,'0')+':00Z')),false);
  }
 }
 assert.equal(localReleaseWindow(new Date('2026-11-06T16:00:00Z')),true);
 assert.equal(localReleaseWindow(new Date('2026-10-30T15:00:00Z')),true);
});
