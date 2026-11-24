import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {reportHtml} from '../src/weekly-rescues-html.js';
import {EDITORIAL_EDITIONS} from '../src/weekly-rescue-editions.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const checks={
 'commander-mustard':'/games/cold-case',
 'chainer-dementia-master':'/combos',
 'alena-and-gilanra':'/games/mana-heist/',
 'ekthi-contaminator-priest':'/library'
};
function assertDestination(href){
 const path=href.split('#')[0].replace(/^\//,'').replace(/\/$/,'');
 assert.ok(existsSync(path+'.html')||existsSync(path+'/index.html'),href);
}
test('all original reports reserve their card art and link to relevant real public tools',()=>{
 for(const [slug,href] of Object.entries(checks)){
  const html=read('reports/'+slug+'.html');
  const images=[...html.matchAll(/<img src="https:\/\/api\.scryfall\.com\/cards\/named\?[^>]+>/g)].map(m=>m[0]);
  assert.equal(images.length,slug==='alena-and-gilanra'?2:1);
  for(const image of images)assert.match(image,/width="488" height="680"/);
  for(const dest of ['/rescues','/matchmaker',href]){
   assert.ok(html.includes('href="'+dest+'"'),slug+' '+dest);assertDestination(dest);
  }
 }
});
test('weekly SSR and Arcade expose meaningful reciprocal discovery paths',()=>{
 const html=reportHtml(EDITORIAL_EDITIONS[0]);
 for(const dest of ['/matchmaker','/deep-cut-finder','/rescues#budget-commander-ideas','/games']){
  assert.ok(html.includes('href="'+dest+'"'),dest);assertDestination(dest);
 }
 const games=read('games.html');
 assert.match(games,/From puzzles to Commander decks/);
 for(const dest of ['/rescues','/matchmaker'])assert.ok(games.includes('href="'+dest+'"'));
});
