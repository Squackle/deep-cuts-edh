import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {VERSION} from '../games/mana-heist/src/engine.js';
import {LEVELS} from '../games/mana-heist/src/levels.js';
import {DECISION_LADDER} from '../games/mana-heist/src/decision-ladder.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('docs/MANA-HEIST-PROMOTION-20261026.json'));
test('first-party Mana Heist runtime is byte-identical to the tested Lab source',()=>{
 assert.equal(manifest.labSourceSha,'32484ba31b391a3ffc83442fb4fa72d68acf2fd0');
 assert.equal(VERSION,manifest.engineVersion);
 for(const [file,expected] of Object.entries(manifest.runtimeSources)){
  assert.equal(createHash('sha256').update(read('games/mana-heist/'+file)).digest('hex'),expected,file+' diverged from Lab');
 }
 assert.equal(LEVELS.length,500);assert.equal(new Set(LEVELS.map(p=>p.id)).size,500);
 assert.deepEqual(LEVELS.slice(0,18).map(p=>p.id),Array.from({length:18},(_,i)=>'mh-'+String(i+1).padStart(2,'0')));
 assert.equal(DECISION_LADDER.length,5);assert.ok(DECISION_LADDER.every(p=>!LEVELS.some(l=>l.id===p.id)));
});
test('game shell uses production navigation and assets with truthful unranked metadata',()=>{
 const html=read('games/mana-heist/index.html');
 assert.match(html,/<title>Mana Heist.*Deep Cuts EDH<\/title>/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
 assert.match(html,/https:\/\/deep-cuts-edh.pages.dev\/games\/mana-heist\//);
 assert.match(html,/href="\/games"/);assert.match(html,/\/assets\/favicon.svg/);
 assert.match(html,/SOLO · UNRANKED BETA/);assert.match(html,/does not submit profile scores/);
 assert.doesNotMatch(html,/\/lab\/|<iframe|id="gameProfileBridge"/);
 for(const match of html.matchAll(/(?:src|href)="\.\/([^"?#]+)"/g))assert.ok(existsSync(new URL('../games/mana-heist/'+match[1],import.meta.url)),match[1]);
});
test('Arcade discovery and canonical route retain all existing games',()=>{
 const hub=read('games.html'),sitemap=read('sitemap.xml');
 assert.match(hub,/href="\/games\/mana-heist\/"/);assert.match(sitemap,/<loc>https:\/\/deep-cuts-edh.pages.dev\/games\/mana-heist\/<\/loc>/);
 for(const route of ['hive-run/','stackbreaker','cold-case','obscurity-ladder','arcane-cipher','conspiracy-board'])assert.ok(hub.includes('href="/games/'+route+'"'),route);
 assert.match(read('_redirects'),/\/games\/mana-heist \/games\/mana-heist\/ 301/);
 for(const file of ['readiness.html','mana-engine-test.html'])assert.match(read('games/mana-heist/'+file),/name="robots" content="noindex,follow"/);
});
test('promotion does not import Lab director controls or public score authority',()=>{
 for(const file of Object.keys(manifest.runtimeSources))assert.doesNotMatch(read('games/mana-heist/'+file),/DIRECTOR_ONLY|\/api\/leaderboard|HIVE_DB|fetch\(/);
 assert.ok(!existsSync(new URL('../functions/api/mana-heist.js',import.meta.url)));
 assert.match(read('games/mana-heist/src/main.js'),/dc-mana-heist-landfall-v2/);
 assert.match(read('games/mana-heist/src/guest-backup.js'),/deep-cuts-mana-heist-guest-backup/);
});

test('promoted game has no committed workstation or dependency symlinks',()=>{
 const entries=execFileSync('git',['ls-files','--stage','games/mana-heist'],{encoding:'utf8'});
 assert.doesNotMatch(entries,/^120000 /m);
});
