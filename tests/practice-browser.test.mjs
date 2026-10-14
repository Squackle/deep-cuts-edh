/* Real Chromium interaction suite. Executes the site's own game HTML and scripts
   against the same server handlers used in production, with an isolated fake D1
   database. Practice actions must render progress, survive refresh, and never
   touch daily score/achievement storage. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";
import {onRequestGet as dailyGet,onRequestPost as dailyPost} from "../functions/api/daily-games.js";
import {onRequestGet as arcaneGet,onRequestPost as arcanePost} from "../functions/api/arcane-games.js";
import {getPuzzle} from "../src/automated-games.js";

const root=process.cwd();
const authToken="dcprofile1_"+"a".repeat(32)+"_"+"b".repeat(64);
const ext={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".json":"application/json"};
function fixture(){
 const writes=[];
 const db={prepare(sql){return{
  bind(...args){this.args=args;return this},
  async first(){
   if(sql.includes("FROM community_profiles WHERE id=? AND key_hash=?"))return{id:"signed-player",handle:"BrowserTester"};
   if(sql.includes("INSERT INTO community_limits"))return{attempts:1};
   return null;
  },
  async all(){return{results:[]}},
  async run(){writes.push(sql);return{meta:{changes:1}}}
 }}};
 return{env:{DB:db,TURNSTILE_SECRET:"fixture"},writes};
}
function browserBinary(){
 if(process.env.CHROME_BIN&&fs.existsSync(process.env.CHROME_BIN))return process.env.CHROME_BIN;
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  try{const found=execFileSync("which",[bin],{encoding:"utf8"}).trim();if(found)return found}catch{}
 }
 throw Error("Chrome/Chromium unavailable on CI runner");
}
async function staticServer(){
 const server=http.createServer((req,res)=>{
  const parsed=new URL(req.url,"http://localhost");
  let pathname=decodeURIComponent(parsed.pathname);
  if(pathname==="/")pathname="/index.html";
  if(!path.extname(pathname))pathname+=".html";
  const filename=path.resolve(root,"."+pathname);
  if(!filename.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const body=fs.readFileSync(filename);
   res.writeHead(200,{"Content-Type":ext[path.extname(filename)]||"application/octet-stream","Cache-Control":"no-store"});
   res.end(body);
  }catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));
 return{server,origin:"http://127.0.0.1:"+server.address().port};
}
const games={
 cold:"cold-case",ladder:"obscurity-ladder",cipher:"arcane-cipher",board:"conspiracy-board"
};
test("all four practice UIs: clicking, refresh and session privacy (guest and signed-in)",{timeout:140000},async t=>{
 const {server,origin}=await staticServer();
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:browserBinary(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const signed of [false,true])for(const game of Object.keys(games)){
   await t.test((signed?"signed-in":"guest")+" "+game,{timeout:29000},async()=>{
    const fx=fixture(),seed=475319;
    const context=await browser.newContext({viewport:{width:390,height:844}});
    if(signed)await context.addInitScript(token=>sessionStorage.setItem("dc-profile-key",token),authToken);
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>{errors.push(String(e));if(game==="cipher")console.log("CIPHER SCRIPT ERROR",String(e))});
    await page.route("**/api/daily-games*",async route=>{
     const req=route.request();const headers={...req.headers(),"cf-connecting-ip":"198.51.100.27",origin};
     const request=new Request(req.url(),{method:req.method(),headers,...(req.method()==="POST"?{body:req.postData()}: {})});
     const r=await(req.method()==="POST"?dailyPost:dailyGet)({request,env:fx.env});
     await route.fulfill({status:r.status,contentType:"application/json",body:await r.text()});
    });
    await page.route("**/api/arcane-games*",async route=>{
     const req=route.request();const headers={...req.headers(),"cf-connecting-ip":"198.51.100.27",origin};
     const request=new Request(req.url(),{method:req.method(),headers,...(req.method()==="POST"?{body:req.postData()}: {})});
     const r=await(req.method()==="POST"?arcanePost:arcaneGet)({request,env:fx.env});
     await route.fulfill({status:r.status,contentType:"application/json",body:await r.text()});
    });
    await page.route(/^https:\/\//,route=>route.abort());
    try{
     await page.goto(origin+"/games/"+games[game]+".html?practice="+seed,{waitUntil:"domcontentloaded"});
     // Exercise the real hover and tap preview in both Commander games.
     // Game actions remain separate; preview must not submit guesses.
     if(game==="cold"||game==="ladder"){
      await page.locator(".games-commander-link").first().waitFor();
      const firstName=await page.locator(".games-commander-link").first().innerText();
      const originAttempts=game==="cold"?await page.locator(".games-guess-chip").count():null;
      await page.locator(".games-commander-link").first().hover();
      await page.locator(".games-card-tooltip").waitFor({state:"visible"});
      const source=await page.locator(".games-card-tooltip img").getAttribute("src");
      assert.ok(source.includes("format=image&version=normal"),"Full card preview, not art crop");
      assert.ok(source.includes(encodeURIComponent(firstName)),"Correct hovered commander card");
      await page.keyboard.press("Escape");
      await page.locator(".games-card-tooltip").waitFor({state:"hidden"});
      await page.locator(".games-card-peek").first().click();
      await page.locator(".games-card-tooltip").waitFor({state:"visible"});
      await page.keyboard.press("Escape");
      await page.locator(".games-card-tooltip").waitFor({state:"hidden"});
      if(game==="cold")assert.equal(await page.locator(".games-guess-chip").count(),originAttempts,"Card preview must never submit suspect");
     }
     if(game==="cold"){
      await page.locator(".games-suspect").first().waitFor();
      const puzzle=await getPuzzle(fx.env.DB,"cold","2026-10-14","practice",seed);
      const wrong=await page.locator(".games-suspect-entry").evaluateAll((items,answer)=>{
       const row=items.find(el=>el.querySelector("a")?.textContent?.trim()!==answer);
       return row?.querySelector("a")?.textContent?.trim();
      },puzzle.answer.name);
      assert.ok(wrong,"No wrong guesses available");
      assert.equal(await page.locator(".games-clue-open").count(),1);
      await page.getByRole("button",{name:"Guess "+wrong+" and reveal the next clue"}).click();
      await page.locator(".games-clue-open").nth(1).waitFor();
      assert.equal(await page.locator(".games-clue-open").count(),2,"First click must reveal the second clue");
      assert.equal(await page.locator(".games-guess-chip").count(),1);
      assert.match(await page.locator("#gameMessage").innerText(),/unsealed/);
      await page.reload({waitUntil:"domcontentloaded"});
      await page.locator(".games-clue-open").nth(1).waitFor();
      assert.equal(await page.locator(".games-guess-chip").count(),1,"Practice attempt lost on refresh");
      const second=await page.locator(".games-suspect-entry").evaluateAll((items,used)=>{
       const row=items.find(el=>{const n=el.querySelector("a")?.textContent?.trim();return n!==used&&el.querySelector("button")&&!el.querySelector("button").disabled});
       return row?.querySelector("a")?.textContent?.trim();
      },wrong);
      assert.ok(second,"No second practice guess available");
      await page.getByRole("button",{name:"Guess "+second+" and reveal the next clue"}).click();
      await page.locator(".games-clue-open").nth(2).waitFor();
     }else if(game==="ladder"){
      await page.locator(".games-ladder-row").first().waitFor();
      await page.getByRole("button",{name:/Move .* down/}).first().click();
      assert.equal(await page.locator(".games-ladder-row").count(),5);
      await page.getByRole("button",{name:/FILE MY FINAL ORDER/}).click();
      await page.locator(".games-reveal").waitFor();
      await page.reload({waitUntil:"domcontentloaded"});
      await page.locator(".games-ladder-row").first().waitFor();
      assert.equal(await page.locator(".games-reveal").count(),0,"Practice verdict should not lock next playthrough");
     }else if(game==="cipher"){
      console.log("CIPHER: starting "+(signed?"signed":"guest"));
      await page.locator(".arcane-keyboard").waitFor();
      const wordLength=await page.locator(".arcane-word-row").first().locator(".arcane-letter:not(.arcane-separator)").count();
      assert.ok(wordLength>=2&&wordLength<=24,"Incorrect adaptive tile count");
      const pattern=await page.locator(".arcane-word-row").first().locator(".arcane-separator").allTextContents();
      assert.ok(pattern.every(mark=>/^[ ’-]$/.test(mark)));
      for(const letter of "Z".repeat(wordLength))await page.getByRole("button",{name:letter,exact:true}).click();
      await page.getByRole("button",{name:"Submit guess"}).click();
      console.log("CIPHER: clicked guess");
      await page.locator(".arcane-letter.correct, .arcane-letter.present, .arcane-letter.absent").first().waitFor();
      assert.match(await page.locator("#arcaneProgress").innerText(),/GUESS 2/);
      await page.reload({waitUntil:"domcontentloaded"});
      console.log("CIPHER: reload complete");
      await page.getByRole("button",{name:"Submit guess"}).waitFor();
      assert.match(await page.locator("#arcaneProgress").innerText(),/GUESS 2/);
      console.log("CIPHER: before hint",await page.locator(".arcane-hint-count").innerText());
      await page.getByRole("button",{name:/Reveal .* correct letters, spend one guess/}).click();
      console.log("CIPHER: clicked hint",await page.locator("#arcaneMessage").innerText());
      await page.waitForFunction(()=>document.querySelector(".arcane-hint-count")?.textContent?.includes("1 / 2"));
      assert.equal(await page.locator(".arcane-hint-row").count(),1,"Hint must spend an entire row");
      const greenCount=await page.locator(".arcane-word-row").nth(2).locator(".arcane-letter.correct").count();
      assert.ok(greenCount>=1&&greenCount<=3,"Adaptive hint should pin one to three letters");
      await page.reload({waitUntil:"domcontentloaded"});
      await page.getByRole("button",{name:"Submit guess"}).waitFor();
      assert.equal(await page.locator(".arcane-hint-row").count(),1,"Hint must persist after reload");
      assert.match(await page.locator("#arcaneProgress").innerText(),/GUESS 3/);
      console.log("CIPHER: active row validated",await page.locator("#arcaneProgress").innerText());
      const openLetters=wordLength-await page.locator(".arcane-word-row").nth(2).locator(".arcane-letter.correct").count();
      console.log("CIPHER: openLetters",openLetters,"length",wordLength);
      for(const letter of "Y".repeat(openLetters))await page.getByRole("button",{name:letter,exact:true}).click();
      await page.getByRole("button",{name:"Submit guess"}).click();
      console.log("CIPHER: after second guess",await page.locator("#arcaneMessage").innerText());
      await page.waitForFunction(()=>document.querySelector("#arcaneProgress")?.textContent?.includes("GUESS 4"));
     }else{
      await page.locator(".arcane-card button").first().waitFor();
      for(let i=0;i<4;i++)await page.locator(".arcane-card button").nth(i).click();
      await page.getByRole("button",{name:/SUBMIT GROUP · 4\/4/}).click();
      await page.waitForFunction(()=>document.querySelectorAll(".arcane-attempts .spent,.arcane-solved-group").length>0);
      const evidence=await page.locator(".arcane-attempts .spent,.arcane-solved-group").count();
      await page.reload({waitUntil:"domcontentloaded"});
      await page.locator(".arcane-card button").first().waitFor();
      assert.equal(await page.locator(".arcane-attempts .spent,.arcane-solved-group").count(),evidence);
     }
     assert.deepEqual(errors,[],"Browser script threw an uncaught error");
     assert.ok(!fx.writes.some(sql=>/(daily_game_runs|daily_arcane_runs|daily_game_achievements|daily_arcane_badges)/.test(sql)),
       "Practice wrote to daily score or achievements");
    }finally{await context.close()}
   });
  }
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
});
