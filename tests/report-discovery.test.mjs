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

test('original report structured data is truthful and points to the existing canonical article',()=>{
 for(const slug of Object.keys(checks)){
  const html=read('reports/'+slug+'.html'),canonical='https://deep-cuts-edh.pages.dev/reports/'+slug;
  const data=JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(data['@type'],'Article');assert.equal(data.url,canonical);assert.equal(data.mainEntityOfPage['@id'],canonical);
  assert.equal(data.publisher.name,'Deep Cuts EDH');assert.ok(data.headline);
  for(const unsupported of ['aggregateRating','review','datePublished','offers'])assert.ok(!(unsupported in data));
  assert.ok(html.includes('<meta property="og:url" content="'+canonical+'">'));
 }
});
test('Ekthi historical preview is distinguished from official current eligibility without certifying deck drafts',()=>{
 const html=read('reports/ekthi-contaminator-priest.html'),archive=read('rescues.html');
 assert.ok(html.includes('November 13, 2026'));assert.ok(html.includes('https://magic.wizards.com/en/news/feature/whats-inside-mystery-booster-commander-edition'));
 assert.ok(html.includes('https://magic.wizards.com/en/news/feature/mystery-booster-commander-edition-release-notes'));
 assert.doesNotMatch(html,/NOT YET COMMANDER-LEGAL|not yet Commander-legal|scheduled for November 9/);
 assert.equal(JSON.parse(html.match(/<script type="application\/json" id="rescue-data">([^<]+)<\/script>/)[1]).preview,true);
 assert.match(archive,/not independently verified the complete deck or a budget price/);
});
test('evergreen discovery worksheet links to published weekly cases, actual tools and optional signup',()=>{
 const html=read('rescues.html');
 const section=html.match(/<section[^>]+id="discovery-method"[\s\S]*?<\/section>/)?.[0];
 assert.ok(section);
 for(const date of ['2026-10-30',...EDITORIAL_EDITIONS.map(x=>x.date)])assert.ok(section.includes('href="/rescues/'+date+'"'));
 for(const href of ['/matchmaker','/deep-cut-finder','/library','/deck','/subscribe','/nominations']){assert.ok(section.includes('href="'+href+'"'));assertDestination(href)}
 assert.match(section,/not a measured popularity ranking/);
});
