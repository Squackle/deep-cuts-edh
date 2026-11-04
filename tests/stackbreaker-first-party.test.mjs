import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {utcDay,approvedDailyEntry,boundScenario,replayServerMoves} from '../src/stackbreaker-verify/server-replay.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('games/stackbreaker.html'),game=read('games/stackbreaker-play/index.html');
const bridge=read('games/stackbreaker-canonical.js'),headers=read('_headers');
test('Daily loads an independently hosted full Classic bundle from same site',()=>{
 assert.match(page,/src="\/games\/stackbreaker-play\/\?daily=1&amp;siteRanked=1"/);
 assert.ok(!page.includes('src="https://deep-cuts-game-lab.pages.dev/stackbreaker/?daily=1&amp;siteRanked=1"'));
 for(const id of ['id="scenarioSelect"','id="lands"','id="hand"','id="stack"','id="passButton"','id="undoButton"','id="dailyBanner"'])
  assert.ok(game.includes(id),'Full Classic element missing '+id);
 assert.ok(game.includes("type:'dc-sb-ranked-ready'"));
 assert.ok(game.includes("type:'dc-sb-ranked-move'"));
 assert.ok(game.includes("data.type==='dc-sb-ranked-state'"));
 assert.ok(!game.includes('/lab/presence.css')&&!game.includes('/lab/presence.js'),'No Game Lab runtime dependencies');
 assert.ok(game.includes('<meta name="robots" content="noindex,nofollow">'));
 assert.ok(!game.includes('window.parent.postMessage(message,siteParentOrigin()||\'*\')'));
});
test('Same-origin message bridge and narrow same-origin frame exception',()=>{
 assert.ok(bridge.includes('gameOrigin!==window.location.origin'));
 assert.ok(bridge.includes('event.source!==frame.contentWindow||event.origin!==gameOrigin'));
 assert.ok(game.includes('const siteOriginAllowed=origin=>origin===window.location.origin'));
 assert.ok(game.includes('window.parent.postMessage(message,window.location.origin)'));
 assert.match(headers,/\/games\/stackbreaker-play\/\*[\s\S]*?X-Frame-Options: SAMEORIGIN/);
 assert.match(headers,/\/games\/stackbreaker-play\/\*[\s\S]*?Content-Security-Policy: frame-ancestors 'self'/);
 assert.match(headers,/\/\*[\s\S]*?X-Frame-Options: DENY/);
});
test('Practice stays local, official moves are replayed by the server and campaign stars are separate',()=>{
 assert.ok(game.includes("if(siteRanked&&scoredDaily())"));
 assert.ok(game.includes("if(!dailyRoute){"), 'Classic progress must only update outside daily mode');
 assert.ok(game.includes("const progressKey='dc-stackbreaker-progress-v3'"));
 assert.ok(game.includes('dc-stackbreaker-daily-local-v1'));
 assert.ok(bridge.includes("action:'move',seq:ranked.attempt.moves,move:data.move"));
 assert.ok(!bridge.includes('localStorage'));
 assert.equal(utcDay('2026-10-27T23:59:59.000Z'),'2026-10-27');
 assert.equal(utcDay('2026-10-28T00:00:00.000Z'),'2026-10-28');
 const entry=approvedDailyEntry('2026-10-27');
 assert.ok(entry,'Pinned October 27 puzzle is available');
 const scene=boundScenario(entry);
 assert.ok(scene);
 assert.equal(replayServerMoves(scene,[]).state.status,'playing');
 assert.throws(()=>replayServerMoves(scene,[{type:'claim-win',score:999999}]));
});
