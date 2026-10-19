import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("games.css","utf8");
const html=readFileSync("games.html","utf8");
const art=readFileSync("assets/hive-run-first-sliver-pixel.webp");
test("Hive Run Arcade feature uses standalone cropped pixel art, not UI baked into a screenshot",()=>{
 assert.match(css,/\.games-hive-art\{[^}]*hive-run-first-sliver-pixel\.webp/);
 assert.doesNotMatch(css,/\.games-hive-art\{[^}]*hive-run-atlas\.webp/);
 assert.equal(art.toString("ascii",0,4),"RIFF");
 assert.equal(art.toString("ascii",8,12),"WEBP");
 assert.ok(art.length>=4000&&art.length<100000,"Art should be optimized for mobile");
});
test("Original text and working buttons remain live HTML, not part of pixel image",()=>{
 assert.match(html,/<section class="games-hive-feature"/);
 assert.match(html,/<h2 id="hiveHubTitle">Hive <em>Run\.<\/em><\/h2>/);
 assert.match(html,/<a class="games-button games-button-primary" href="\/games\/hive-run\/">PLAY HIVE RUN/);
 assert.match(html,/<a class="games-button games-button-quiet" href="\/profile#account">COMMUNITY SIGN IN/);
 assert.match(css,/\.games-hive-copy h2\{[^}]*Georgia,serif/);
 assert.match(css,/\.games-hive-copy p\{[^}]*system-ui,sans-serif/);
});
