import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('games/stackbreaker/classic/index.html');
const game=read('games/stackbreaker/classic/play.html');
const hub=read('games.html'),daily=read('games/stackbreaker.html'),headers=read('_headers');
const header=x=>x.match(/<header class="site-header">[\s\S]*?<\/header>/)?.[0];
const footer=x=>x.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
test('Classic route adopts exact shared site header/footer and navigation',()=>{
 assert.equal(header(page)?.replace('THE CLASSIC CAMPAIGN','ONE STACK. ONE DAY.'),header(daily));
 assert.equal(footer(page),footer(daily));
 for(const asset of ['/styles.css','/retro.css','/theme-v2.css','/header-profile.css','/games.css'])assert.ok(page.includes('href="'+asset+'"'));
 assert.ok(page.includes('src="/header-profile.js"'));
 for(const name of ['RESCUE REPORT','COMMANDERS','CARD LIBRARY','TOOLS & RESOURCES','ARCADE','NOMINATIONS','COMMUNITY',"MEMBERS' LOUNGE"])assert.ok(page.includes(name));
 for(const cls of ['games-main','games-breadcrumbs','games-masthead','site-footer'])assert.ok(page.includes(cls));
 assert.ok(page.includes('src="./play.html"'));
});
test('Classic includes the playable 250-stage campaign, no Game Lab link dependency',()=>{
 assert.ok(game.length>400000,'full original compiled engine and campaign expected');
 for(const id of ['scenarioSelect','mapButton','worldMap','restartButton','undoButton','passButton','lands','hand','stackDrop','battlefield','playPrompt','galaxyTabs','worldTabs'])assert.ok(game.includes('id="'+id+'"'),id);
 for(const term of ['generateStages([...coreScenarios,...campaignExpansion])','const scenarios=[...coreScenarios,...campaignExpansion,...extraStages]','dc-stackbreaker-progress-v3','dc-stackbreaker-last-level','localStorage.setItem(progressKey','data-choose-target','applyLand','applyPass','changeCase'])assert.ok(game.includes(term),term);
 assert.ok(game.includes('250 SOLVED'));
 assert.ok(game.includes('name="robots" content="noindex,follow"'));
 assert.ok(!game.includes('href="/lab/')&&!game.includes('src="/lab/'));
 assert.ok(!game.includes('href="./final-turn/"'));
 assert.ok(!page.includes('deep-cuts-game-lab.pages.dev'));
 assert.ok(!hub.includes('href="https://deep-cuts-game-lab.pages.dev/stackbreaker/"'));
 assert.ok(!daily.includes('href="https://deep-cuts-game-lab.pages.dev/stackbreaker/"'));
});
test('Frame policy is narrowly scoped and Daily server-ranked mode is untouched',()=>{
 assert.match(headers,/\/games\/stackbreaker\/classic\/play\.html[\s\S]*X-Frame-Options: SAMEORIGIN/);
 assert.match(headers,/\/games\/stackbreaker\/classic\/play\.html[\s\S]*frame-ancestors 'self'/);
 assert.ok(headers.includes("X-Frame-Options: DENY"));
 assert.ok(daily.includes('deep-cuts-game-lab.pages.dev/stackbreaker/?daily=1&amp;siteRanked=1'));
 assert.ok(!page.includes('rankedRun')&&!game.includes('src="/games/stackbreaker-canonical.js"'));
});
