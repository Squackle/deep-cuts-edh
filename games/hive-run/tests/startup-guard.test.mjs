import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("Hive Run imports its startup dependencies, including Game Only, before initializing controls",()=>{
 const main=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");
 assert.match(main,/import\s*\{\s*createGameOnlyMode\s*\}\s*from\s*["']\.\/game-only\.js["']/);
 assert.match(main,/const gameOnly=createGameOnlyMode\(/);
 for(const id of ["primaryButton","gameMode","gameChallenge","restartButton","pauseButton","bossBriefingResume"]){
  const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
  assert.ok(html.includes('id="'+id+'"'),"Missing interactive element: "+id);
 }
});
