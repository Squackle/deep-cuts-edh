import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const page=read('rescues.html');
const sourceReports=['commander-mustard','alena-and-gilanra','chainer-dementia-master'];

test('Budget Commander guide is indexable content on the existing canonical Rescue Reports route',()=>{
 assert.match(page,/<title>Budget Commander Deck Ideas &amp; Weekly Rescue Reports \| Deep Cuts EDH<\/title>/);
 assert.match(page,/<link rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/rescues">/);
 assert.equal((page.match(/<h1\b/g)||[]).length,1);
 for(const part of ['class="site-header"','class="site-footer"','class="primary-nav"',
  'src="/header-profile.js"','src="/weekly-rescues.js"','href="/release-polish.css"',
  'href="/budget-commander-decks.css"','id="weeklyReportList"','id="budget-commander-ideas"','id="weekly"'])
  assert.ok(page.includes(part),'Existing public report template/runtime lost '+part);
 assert.ok(!page.includes('href="/budget-commander-decks"'),'Unshipped route must not be linked');
 assert.ok(!fs.existsSync(new URL('../budget-commander-decks.html',import.meta.url)),'Do not release an unsitemapped duplicate page');
 assert.doesNotMatch(page,/name="robots"[^>]*noindex|\breviewCount\b|\bratingValue\b/);
});

test('Guide relates three real published Commander strategies and links back from those reports',()=>{
 for(const slug of sourceReports){
  assert.ok(page.includes('href="/reports/'+slug+'"'),'Missing source report '+slug);
  const report=read('reports/'+slug+'.html');
  assert.ok(report.includes('href="/rescues#budget-commander-ideas"'),'Missing topical backlink: '+slug);
  assert.ok(report.includes('The $100 build challenge'),slug+' lost editorial pricing caveat');
 }
 assert.match(page,/Ekthi preview/);
 assert.match(page,/not Commander-legal/);
});

test('Budget article avoids unsupported checked-out prices, verified builds and invented rankings',()=>{
 assert.match(page,/not<\/strong> independently price-checked or playtested 100-card lists/);
 assert.match(page,/target, not a verified checkout total/);
 assert.match(page,/partner commanders leave 98 other cards/);
 assert.match(page,/single commander leaves 99/);
 for(const card of ['Ballyrush Banneret','Preeminent Captain','Captain of the Watch',
 'Lupine Prototype','Phyrexian Soulgorger','Viscera Seer','Carrion Feeder','Gray Merchant of Asphodel'])
  assert.ok(page.includes(card),'Missing source-grounded card '+card);
 assert.ok(page.includes("prices aren't a guaranteed checkout quote"));
 assert.doesNotMatch(page,/\b(?:guaranteed|verified) \$100 (?:deck|list)\b/i);
});

test('Existing sitemap, first-party discovery links and mobile/keyboard presentation remain intact',()=>{
 assert.ok(read('index.html').includes('href="/rescues"'),'Homepage link to published Rescue Reports');
 for(const path of ['deck.html',...sourceReports.map(slug=>'reports/'+slug+'.html')])
  assert.ok(read(path).includes('href="/rescues#budget-commander-ideas"'),path);
 for(const href of ['/library','/deck','/combos','/rescues','/matchmaker','/deep-cut-finder'])
  assert.ok(page.includes('href="'+href+'"'),'Missing useful first-party link '+href);
 const css=read('budget-commander-decks.css');
 assert.match(css,/@media\(max-width:950px\)/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.match(css,/:focus-visible/);
 const sitemap=read('sitemap.xml');
 assert.ok(sitemap.includes('<loc>https://deep-cuts-edh.pages.dev/rescues</loc>'));
 assert.ok(!sitemap.includes('budget-commander-decks'),'No unshipped new route in sitemap');
});
