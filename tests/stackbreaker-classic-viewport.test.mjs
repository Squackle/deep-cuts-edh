import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('games/stackbreaker.html');
const css=read('games/stackbreaker.css');
const bridge=read('games/stackbreaker-canonical.js');

test('Daily preserves Classic Stackbreaker dimensions and original game source',()=>{
 assert.ok(page.includes('deep-cuts-game-lab.pages.dev/stackbreaker/?daily=1&amp;siteRanked=1'));
 assert.ok(page.includes('id="stackbreakerOriginal"'));
 assert.ok(css.includes('height:calc(100svh - 44px)'), 'desktop Classic viewport');
 assert.ok(css.includes('height:calc(100svh - 37px)'), 'phone Classic viewport');
 assert.ok(css.includes('min-height:470px'), 'retains Classic minimum');
 assert.ok(css.includes('max-width:1600px'), 'allows original 1560px content width');
 assert.ok(!css.includes('height:880px')&&!css.includes('height:950px'),
  'No unrelated fixed-height Daily board');
});

test('Ranked layout reports never cause repeated shrinking or growth feedback',()=>{
 assert.ok(bridge.includes("data.type==='dc-sb-ranked-layout'"));
 assert.ok(bridge.includes('layoutGrowthUsed=false'));
 assert.ok(bridge.includes('!layoutGrowthUsed&&Number.isInteger(height)'));
 assert.ok(bridge.includes('height>frame.clientHeight+96'),
  'Only meaningful overflow can trigger a single layout expansion');
 assert.ok(bridge.includes('layoutGrowthUsed=true'));
 assert.ok(bridge.includes("frame.style.height=(height+2)+'px'"));
 assert.ok(!bridge.includes('frame.style.height=(height-'), 'No shrink path');
});

test('Only original game move messages reach verified server replay',()=>{
 assert.ok(bridge.includes("event.source!==frame.contentWindow||event.origin!==gameOrigin"));
 assert.ok(bridge.includes("data.type!=='dc-sb-ranked-move'"));
 assert.ok(bridge.includes("action:'move',seq:ranked.attempt.moves,move:data.move"));
 assert.ok(!bridge.includes('localStorage'));
});
