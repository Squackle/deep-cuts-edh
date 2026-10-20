import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {launchBrowser} from "./helpers/browser.mjs";

const source=(f)=>readFileSync(new URL("../"+f,import.meta.url),"utf8");

test("security Issue #38: archive data rendered as inert text, no injected markup or script",{timeout:20000},async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage();
  const payload='<img src=x onerror="window.__xss=1">';
  const data=[{id:"chainer",status:"published",name:payload,full:payload,headline:payload,pitch:payload,hook:payload,risk:payload,kind:"mono",badge:"case",tech:[payload],colors:["B"],preview:false}];
  const html='<!doctype html><html><body><input id="searchInput"><select id="colorFilter"><option value="all" selected>All</option></select><div id="archiveGrid"></div><span id="resultsCount"></span><div id="emptyState"></div><dialog id="caseDialog"><div id="modalBody"></div></dialog><button id="surpriseBtn"></button><button id="closeDialog"></button><button id="clearFilters"></button></body></html>';
  await page.setContent(html);
  await page.evaluate(data=>{window.DEEP_CUTS=data},data);
  await page.addScriptTag({content:source("app.js")});
  assert.equal(await page.locator("#archiveGrid .archive-card").count(),1);
  assert.equal(await page.locator("#archiveGrid .card-top").count(),1);
  assert.equal(await page.locator("#archiveGrid .card-bottom .archive-read").count(),1);
  assert.equal(await page.locator("#archiveGrid .card-mark").count(),1);
  assert.equal(await page.locator("#archiveGrid .card-colors .pip").count(),1);
  assert.equal(await page.locator("#archiveGrid img").count(),0);
  assert.equal(await page.locator("#archiveGrid [onerror]").count(),0);
  assert.equal(await page.locator(".archive-card-name").textContent(),payload);
  assert.equal(await page.evaluate(()=>window.__xss===undefined),true);
 }finally{await browser.close()}
});
test("security Issue #38: report table values cannot insert HTML elements",{timeout:20000},async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage();
  const payload='<svg onload="window.__xss=1"></svg>';
  const html='<!doctype html><html><body><table><tbody id="coreRows"></tbody></table><button id="copyCore">Copy</button><span id="copyFeedback"></span><script>window.CHAINER_CORE='+JSON.stringify([["role",payload]])+';<\/script><script>'+source("reports/report.js")+'<\/script></body></html>';
  await page.setContent(html,{waitUntil:"load"});
  assert.equal(await page.locator("#coreRows tr").count(),1);
  assert.equal(await page.locator("#coreRows svg").count(),0);
  assert.equal(await page.locator("#coreRows td").nth(1).textContent(),payload);
  assert.equal(await page.evaluate(()=>window.__xss===undefined),true);
 }finally{await browser.close()}
});
test("security Issue #38: the remaining UI modules do not parse strings as HTML",()=>{
 for(const file of ["app.js","workspace-ui.js","daily-games.js","reports/report.js"]){
  const js=source(file);
  assert.doesNotMatch(js,/\.innerHTML\s*=|insertAdjacentHTML\s*\(/,file+" should construct nodes with DOM APIs");
 }
 assert.match(source("workspace-ui.js"),/summaryName\.textContent=label/);
 assert.match(source("daily-games.js"),/banner\.replaceChildren\(signIn/);
 assert.match(source("reports/report.js"),/nameCell\.textContent=String\(name\)/);
});
