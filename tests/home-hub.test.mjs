import test from 'node:test';
import "./guest-session.test.mjs";
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
 assert.ok(html.includes('href="/home-styles.css"'));
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

test('Desktop feature expands only into the right gutter without shifting its grid origin',()=>{
 assert.match(css,/@media\(min-width:1229px\)\{\.hub-page \.hub-feature-stage\{width:calc\(100% \+ clamp\(0px, calc\(50vw - 614px\), 240px\)\)\}/);
 assert.match(css,/\.hub-feature-stage\{position:relative;isolation:isolate;min-width:0\}/);
 assert.match(css,/\.hub-feature\{[^\n]*transform:rotate\(1deg\);transition:transform \.2s/);
 assert.match(css,/\.hub-feature:hover\{transform:rotate\(0\) translateY\(-3px\)/);
 assert.match(css,/@media\(max-width:980px\)/);
});

test("PageSpeed changes stabilize homepage layout without touching AdSense or authentication",()=>{
 const stability=readFileSync('home-stability.css','utf8');
 assert.match(html,/<script>document\.documentElement\.classList\.add\("dc-js"\)<\/script>/);
 assert.match(html, /href="\/home-stability\.css"/);
 assert.match(stability,/site-header:not\(:has\(>\.site-supporter-strip\)\)::after/);
 assert.match(stability,/header-inner:not\(\.header-profile-enabled\)/);
 assert.match(stability,/hub-card-top\{color:#435b47\}/);
 assert.match(stability,/hub-card-desc.*#455c49/);
 assert.match(html,/Commander%20Mustard&amp;format=image&amp;version=small/);
 assert.match(html,/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
 assert.match(html,/name="google-site-verification"/);
 assert.match(html,/name="follow.it-verification-code"/);
});

test('Residual homepage navigation and report badges meet WCAG AA contrast',()=>{
 const stability=readFileSync('home-stability.css','utf8');
 for(const rule of [
  /\.hub-page \.hub-case-number\{color:#3f5d43\}/,
  /\.hub-page \.hub-index-note\{color:#455a43\}/,
  /\.hub-page :is\(\.hub-directory,\.hub-reports\) \.hub-eyebrow\{color:#455d45\}/,
  /dc-home-nav-handoff 1ms 1\.25s backwards/,
  /prefers-reduced-motion:reduce/
 ])assert.match(stability,rule);
 const l=hex=>{
  const v=hex.match(/[a-f0-9]{2}/gi).map(c=>parseInt(c,16)/255)
   .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return v[0]*.2126+v[1]*.7152+v[2]*.0722;
 };
 const ratio=(a,b)=>(Math.max(l(a),l(b))+.05)/(Math.min(l(a),l(b))+.05);
 for(const [fg,bg] of [
  ['3f5d43','e7ede1'],['455a43','eee9d8'],
  ['455d45','eee9d8'],['455d45','f9f6eb']
 ])assert.ok(ratio(fg,bg)>=4.5,`Contrast below WCAG AA: #${fg} on #${bg}`);
});

test('Home CSS bundle preserves every source exactly in cascade order',()=>{
 const assets=['styles.css','retro.css','theme-v2.css','header-profile.css',
  'release-polish.css','home-hub.css','rescue-subscribe.css',
  'feedback.css','home-stability.css','site-presence.css'];
 const bundle=readFileSync('home-styles.css','utf8');
 assert.equal((html.match(/<link rel="stylesheet"/g)||[]).length,1,
  'Homepage should issue one render-blocking author CSS request');
 let previous=-1;
 for(let i=0;i<assets.length;i++){
  const name=assets[i],marker='/* SOURCE: '+name+' */\\n';
  const start=bundle.indexOf(marker);
  assert.ok(start>previous,'CSS cascade order changed at '+name);
  const from=start+marker.length;
  const end=i===assets.length-1?bundle.length:bundle.indexOf('/* SOURCE: '+assets[i+1]+' */');
  assert.ok(end>from,'Missing following CSS boundary '+name);
  assert.equal(bundle.slice(from,end).trim(),readFileSync(name,'utf8').trim(),
   'Bundled CSS has drifted from '+name);
  previous=start;
 }
 for(const name of assets)assert.equal(html.includes('href="/'+name+'"'),false,'Redundant CSS request '+name);
 assert.ok(html.includes('src="https://pagead2.googlesyndication.com/'),
  'Preserve owner-approved AdSense script');
});

test('Supporter ticker measures its duplicated strip without a second forced reflow',()=>{
 const ticker=readFileSync('header-profile.js','utf8');
 assert.match(ticker,/const pixels=repeats\*tileWidth;/);
 assert.doesNotMatch(ticker,/group\.getBoundingClientRect\(\)\.width/);
});

test("Homepage public-presence badge ships CSS only once and preserves security headers",()=>{
 const mw=readFileSync("functions/_middleware.js","utf8");
 const headers=readFileSync("_headers","utf8");
 assert.match(mw,/const HOME_BADGE=/);
 assert.match(mw,/path==="\/"\|\|path==="\/index\.html"\?HOME_BADGE:PUBLIC_BADGE/);
 assert.match(mw,/const PUBLIC_BADGE=.*site-presence\.css/);
 assert.match(headers,/\/\n  Cross-Origin-Opener-Policy: same-origin-allow-popups/);
 assert.match(headers,/Strict-Transport-Security: max-age=31536000/);
 assert.match(headers,/Content-Security-Policy: frame-ancestors/);
});
