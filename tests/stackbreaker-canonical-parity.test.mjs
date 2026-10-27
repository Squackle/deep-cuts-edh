import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
test('Daily embeds exact original launched game rather than a simplified clone',()=>{
 const html=read('games/stackbreaker.html');
 assert.ok(html.includes('deep-cuts-game-lab.pages.dev/stackbreaker/?daily=1&amp;siteRanked=1'));
 assert.ok(html.includes('id="stackbreakerOriginal"'));
 assert.ok(html.includes('id="rankings"'));
 assert.ok(html.includes('id="rankedRun"'));
 assert.ok(html.includes('src="/games/stackbreaker-canonical.js"'));
 assert.ok(!html.includes('id="castForm"'));
 assert.ok(!html.includes('id="hand"'));
 assert.ok(!html.includes('id="lands"'));
});
test('Ranked replay is sourced from independent website server, never messages or local score',()=>{
 const source=read('games/stackbreaker-canonical.js');
 assert.ok(source.includes("event.source!==frame.contentWindow||event.origin!==gameOrigin"));
 assert.ok(source.includes("data.type!=='dc-sb-ranked-move'"));
 assert.ok(source.includes("action:'move',seq:ranked.attempt.moves,move:data.move"));
 assert.ok(source.includes("type:'dc-sb-ranked-state'"));
 assert.ok(source.includes("credentials:'same-origin'"));
 assert.doesNotMatch(source,/localStorage\.(?:getItem|setItem)/);
 assert.ok(!source.includes('claim-win'));
 assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',new URL('../games/stackbreaker-canonical.js',import.meta.url).pathname],{stdio:'pipe'}));
});
test('Anonymous leaderboard reads server-replayed wins only; one attempt remains owner scoped',()=>{
 const api=read('functions/api/stackbreaker.js');
 assert.ok(api.includes("url.searchParams.get('view')==='leaderboard'"));
 assert.ok(api.includes("a.result='won'"));
 assert.ok(api.includes("a.source_sha=?"));
 assert.ok(api.includes("a.utc_date=?"));
 assert.ok(api.includes("ORDER BY a.accepted_moves ASC,a.finished_at ASC"));
 assert.ok(api.includes("method:'SERVER_REPLAY_ONLY'"));
 assert.ok(api.includes("action==='start'"));
 assert.ok(api.includes("accepted_moves=? AND result='started'"));
 assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',new URL('../functions/api/stackbreaker.js',import.meta.url).pathname],{stdio:'pipe'}));
});
