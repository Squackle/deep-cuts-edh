import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequestGet} from '../functions/api/stackbreaker-leaderboard.js';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const page=read('games/stackbreaker.html'),bridge=read('games/stackbreaker-ranked.js');
test('Daily embeds the EXACT launched original Stackbreaker rather than recreating its board',()=>{
 assert.match(page,/src="https:\/\/deep-cuts-game-lab.pages.dev\/stackbreaker\/\?daily=1&amp;siteRanked=1"/);
 assert.ok(page.includes('id="stackbreakerOriginal"'));
 assert.ok(page.includes('id="leaderboard"'));
 assert.ok(page.includes('START MY ONE DAILY RUN'));
 assert.ok(!page.includes('id="hand"')&&!page.includes('id="stack"'));
 assert.ok(!page.includes('/games/stackbreaker.js'));
 assert.ok(bridge.includes("event.origin!==LAB||event.source!==frame.contentWindow"));
 assert.ok(bridge.includes("frame.contentWindow.postMessage(message,LAB)"));
});
test('Server receives only original-engine moves and never a client-submitted claimed win',()=>{
 assert.ok(bridge.includes("action:'move',seq:attempt.moves,move"));
 assert.ok(bridge.includes("action:'start'"));
 assert.ok(bridge.includes('attempt.status'));
 assert.ok(!bridge.includes("action:'submit-score'"));
 assert.ok(!bridge.includes('localStorage'));
 const api=read('functions/api/stackbreaker.js');
 assert.ok(api.includes('INSERT OR IGNORE INTO stackbreaker_daily_attempts_v1'));
 assert.ok(api.includes("row.result!=='started'"));
 assert.ok(api.includes('accepted_moves=?'));
});
test('Public leaderboard fails closed when database unavailable',async()=>{
 const res=await onRequestGet({env:{}});
 assert.equal(res.status,503);
});
test('Inactive verified mode does not expose profile records to public board',async()=>{
 let calls=0;
 const db={prepare(sql){
  calls++;assert.ok(sql.includes('stackbreaker_launch_v1'));
  return {first:async()=>({enabled:0})};
 }};
 const result=await onRequestGet({env:{DB:db}});
 const json=await result.json();
 assert.equal(result.status,200);
 assert.equal(json.active,false);
 assert.deepEqual(json.entries,[]);
 assert.equal(calls,1);
});
test('Public board queries only verified completed wins, ordered by action count',()=>{
 const src=read('functions/api/stackbreaker-leaderboard.js');
 assert.match(src,/a.result='won'/);
 assert.match(src,/a.finished_at IS NOT NULL/);
 assert.match(src,/ORDER BY a.accepted_moves ASC,a.finished_at ASC/);
 assert.match(src,/JOIN community_profiles p ON p.id=a.profile_id/);
 assert.ok(!src.includes('localStorage'));
});
