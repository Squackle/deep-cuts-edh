import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('games/mana-heist/index.html');
const hub=read('games.html');
const cold=read('games/cold-case.html');
const css=read('games/mana-heist/site-shell.css');
const js=read('games/mana-heist/site-shell.js');
const extract=(source,tag)=>source.match(new RegExp('<'+tag+' class="site-'+(tag==='header'?'header':'footer')+'"[^>]*>[\\s\\S]*?<\\/'+tag+'>'))?.[0];

test('Mana Heist exists first-party and has a matching Arcade card and play action',()=>{
 assert.match(hub,/<article class="games-feature" data-game="mana-heist">/);
 assert.match(hub,/<h2>Mana Heist<\/h2>/);
 assert.match(hub,/<a class="games-button games-button-primary" href="\/games\/mana-heist\/">PLAY MANA HEIST/);
 assert.match(html,/<meta name="dc-game-source"/);
 assert.match(html,/<script type="module" src="\.\/src\/main\.js">/);
 assert.match(html,/<div id="gameScreen" hidden>/);
 assert.match(html,/<section id="campaignScreen"/);
 assert.ok(!html.includes('<iframe'));
});
test('Mana Heist uses Cold Case header, footer, and editorial Arcade template',()=>{
 const coldHeader=extract(cold,'header')?.replace('THE SUSPECT IS STILL OUT THERE','THE MANA VAULTS');
 assert.equal(extract(html,'header'),coldHeader);
 assert.equal(extract(html,'footer'),extract(cold,'footer'));
 for(const s of ['/styles.css','/retro.css','/theme-v2.css','/header-profile.css','/games.css','/header-profile.js']){
  assert.ok(html.includes(s),'Missing shared dependency: '+s);
 }
 for(const s of ['class="games-breadcrumbs"','class="games-masthead mana-site-masthead"','class="games-main mana-site-main"']){
  assert.ok(html.includes(s),'Missing '+s);
 }
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.ok(html.includes('SOLO · UNRANKED BETA'));
 assert.ok(!html.includes('<header class="bar">'));
});
test('Immersive game keeps the site navigation and supporter header visible',()=>{
 assert.ok(css.includes('body.in-heist .site-header'));
 assert.ok(css.includes('position:fixed!important'));
 assert.ok(css.includes('var(--mana-site-header-h'));
 assert.ok(css.includes('height:calc(100dvh - var(--mana-site-header-h'));
 assert.ok(js.includes('ResizeObserver'));
 assert.ok(js.includes("document.querySelector('.site-header')"));
 assert.ok(!js.includes('localStorage')&&!js.includes('fetch('));
});
