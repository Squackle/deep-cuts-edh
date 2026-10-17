import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const css=readFileSync('home-hub.css','utf8');
test('Homepage is a navigational landing page, not full feature documentation',()=>{
 assert.match(html,/<main id="main">/);
 assert.match(html,/id="directory"/);
 assert.match(html,/id="latest"/);
 assert.match(html,/id="archive"/);
 assert.match(html,/Four mysteries\. <em>Every day\.<\/em>/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.equal((html.match(/class="hub-card /g)||[]).length,8);
 assert.ok(Buffer.byteLength(html)<11500, 'Hub homepage should stay intentionally concise');
 assert.ok(Buffer.byteLength(html)+Buffer.byteLength(css)<22500, 'Combined hub HTML and CSS budget (expanded accessible feature + overview)');
 for(const old of ['process-section','method-grid','home-set-watch','archiveGrid','caseDialog','searchInput','colorFilter','featured-premise','supporter-strip','closing-cta'])
  assert.ok(!html.includes(old),'Removed full-page feature should not render on hub: '+old);
});
test('All destination pages remain reachable from explicit semantic links',()=>{
 const required={
  '/library':'library.html','/deck':'deck.html','/set-watch':'set-watch.html',
  '/games':'games.html','/games/hive-run/':'games/hive-run/index.html',
  '/community':'community.html','/nominations':'nominations.html',
  '/games/cold-case':'games/cold-case.html',
  '/games/obscurity-ladder':'games/obscurity-ladder.html',
  '/games/arcane-cipher':'games/arcane-cipher.html',
  '/games/conspiracy-board':'games/conspiracy-board.html',
  '/reports/commander-mustard':'reports/commander-mustard.html'
 };
 for(const [link,file] of Object.entries(required)){
  assert.ok(existsSync(file),file+' exists');
  assert.ok(html.includes('href="'+link+'"'),link+' is accessible');
 }
 assert.ok(html.includes('href="#latest"'));
 assert.ok(html.includes('href="/#archive"'));
 assert.ok(html.includes('href="#directory"'));
});
test('Homepage loads only the shared lightweight UI scripts',()=>{
 for(const removed of ['app.js','data.js','set-watch.js','site-glossary.js','glossary-terms.js','card-lexicon.js']){
  assert.ok(!html.includes('src="'+removed+'"'),'Unexpected heavy homepage JS: '+removed);
 }
 for(const kept of ['/header-profile.js','/header-tagline.js','/feedback.js']){
  assert.ok(html.includes('src="'+kept+'"'),kept+' retained');
 }
 assert.ok(html.includes('src="https://pagead2.googlesyndication.com/'),'AdSense retained');
 assert.ok(html.includes('href="/home-hub.css"'));
});
test('Branding, indexing, and accessible structure remain',()=>{
 assert.match(html,/<link rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/"/);
 assert.match(html,/<meta name="google-site-verification"/);
 assert.match(html,/<header class="site-header">/);
 assert.match(html,/<nav class="primary-nav"/);
 assert.match(html,/<footer class="site-footer">/);
 for(const id of ['main','directory','latest','archive']) assert.ok(html.includes('id="'+id+'"'));
 assert.match(css,/@media\(max-width:430px\)/);
 assert.match(css,/prefers-reduced-motion/);
});

test('The homepage explains the full site and enlarges the featured card without losing its hover tilt',()=>{
 const selected='Discover the less-played side of Commander with detailed commander breakdowns, a searchable Magic card library, deck and combo research tools, community discussions, Rescue Challenges, and a growing collection of daily MTG games.';
 assert.ok(html.includes('<p>'+selected+'</p>'),'Exact owner-selected overview must appear');
 assert.match(css,/\.hub-feature\{[^\n]*transform:rotate\(1deg\)/);
 assert.match(css,/\.hub-feature:hover\{transform:rotate\(0\) translateY\(-3px\)/);
 assert.match(css,/\.hub-feature\{[^\n]*transition:transform \.2s,box-shadow \.2s/);
 assert.match(css,/\.hub-feature-main\{[^\n]*grid-template-columns:154px minmax\(0,1fr\)/);
 assert.match(css,/\.hub-feature-portrait\{[^\n]*width:154px;height:215px/);
 assert.match(css,/@media\(max-width:430px\)\{\.hub-feature-main\{grid-template-columns:110px/);
 assert.match(html,/href="\/reports\/commander-mustard" aria-label="Read the featured Commander Mustard rescue report"/);
});
