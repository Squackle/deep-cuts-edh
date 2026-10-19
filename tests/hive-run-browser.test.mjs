/* Run the REAL public Hive Run entrypoint in Chromium. Missing ESM imports
 * break every menu button but pass syntax-only tests: fail on page errors. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";

const root=process.cwd();
function chrome(){
 if(process.env.CHROME_BIN&&fs.existsSync(process.env.CHROME_BIN))return process.env.CHROME_BIN;
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  try{return execFileSync("which",[bin],{encoding:"utf8"}).trim()}catch{}
 }
 throw Error("Chromium browser unavailable; cannot validate the Hive Run release");
}
async function serve(){
 const server=http.createServer((req,res)=>{
  let pathname=decodeURIComponent(new URL(req.url,"http://local").pathname);
  if(pathname.endsWith("/"))pathname+="index.html";
  else if(!path.extname(pathname))pathname+=".html";
  const file=path.resolve(root,"."+pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const content=fs.readFileSync(file);
   const mime={".html":"text/html; charset=utf-8",".js":"application/javascript",".css":"text/css",
    ".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp",".avif":"image/avif",
    ".png":"image/png",".woff2":"font/woff2"}[path.extname(file)]||"application/octet-stream";
   res.writeHead(200,{"Content-Type":mime,"Cache-Control":"no-store"}).end(content);
  }catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {server,origin:"http://127.0.0.1:"+server.address().port};
}
test("Dominion launch works on phone and desktop: Brood Trail, Hunt and Broodmother practice",{timeout:100000},async t=>{
 const {server,origin}=await serve();
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [390,1280]){
   await t.test(width===390?"mobile touch":"desktop mouse",{timeout:42000},async()=>{
    const context=await browser.newContext({
     viewport:{width,height:width===390?844:900},isMobile:width===390,hasTouch:width===390
    });
    const page=await context.newPage(),errors=[];
    page.on("pageerror",err=>errors.push(String(err)));
    // Ranked service deliberately unavailable: game must still play unranked.
    await page.route("**/api/**",route=>route.fulfill({
     status:503,contentType:"application/json",body:JSON.stringify({error:"Offline test"})
    }));
    await page.route(/^https:\/\//,route=>route.abort());
    const activate=async locator=>width===390?locator.tap():locator.click();
    try{
     await page.goto(origin+"/games/hive-run/",{waitUntil:"domcontentloaded"});
     await page.locator("#primaryButton").waitFor({state:"visible"});
     await page.waitForTimeout(100);
     assert.deepEqual(errors,[],"Startup must not throw before controls are wired");
     assert.match(await page.locator("#primaryButton").innerText(),/START/);

     // Classic Snake: choose path, begin offline, pause/restart.
     await page.locator("#gameMode").selectOption("classic");
     assert.equal(await page.locator("#gameChallenge").isHidden(),true);
     await activate(page.locator("#primaryButton"));
     await page.locator("#gameOverlay").waitFor({state:"hidden"});
     assert.equal(await page.locator("#pauseButton").isEnabled(),true,"Brood Trail must actually run");
     await activate(page.locator("#pauseButton"));
     await page.locator("#gameOverlay").waitFor({state:"visible"});
     await activate(page.locator("#restartButton"));
     await page.locator("#gameOverlay").waitFor({state:"visible"});

     // Hunt Arcade: offline practice mode, not a dead button.
     await page.locator("#gameMode").selectOption("hunt");
     await page.locator("#gameChallenge").selectOption("arcade");
     await activate(page.locator("#primaryButton"));
     await page.locator("#gameOverlay").waitFor({state:"hidden"});
     assert.equal(await page.locator("#pauseButton").isEnabled(),true,"Hunt must actually start");
     await activate(page.locator("#restartButton"));

     // Test Boss Fight / the Lair: new fifth boss must respond to taps.
     await page.locator("#gameChallenge").selectOption("practice");
     await page.locator("#lairPicker").waitFor({state:"visible"});
     const broodmother=page.locator('[data-lair-boss="broodmother"]');
     await activate(broodmother);
     assert.equal(await broodmother.getAttribute("aria-pressed"),"true");
     assert.match(await page.locator("#mercyStatus").innerText(),/1 FREE BOSS DODGE/,"Lair HUD must show the real boss Instinct life");
     await activate(page.locator("#primaryButton"));
     await page.locator("#bossBriefing").waitFor({state:"visible"});
     await activate(page.locator("#bossBriefingResume"));
     await page.locator("#bossCountdown").waitFor({state:"visible"});
     assert.deepEqual(errors,[],"No browser runtime exceptions during any game mode");
    }finally{await context.close()}
   });
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});
