import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cold=read('games/cold-case.html');
const daily=read('games/stackbreaker.html');
const styles=read('games/stackbreaker.css');
const bridge=read('games/stackbreaker-canonical.js');

const header=page=>page.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
const footer=page=>page.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];

test('Daily Stackbreaker inherits the same site shell as Cold Case',()=>{
 for(const path of ['/styles.css','/retro.css','/theme-v2.css','/header-profile.css','/games.css','/release-polish.css']){
  assert.ok(daily.includes('href="'+path+'"'), 'shared stylesheet missing: '+path);
 }
 assert.ok(daily.includes('src="/header-profile.js"'));
 assert.ok(daily.includes('class="site-header"'));
 assert.ok(daily.includes('class="wordmark"'));
 assert.ok(daily.includes('class="primary-nav"'));
 assert.ok(daily.includes('class="site-footer"'));
 assert.equal(header(daily)?.replace('ONE STACK. ONE DAY.','THE SUSPECT IS STILL OUT THERE'),header(cold));
 assert.equal(footer(daily),footer(cold));
 assert.ok(daily.includes('class="games-main'));
 assert.ok(daily.includes('class="games-breadcrumbs"'));
 assert.ok(daily.includes('class="games-masthead'));
 assert.ok(daily.includes('class="games-kicker"'));
 assert.ok(!daily.includes('sb-site-toolbar'), 'do not render the old separate nav/header');
});

test('Daily stays the authentic ranked Classic game, not a template-specific clone',()=>{
 assert.ok(daily.includes('id="stackbreakerOriginal"'));
 assert.ok(daily.includes('/games/stackbreaker-play/?daily=1&amp;siteRanked=1'));
 for(const id of ['rankedRun','rankedRunState','rankedStatus','rankings','refreshLeaderboard','boardTitle','runRule','frameStatus']){
  assert.ok(daily.includes('id="'+id+'"'), 'ranked UI required by canonical bridge: '+id);
 }
 assert.ok(daily.includes('src="/games/stackbreaker-canonical.js"'));
 assert.ok(bridge.includes("event.source!==frame.contentWindow||event.origin!==gameOrigin"));
 assert.ok(bridge.includes("action:'move',seq:ranked.attempt.moves,move:data.move"));
 assert.ok(!bridge.includes('localStorage'));
});

test('Stackbreaker page-specific CSS does not replace the shared site theme',()=>{
 assert.match(styles,/#stackbreakerOriginal\s*\{\s*width:100%/);
 assert.ok(styles.includes('height:calc(100svh - 44px)'));
 assert.ok(styles.includes('height:calc(100svh - 37px)'));
 assert.ok(!/^:root\s*\{/m.test(styles), 'do not override global site variables');
 assert.ok(!/^body\s*\{/m.test(styles), 'do not override global cream paper background');
 assert.ok(!styles.includes('.sb-site-toolbar'), 'do not maintain a second header theme');
 assert.ok(styles.includes('.sb-wide-stage'), 'use wider board inside the same editorial wrapper');
});
