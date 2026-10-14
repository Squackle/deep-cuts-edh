import test from "node:test";import assert from "node:assert/strict";import{readFileSync}from"node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
test("main arcade has clear home navigation even in Game Only",()=>{
 assert.match(html,/class="arcade-home-link" href="\/" aria-label="Return to Deep Cuts EDH home page"/);
 assert.match(css,/body\.game-only \.arcade-home-link/);
 assert.match(html,/id="leaderboardEntries"/);
 assert.match(html,/id="submissionPanel"/);
});
test("move instructions to field guide and remove redundant sidebar copy",()=>{
 assert.match(html,/id="fieldGuide"/);
 assert.doesNotMatch(html,/CHOOSE YOUR PATH \/ CHASE YOUR RECORD|id="missionTitle"|Original pixel-art creature inspired by classic hive-serpent fantasy/);
 assert.doesNotMatch(html,/ORIGINAL PIXEL-ART ARCADE · FREE TO PLAY/);
});
test("only swipe and keyboard controls remain; debug stats are hidden by default",()=>{
 assert.doesNotMatch(html,/class="touch-pad"|data-direction=/);
 assert.doesNotMatch(main,/querySelectorAll\("\[data-direction\]"/);
 assert.match(main,/function swipeDirection/);assert.match(main,/KEY_DIRECTIONS/);
 assert.match(html,/id="devDiagnostics" hidden/);
 for(const id of ["evoCountdown","mutationInventory","killCount","enemyCount","stateLabel"])
 assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(main,/get\("debug"\)==="1"/);
 assert.match(css,/\.dev-diagnostics\[hidden\]/);
});
