import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RULES_VERSION} from "../games/hive-run/src/engine.js";
import {captureFlash,isScoreFlashVisible,drawCaptureFlash,scoreStampPosition} from "../games/hive-run/src/beacon-feedback.js";
import {mutationSelectionIndex,KEY_DIRECTIONS} from "../games/hive-run/src/input-controls.js";
import {discoveredDossiers,HIVE_CODEX} from "../hive-profile.js";

test("Dominion promotes versioned simulation while retaining Beacon feedback",()=>{
 assert.equal(RULES_VERSION,"hive-1.5.4");
 const engine=readFileSync("games/hive-run/src/engine.js","utf8");
 const server=readFileSync("src/hive-server/leaderboard.js","utf8");
 const main=readFileSync("games/hive-run/src/main.js","utf8");
 assert.match(engine,/RULES_VERSION="hive-1\.5\.4"/);
 assert.match(server,/replayScore\(record\.seed,events,summary,record\.mode\)/);
 assert.match(server,/profile_verified/);
 assert.match(main,/captureFlash\(removed\.pos,state\.run\.score-prevScore,performance\.now\(\)\)/);
 assert.match(main,/drawCaptureFlash\(context,beaconCapture/);
 assert.match(main,/leaderboard\.start\(selectedMode,selectedChallenge\)/);
 assert.doesNotMatch(main,/beacon-training|beginTraining/);
});
test("rapid movement inputs cannot select a mutation at an orb transition",()=>{
 assert.deepEqual(["1","2","3"].map(key=>mutationSelectionIndex(key)),[0,1,2]);
 assert.equal(mutationSelectionIndex("1",true),null);
 for(const direction of Object.keys(KEY_DIRECTIONS)){
  assert.equal(mutationSelectionIndex(direction),null,direction);
  assert.equal(mutationSelectionIndex(direction,true),null,direction);
 }
 const html=readFileSync("games/hive-run/index.html","utf8");
 assert.match(html,/2\.0 · DOMINION/);
 assert.match(html,/MOVEMENT KEYS IGNORE THIS MENU/);
});
test("score flashes 3 times at fixed position above captured tile, not over square",()=>{
 const flash=captureFlash({x:4,y:7},300,100);
 const calls=[],ctx={save(){},restore(){},strokeRect(){},fillText(...args){calls.push(args)},measureText:()=>({width:32}),canvas:{width:360}};
 for(const t of [100,380,660]){assert.equal(isScoreFlashVisible(flash,t),true);drawCaptureFlash(ctx,flash,20,t);}
 assert.deepEqual(calls,[["+300",90,136],["+300",90,136],["+300",90,136]]);
 for(const t of [240,520,800,940])assert.equal(isScoreFlashVisible(flash,t),false);
 assert.deepEqual(scoreStampPosition({x:4,y:0},20,360,32),{x:90,y:34});
 const locator=readFileSync("games/hive-run/src/player-visibility.js","utf8");
 assert.match(locator,/Math\.round\(cell\*\.4\)/);
 assert.match(locator,/Math\.round\(cell\*\.15\)/);
});
test("My Profile Codex discovery is based on verified historical ranked evolution milestones, not inferred kills",()=>{
 assert.deepEqual(HIVE_CODEX.map(x=>x.at),[2,4,6,8]);
 assert.deepEqual(discoveredDossiers([]).map(x=>x.discovered),[false,false,false,false]);
 assert.deepEqual(discoveredDossiers([{mode:"classic",bestEvolution:99}]).map(x=>x.discovered),[false,false,false,false]);
 assert.deepEqual(discoveredDossiers([{mode:"hunt",bestEvolution:4},{mode:"hunt",bestEvolution:2}]).map(x=>x.discovered),[true,true,false,false]);
 const api=readFileSync("functions/api/hive-profile.js","utf8");
 assert.match(api,/profile_verified=1/);
 assert.match(api,/FROM hive_scores_v1/);
 const profile=readFileSync("hive-profile.js","utf8");
 assert.match(profile,/root\.id!=="ownProfile"/);
 assert.match(profile,/Discovery does not claim the boss was defeated/);
});
