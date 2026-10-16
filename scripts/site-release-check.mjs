// Review gate for the single site-quality + consistent-navigation release.
// Read-only: rejects broken SEO, unexpected menu labels, missing pages, or dropped games.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),exists=p=>fs.existsSync(p);
const root='https://deep-cuts-edh.pages.dev';
const main=['index.html','games.html','community.html','deck.html','library.html','nominations.html','supporters.html','set-watch.html','privacy.html','deep-cut-finder.html','binder-to-brew.html','combos.html','profile.html'];
const extra=['members.html','404.html'];
const children=dir=>fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.html')).map(x=>dir+'/'+x.name);
const publicPages=[...main,...children('games'),...children('reports')];
const menuPages=[...new Set([...publicPages,...extra])];
const expected=['RESCUE REPORT','COMMANDERS','CARD LIBRARY','TOOLS & RESOURCES','ARCADE','NOMINATIONS','COMMUNITY',"MEMBERS' LOUNGE"];
let checks=0;
function check(ok,msg){assert.ok(ok,msg);checks++;}
for(const file of publicPages){
 const html=read(file);
 const clean=file==='index.html'?root+'/':root+'/'+file.slice(0,-5);
 check(html.includes('<link rel="canonical" href="'+clean+'">'),file+': bad canonical URL');
 check(!/https:\/\/deep-cuts-edh\.pages\.dev\/[^"<> ]+\.html/.test(html),file+': absolute .html redirect URLs remain');
 check((html.match(/<h1\b/gi)||[]).length===1,file+': exactly one h1 needed');
 check(html.includes('href="/release-polish.css"'),file+': release stylesheet missing');
}
for(const file of menuPages){
 const html=read(file);
 const nav=html.match(/<nav\b[^>]*class="primary-nav"[^>]*>[\s\S]*?<\/nav>/i);
 check(!!nav,file+': primary navigation missing');
 const labels=[...nav[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(x=>x[1].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim().replaceAll('&amp;','&'));
 check(JSON.stringify(labels)===JSON.stringify(expected),file+': inconsistent menu: '+labels.join(' / '));
}
const html=read('index.html');
check(html.includes('Four mysteries. <em>Every day.</em>'),'Homepage shows obsolete daily-game total');
for(const name of ['cold-case','obscurity-ladder','arcane-cipher','conspiracy-board']){
 check(html.includes('href="/games/'+name+'"'),'Missing homepage shortcut: '+name);
 check(exists('games/'+name+'.html'),'Missing playable game: '+name);
}
check(html.includes('href="/games/hive-run/"'),'Homepage drops Hive Run');
check(exists('games/hive-run/index.html'),'Hive Run missing');
check(read('games/hive-run/index.html').includes('<link rel="canonical" href="'+root+'/games/hive-run/">'),'Hive Run canonical missing');
check(exists('_redirects')&&read('_redirects').includes('/games/index.html /games 301'),'Arcade legacy URL must permanently redirect');
check(read('games.html').includes('HIVE RUN')||read('games.html').includes('Hive Run'),'Arcade entry missing');
check(read('games.html').includes('<h1>THE <em>ARCADE.</em></h1>'),'Arcade hub heading incorrect');
check(read('index.html').includes('<strong>Arcade</strong>'),'Homepage Arcade tile missing');
check(read('index.html').includes('ENTER THE ARCADE'),'Homepage Arcade CTA missing');
for(const tab of ['cases','decks'])check(read('community.html').includes('data-tab="'+tab+'"'),'Community onboarding lacks '+tab);
check(read('community.html').includes('href="/profile"'),'Community must link to My Profile');
check(read('community.html').includes('Choose your first assignment.'),'Community onboarding absent');
check(read('profile.html').includes('data-community-page="profile"'),'Missing separate personal profile dashboard');
check(!read('community.html').includes('id="registerForm"'),'Public Community still embeds sign-in and recovery forms');
check(!read('community.html').includes('id="collectionItems"'),'Public Community still embeds private card inventory');
check(!read('community.html').includes('id="dispatchList"'),'Public Community still embeds private dispatches');
check(!read('community.html').includes('Free profiles use their own recovery keys.'),'Obsolete recovery-key disclaimer remains');
for(const id of ['registerForm','editProfileForm','ownProfile','collectionItems','dispatchList','profileOverviewSignedOut','profileOverviewSignedIn']){
 check(read('profile.html').includes('id="'+id+'"'),'Profile dashboard missing '+id);
}
check(read('profile.html').includes('name="robots" content="noindex,follow"'),'Profile settings should be noindex');
check(read('header-profile.js').includes('const ACCOUNT_URL="/profile"'),'Avatar must link to dedicated profile page');
check(read('community.js').includes('location.replace("/profile"+location.hash)'),'Legacy private Community bookmarks must migrate');

check(read('404.html').includes('<h1>That commander is <em>very</em> obscure.</h1>'),'404 heading not fixed');
check(read('header-profile.js').includes('"ARCADE"'),'Mobile shortcut label inconsistent');
check(!read('header-profile.js').includes('"DAILY GAMES"'),'Old mixed game navigation label persists');
const sitemap=read('sitemap.xml');
check(!/<loc>[^<]+\.html<\/loc>/.test(sitemap),'Sitemap contains redirects');
for(const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)){
 const u=m[1];check(u.startsWith(root+'/'),'Sitemap domain mismatch: '+u);
 const slug=u.slice(root.length).replace(/^\//,'').replace(/\/$/,'');
 if(slug)check(exists(slug+'.html')||exists(slug+'/index.html'),'Sitemap URL has no file: '+slug);
}
const robots=read('robots.txt');
for(const p of ['/api/','/members','/member-operations','/diagnostics'])check(robots.includes('Disallow: '+p),'Robots missing '+p);
const headers=read('_headers');
for(const key of ['Content-Security-Policy:','frame-ancestors','X-Frame-Options: DENY','X-Content-Type-Options: nosniff','Permissions-Policy:','Strict-Transport-Security:'])check(headers.includes(key),'Header missing '+key);
check(exists('functions/api/arcane-games.js'),'Missing Arcane games server');
check(exists('functions/api/daily-games.js'),'Missing existing daily games server');
check(exists('functions/_middleware.js'),'Missing verified-member ad filtering');
console.log('PASS: '+checks+' site-wide quality, navigation, and regression-contract checks');
