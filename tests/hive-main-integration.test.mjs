import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {onRequestGet as profileGet} from "../functions/api/hive-profile.js";
import {onRequestGet as leaderboardGet} from "../functions/games/hive-run/api/leaderboard.js";
import {RULES_VERSION} from "../games/hive-run/src/engine.js";
import {API_URL,profileLink} from "../games/hive-run/src/integration.js";

test("main-site game route and all first-party assets are present",()=>{
 const html=readFileSync(new URL("../games/hive-run/index.html",import.meta.url),"utf8");
 const hub=readFileSync(new URL("../games.html",import.meta.url),"utf8");
 const home=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const atlas=new URL("../games/hive-run/assets/backgrounds/hive-run-atlas.webp",import.meta.url);
 assert.ok(existsSync(atlas));
 assert.match(html,/id="gameSignInLink" href="\/community\.html#account"/);
 assert.match(html,/id="gameProfileBridge"[^>]*hidden/);
 assert.match(html,/<header class="lab-header" data-profile-header>/);
 assert.match(html,/href="\/header-profile\.css"/);
 assert.match(html,/src="\/header-profile\.js"/);
 assert.doesNotMatch(html,/id="gameProfileLink"/);
 const headerJs=readFileSync(new URL("../header-profile.js",import.meta.url),"utf8");
 assert.match(headerJs,/\.lab-header\[data-profile-header\]/);
 assert.match(headerJs,/\/api\/community\?action=me/);
 const gameJs=readFileSync(new URL("../games/hive-run/src/main.js",import.meta.url),"utf8");
 assert.match(gameJs,/\$\("gameProfileBridge"\)\.hidden=!!data\.profile/);
 assert.match(gameJs,/\$\("gameProfileBridge"\)\.hidden=true/);
 assert.match(html,/id="playerAlias"/);
 assert.match(html,/maxlength="3" pattern="\[A-Za-z0-9\]\{3\}"/);
 assert.doesNotMatch(html,/id="playerProfile"/);
 assert.match(html,/bossBriefing/);
 assert.match(hub,/class="games-hive-feature"/);
 assert.ok(hub.indexOf('class="games-hive-feature"')<hub.indexOf('class="games-hub-grid"'));
 assert.match(home,/href="\/games\/hive-run\/"/);
 assert.match(API_URL,/\/games\/hive-run\/api\/leaderboard$/);
 assert.match(profileLink("Squackle"),/\/community\.html\?profile=Squackle$/);
});
test("the site game, its replay verifier, and versioned rankings share the ruleset",async()=>{
 const game=readFileSync(new URL("../games/hive-run/src/engine.js",import.meta.url),"utf8");
 const server=readFileSync(new URL("../src/hive-server/leaderboard.js",import.meta.url),"utf8");
 assert.equal(RULES_VERSION,"hive-1.0.2");
 assert.match(game,/RULES_VERSION="hive-1\.0\.2"/);
 assert.match(server,/import \{newRun,start,step,turn,chooseMutation,RULES_VERSION\}/);
 const wrapper=readFileSync(new URL("../functions/games/hive-run/api/leaderboard.js",import.meta.url),"utf8");
 assert.match(wrapper,/await auth\(ctx\.request,ctx\.env\.DB\)/);
 assert.match(wrapper,/resolveProfiles/);
});
test("public profile displays every verified rules version while excluding guest claims",async()=>{
 const seen={};const env={
  DB:{prepare(sql){seen.profileSql=sql;return{bind(handle){seen.handle=handle;return{async first(){return{id:"real-profile-id",handle:"Squackle"}}}}}}},
  HIVE_DB:{prepare(sql){seen.scoresSql=sql;return{bind(...values){seen.params=values;return{async all(){return{results:[{mode:"classic",rulesVersion:"hive-1.0.2",bestScore:6500,bestEvolution:13,rankedRuns:1},{mode:"hunt",rulesVersion:"hive-1.0.0",bestScore:3000,bestEvolution:4,rankedRuns:2}]}}}}}}}
 };
 const response=await profileGet({env,request:new Request("https://deep-cuts-edh.pages.dev/api/hive-profile?handle=Squackle")});
 assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.records.length,2);
 assert.ok(seen.scoresSql.includes("profile_verified=1"));
 assert.ok(seen.scoresSql.includes("ROW_NUMBER() OVER"));
 assert.ok(seen.scoresSql.includes("COUNT(*) OVER"));
 assert.ok(seen.scoresSql.includes("PARTITION BY mode,rules_version"));
 assert.ok(seen.scoresSql.includes("ORDER BY score DESC,kills DESC,created_at ASC,id ASC"));
 assert.ok(seen.scoresSql.includes("WHERE placement=1"));
 assert.ok(!seen.scoresSql.includes("MAX(evolutions)"));
 assert.deepEqual(seen.params,["real-profile-id"]);
});
test("verified identity comes from the remembered-device cookie, not the typed handle",async()=>{
 const token="dcdevice1_"+"a".repeat(64);
 const prepares=[];
 const env={
  DB:{prepare(sql){prepares.push(sql);return{bind(){return{async first(){return{id:"verified-id",handle:"Squackle"}}}}}}},
  HIVE_DB:{prepare(sql){prepares.push(sql);return{bind(){return{async all(){return{results:[]}},async first(){return null}}}}}}
 };
 const url="https://deep-cuts-edh.pages.dev/games/hive-run/api/leaderboard?mode=classic&challenge=arcade";
 const get=async headers=>{
  const r=await leaderboardGet({env,request:new Request(url,{headers})});
  assert.equal(r.status,200);
  return r.json();
 };
 const guest=await get({});assert.equal(guest.profile,null);
 const verified=await get({Cookie:"__Host-dc_device="+token});
 assert.deepEqual(verified.profile,{handle:"Squackle"});
 const rejected=await get({Cookie:"__Host-dc_device="+token,Authorization:"Bearer not-a-valid-key"});
 assert.equal(rejected.profile,null);
 assert.ok(prepares.some(sql=>sql.includes("community_device_sessions")));
});
