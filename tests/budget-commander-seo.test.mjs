import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('budget-commander-decks.html');
const requiredReports=['commander-mustard','alena-and-gilanra','chainer-dementia-master'];

test('Budget guide is a first-party, accessible, indexable article using the shared site shell',()=>{
 assert.match(page,/<!doctype html>/i);
 assert.match(page,/<title>Budget Commander Deck Ideas & Starter Cores \| Deep Cuts EDH<\/title>/);
 assert.match(page,/<link rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/budget-commander-decks">/);
 assert.equal((page.match(/<h1\b/g)||[]).length,1);
 for(const token of ['class="site-header"','class="site-footer"','class="primary-nav"','src="/header-profile.js"','href="/release-polish.css"','href="/budget-commander-decks.css"'])
  assert.ok(page.includes(token),token);
 assert.doesNotMatch(page,/name="robots"[^>]*noindex|\badsbygoogle\b|\breviewCount\b|\bratingValue\b/);
 assert.ok(fs.existsSync(new URL('../budget-commander-decks.css',import.meta.url)));
});

test('Budget page draws on the three actually published playable-now reports, not the unreleased preview',()=>{
 for(const slug of requiredReports){
  assert.ok(page.includes('href="/reports/'+slug+'"'),'Missing source report link '+slug);
  const report=read('reports/'+slug+'.html');
  assert.ok(report.includes('href="/budget-commander-decks"'),'Source report needs a useful return link: '+slug);
  assert.ok(report.includes('The $100 build challenge'),'Report source budget context lost '+slug);
 }
 assert.match(page,/Ekthi preview/);
 assert.match(page,/not Commander-legal/);
 assert.ok(!page.includes('href="/reports/ekthi-contaminator-priest">Read the'), 'Do not recommend an unreleased build as playable');
});

test('Budget guidance makes no unsupported price or tested-list promises',()=>{
 assert.match(page,/not<\/strong> independently price-checked or playtested 100-card lists/);
 assert.match(page,/target, not a verified checkout total/);
 assert.match(page,/partner commanders leave 98 other cards/);
 assert.match(page,/single commander leaves 99/);
 for(const name of ['Ballyrush Banneret','Preeminent Captain','Captain of the Watch','Lupine Prototype','Phyrexian Soulgorger','Viscera Seer','Carrion Feeder','Gray Merchant of Asphodel']) assert.ok(page.includes(name),name);
 assert.ok(page.includes('prices aren\'t a guaranteed checkout quote'));
});

test('Budget guide has crawlable context links from the homepage, archive, tools and back to useful resources',()=>{
 for(const file of ['index.html','rescues.html','deck.html'])
  assert.ok(read(file).includes('href="/budget-commander-decks"'),file);
 for(const href of ['/library','/deck','/combos','/rescues','/matchmaker','/deep-cut-finder'])
  assert.ok(page.includes('href="'+href+'"'),'Missing useful first-party next step '+href);
 const css=read('budget-commander-decks.css');
 assert.match(css,/@media\(max-width:950px\)/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/:focus-visible/);
 assert.ok(read('scripts/site-release-check.mjs').includes("'budget-commander-decks.html'"),'Release guard must check new public page');
});
