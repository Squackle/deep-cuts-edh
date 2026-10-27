import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('games/stackbreaker.html');
const css=read('games/stackbreaker.css');
const bridge=read('games/stackbreaker-canonical.js');
test('Daily is a full-width original game served locally, not a replacement mini-game',()=>{
 assert.match(page,/id="stackbreakerOriginal"/);
 assert.match(page,/src="\/games\/stackbreaker-play\/\?daily=1&amp;siteRanked=1"/);
 assert.match(page,/class="sb-runbar"/);
 assert.match(page,/class="sb-board-section"/);
 assert.ok(page.indexOf('id="stackbreakerOriginal"')<page.indexOf('id="rankings"'));
 assert.ok(!page.includes('sb-canonical-layout'),'No game / leaderboard two-column squeeze');
 assert.ok(!page.includes('sb-canonical-intro'),'No redundant game hero');
 assert.equal((page.match(/class="primary-nav"/g)||[]).length,1,'Exactly one site navigation; Lab iframe masthead hidden');
 assert.ok(!page.includes('LOCAL GAME LAB PREVIEW'),'No ranked screen claiming local-only gameplay');
 assert.match(css,/#stackbreakerOriginal\{width:100%;/);
 assert.match(css,/\.sb-ranking-list\{[^}]*grid-template-columns/);
});
test('Only locally served embedded frame can request safe height changes',()=>{
 assert.match(bridge,/event\.source!==frame\.contentWindow\|\|event\.origin!==gameOrigin/);
 assert.ok(bridge.includes("data.type==='dc-sb-ranked-layout'"));
 assert.ok(bridge.includes('Number.isInteger(height)&&height>=500&&height<=3000'));
 assert.ok(bridge.includes("frame.style.height=(height+2)+'px'"));
 assert.ok(bridge.includes('loaded.hidden=true'));
 assert.ok(!bridge.includes("iframe.contentDocument"),'No cross-origin DOM access');
});
test('Only server-replayed owned attempts can change ranked state',()=>{
 assert.ok(bridge.includes("action:'start'"));
 assert.ok(bridge.includes("action:'move',seq:ranked.attempt.moves,move:data.move"));
 assert.ok(bridge.includes("refreshed=await api()"));
 assert.ok(bridge.includes("payload.method!=='SERVER_REPLAY_ONLY'"));
 assert.ok(!bridge.includes("action:'submit-score'"));
 assert.ok(!bridge.includes('localStorage'));
});
