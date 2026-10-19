/* Browser regression: actual Arcade, actual practice API logic and local-only journey. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";
// Also run Hive Run click-through/startup coverage in this existing Chromium CI step.
import "./hive-run-browser.test.mjs";
import {onRequestGet as dailyGet,onRequestPost as dailyPost} from "../functions/api/daily-games.js";
import {getPuzzle} from "../src/automated-games.js";
function chrome(){
 for(const name of ["google-chrome","chromium","google-chrome-stable","chromium-browser"]){
  try{return execFileSync("which",[name],{encoding:"utf8"}).trim()}catch{}
 }
 throw Error("Chrome unavailable");
}
async function serve(){
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  let pathname=new URL(req.url,"http://local").pathname;
  if(pathname==="/games")pathname="/games.html";
  if(!path.extname(pathname))pathname+=".html";
  const file=path.resolve(root,"."+pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const bytes=fs.readFileSync(file);
   const mime=file.endsWith(".js")?"application/javascript":file.endsWith(".css")?"text/css":file.endsWith(".html")?"text/html":file.endsWith(".svg")?"image/svg+xml":"text/plain";
   res.writeHead(200,{"Content-Type":mime}).end(bytes);
  }catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 return {server,origin:"http://127.0.0.1:"+server.address().port};
}
function fixture(){
 const writes=[];
 const db={prepare(sql){return{
  bind(...args){this.args=args;return this},
  async first(){if(sql.includes("INSERT INTO community_limits"))return {attempts:1};return null},
  async all(){return {results:[]}},
  async run(){writes.push(sql);return {meta:{changes:1}}}
 }}};
 return {env:{DB:db,TURNSTILE_SECRET:"fixture"},writes};
}
test("Arcade keeps compact resume navigation and truthful device-only progress on mobile and desktop",{timeout:90000},async()=>{
 const {server,origin}=await serve();
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:850}});
   const page=await ctx.newPage(),errors=[],fx=fixture(),seed=475319;
   page.on("pageerror",e=>errors.push(String(e)));
   await page.route("**/api/daily-games*",async route=>{
    const req=route.request(),headers={...req.headers(),"cf-connecting-ip":"198.51.100.29",origin};
    const request=new Request(req.url(),{method:req.method(),headers,...(req.method()==="POST"?{body:req.postData()}:{})});
    const response=await (req.method()==="POST"?dailyPost:dailyGet)({request,env:fx.env});
    await route.fulfill({status:response.status,contentType:"application/json",body:await response.text()});
   });
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(origin+"/games",{waitUntil:"domcontentloaded"});
    assert.equal(await page.locator(".games-feature .arcade-session-facts").count(),4);
    assert.equal(await page.locator(".games-hive-feature .arcade-session-facts").count(),1);
    assert.equal(await page.locator(".arcade-continue").count(),0,"Clean browser has no fake resume history");
    await page.goto(origin+"/games/cold-case?practice="+seed,{waitUntil:"domcontentloaded"});
    await page.locator(".games-suspect").first().waitFor();
    assert.equal(await page.locator(".games-masthead .arcade-session-detail").count(),1);
    await page.goto(origin+"/games",{waitUntil:"domcontentloaded"});
    const back=page.locator(".arcade-continue");
    await back.waitFor();
    assert.equal((await back.innerText()).trim(),"Continue last game ↗");
    assert.equal(await page.locator(".arcade-continue-note").innerText(),"Cold Case · Practice round");
    assert.match(await back.getAttribute("aria-label"),/Cold Case, practice round/);
    assert.equal(await back.evaluate(el=>getComputedStyle(el).animationName),"arcade-continue-halo");
    assert.ok((await back.evaluate(el=>parseFloat(getComputedStyle(el).minHeight)))>=44,"Glow CTA preserves a full touch target");
    const util=page.locator(".arcade-hero-utility");
    assert.match(await util.innerText(),/Fresh puzzles daily/);
    assert.match(await util.innerText(),/How it works/);
    assert.match(await page.locator(".arcade-hero-deck").innerText(),/Pick your next case/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Hero overflow at "+width);
    assert.equal(await back.getAttribute("href"),"/games/cold-case?practice="+seed);
    await back.click();
    await page.locator(".games-suspect").first().waitFor();
    const puzzle=await getPuzzle(fx.env.DB,"cold","2026-10-14","practice",seed);
    const wrong=await page.locator(".games-suspect-entry").evaluateAll((rows,answer)=>{
     const row=rows.find(el=>el.querySelector("a")?.textContent?.trim()!==answer);
     return row?.querySelector("a")?.textContent?.trim();
    },puzzle.answer.name);
    assert.ok(wrong);
    await page.getByRole("button",{name:"Guess "+wrong+" and reveal the next clue"}).click();
    await page.locator(".games-clue-open").nth(1).waitFor();
    await page.goto(origin+"/games",{waitUntil:"domcontentloaded"});
    await page.locator(".arcade-continue").waitFor();
    assert.equal((await page.locator(".arcade-continue").innerText()).trim(),"Continue last game ↗");
    assert.equal(await page.locator(".arcade-continue-note").innerText(),"Cold Case · Practice round");
    await page.locator(".arcade-continue").click();
    await page.locator(".games-guess-chip").first().waitFor();
    assert.equal(await page.locator(".games-guess-chip").count(),1);
    await page.getByRole("button",{name:"Guess "+puzzle.answer.name+" and reveal the next clue"}).click();
    await page.locator(".arcade-personal-recap").waitFor();
    assert.match(await page.locator(".arcade-personal-note").innerText(),/this browser only/);
    assert.match(await page.locator(".arcade-personal-comparison").innerText(),/First recorded practice finish/);
    const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem("deepcuts:arcade-journey:v1")));
    assert.equal(snapshot.results.length,1);
    assert.equal(snapshot.results[0].mode,"practice");
    assert.ok(!JSON.stringify(snapshot).includes("profile"));
    await page.goto(origin+"/games",{waitUntil:"domcontentloaded"});
    assert.equal(await page.locator(".arcade-continue").count(),0,"Finished puzzle should not display as unfinished");
    const nextSeed=seed+1;
    await page.goto(origin+"/games/cold-case?practice="+nextSeed,{waitUntil:"domcontentloaded"});
    await page.locator(".games-suspect").first().waitFor();
    const next=await getPuzzle(fx.env.DB,"cold","2026-10-14","practice",nextSeed);
    await page.getByRole("button",{name:"Guess "+next.answer.name+" and reveal the next clue"}).click();
    await page.locator(".arcade-personal-recap").waitFor();
    assert.match(await page.locator(".arcade-personal-comparison").innerText(),/previous practice result/);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("deepcuts:arcade-journey:v1")).results.length),2);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Horizontal overflow "+width);
    assert.deepEqual(errors,[],"Browser script errors "+width);
    assert.ok(!fx.writes.some(x=>/daily_game_runs|daily_game_achievements/i.test(x)),"Practice result must not enter ranked D1 tables");
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
