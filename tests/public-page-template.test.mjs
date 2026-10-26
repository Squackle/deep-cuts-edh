import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const expectedLabels=['RESCUE REPORT','COMMANDERS','CARD LIBRARY','TOOLS & RESOURCES','ARCADE','NOMINATIONS','COMMUNITY',"MEMBERS' LOUNGE"];
const pagePaths=['index.html','games.html','games/cold-case.html','games/stackbreaker.html','games/mana-heist/index.html'];
function audit(path){
 const html=read(path);
 for(const css of ['/styles.css','/retro.css','/theme-v2.css','/header-profile.css']){
  assert.ok(html.includes('href="'+css+'"'),path+' missing '+css);
 }
 assert.match(html,/<header\b[^>]*class="site-header"[^>]*>/,path+' missing standard header');
 assert.match(html,/<div class="wrap header-inner">/,path+' missing shared header inner');
 assert.match(html,/<a class="wordmark"/,path+' missing original logo wordmark');
 assert.match(html,/<img src="\/assets\/deep-cuts-mark.svg"/,path+' missing site mark');
 const nav=html.match(/<nav\b[^>]*class="primary-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(nav,path+' missing fallback primary nav');
 for(const link of expectedLabels)assert.ok(nav.includes(link),path+' missing '+link);
 assert.match(html,/<script[^>]+src="\/header-profile\.js"/,path+' missing profile and supporter system');
 assert.match(html,/<footer\b[^>]*class="site-footer"[^>]*>/,path+' missing standard footer');
}
test('main site and all public Arcade pages use the exact shared template primitives',()=>{
 for(const path of pagePaths)audit(path);
});
test('every new public HTML page is checked against the site template contract',()=>{
 let base=process.env.DC_TEMPLATE_BASE_SHA||'';
 if(!base)return;
 const files=execFileSync('git',['diff','--name-only','--diff-filter=A',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const path of files){
  if(!/\.html$/.test(path))continue;
  if(/^(?:tests\/|scripts\/|\.github\/|assets\/)/.test(path))continue;
  const html=read(path);
  if(/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/.test(html))continue;
  if(/^google[a-f0-9]+\.html$/.test(path))continue;
  audit(path);
 }
});
test('owner instructions explicitly require the shared header on every new page',()=>{
 const instructions=read('AGENTS.md'),lanes=read('docs/DEVELOPMENT-LANES.md');
 assert.match(instructions,/Mandatory main-site page template/);
 assert.match(instructions,/Every public page or game added/);
 assert.match(lanes,/Every newly added public main-site HTML route/);
});
