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

test('approved cinematic home prioritizes both game modes and collapses local tools',()=>{
 const menuCss=read('games/mana-heist/cinematic-menu.css');
 const parts=['vault-hall.svg','mana-study.svg','mana-vault.svg'];
 for(const file of parts){
  const asset=read('games/mana-heist/'+file);
  assert.ok(asset.includes('<svg'),'Missing cinematic vector art: '+file);
 }
 assert.ok(html.includes('<link rel="stylesheet" href="./cinematic-menu.css">'));
 assert.ok(html.includes('id="mana-site-title">MANA HEIST</h1>'));
 assert.ok(html.includes('class="mana-hero-lead"'));
 assert.match(html,/<button[^>]*class="mode-option"[^>]*data-mode="learn"/);
 assert.match(html,/<button[^>]*class="mode-option"[^>]*data-mode="heist"/);
 assert.equal((html.match(/class="mana-choice-scene"/g)||[]).length,2);
 const tools=html.slice(html.indexOf('<details class="mana-advanced-tools"'),html.indexOf('<div id="gameScreen" hidden>'));
 assert.ok(tools,'Local utilities are grouped behind one collapsed drawer');
 for(const id of ['playtestPanel','deviceQa','guestBackupPanel','guestMilestonesPanel','reducedFxToggle']){
  assert.ok(tools.includes('id="'+id+'"') || (id==='deviceQa'&&tools.includes('class="device-qa"')),id+' missing from tools');
 }
 assert.ok(!html.includes('<details class="mana-advanced-tools" id="manaAdvancedTools" open'),'Tools must start collapsed');
 assert.ok(menuCss.includes('.mode-options'));
 assert.ok(menuCss.includes('grid-template-columns:1fr!important'),'Mobile should stack the two menu cards');
 assert.ok(menuCss.includes(':not(.in-heist)'),'Menu styles cannot override immersive gameplay');
 assert.ok(html.includes('This game does not submit profile scores.'));
});

test('owner-approved painting is served verbatim as the desktop menu, with painted responsive crops',()=>{
 const menuCss=read('games/mana-heist/cinematic-menu.css');
 assert.match(html,/<div class="mana-approved-stage">[\s\S]*?<img src="\.\/approved-mana-heist-hall\.webp" alt="" width="1586" height="992"/);
 for(const [p,bytes] of [
  ['approved-mana-heist-hall.webp',167060],
  ['approved-mana-ambient.webp',22462],
  ['approved-mana-study.webp',16006],
  ['approved-mana-vault.webp',20066]
 ]){
  assert.equal(fs.statSync(new URL('../games/mana-heist/'+p,import.meta.url)).size,bytes,p+' has changed unexpectedly');
 }
 assert.ok(menuCss.includes('aspect-ratio:1586/792'),'The painted desktop image must end before its baked-in utility strip');
 assert.ok(menuCss.includes('.mana-approved-art img'),'The real approved painting should be presented as an image');
 assert.ok(menuCss.includes('approved-mana-study.webp'),'Mobile learning card should use the painted crop');
 assert.ok(menuCss.includes('approved-mana-vault.webp'),'Mobile vault card should use the painted crop');
 assert.ok(menuCss.includes('approved-mana-ambient.webp'),'Mobile room background must use the approved painting');
 assert.ok(menuCss.includes('mode-option:focus-visible'),'Interactive hotspots need a visible keyboard focus');
 assert.ok(menuCss.includes('min-width:981px'),'Desktop painted layout should leave narrower touch screens readable');
 assert.ok(menuCss.includes('.mana-advanced-tools'),'The real tools drawer should remain a functioning native details element');
 assert.ok(html.includes('<button type="button" class="mode-option" data-mode="learn"'));
 assert.ok(html.includes('<button type="button" class="mode-option" data-mode="heist"'));
});
