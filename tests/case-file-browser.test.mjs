import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {launchBrowser} from "./helpers/browser.mjs";
const mime={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml"};

async function local(){
 const root=process.cwd(),server=http.createServer((req,res)=>{
  const p=new URL(req.url,"http://localhost").pathname;
  const file=path.resolve(root,"."+((p==="/case-file")?"/case-file.html":p));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{const bytes=fs.readFileSync(file);res.writeHead(200,{"Content-Type":mime[path.extname(file)]||"text/plain"}).end(bytes)}
  catch{if(!res.headersSent)res.writeHead(404);res.end("Not found")}
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 return {server,url:"http://127.0.0.1:"+server.address().port};
}
test("Shareable Case File creates a real downloadable PNG, validates sources and supports a public deck",{timeout:45000},async()=>{
 const {server,url}=await local();let browser;
 try{
  browser=await launchBrowser();
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:844},acceptDownloads:true});
   const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/api/tool-cards",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({cards:[{name:"Toshiro Umezawa",type_line:"Legendary Creature — Human Samurai",oracle_text:"",color_identity:["B"],legalities:{commander:"legal"}}]})
   }));
   await page.route("**/api/community?action=deck*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    deck:{id:"a".repeat(32),title:"An Underused Army",commander:"Toshiro Umezawa",handle:"PublicBrewer"}
   })}));
   await page.route("**/api/supporter-ticker",route=>route.fulfill({status:200,contentType:"application/json",body:'{"supporters":[]}'}));
   await page.route(/^https:\/\//,route=>route.abort());
   await page.goto(url+"/case-file",{waitUntil:"domcontentloaded"});
   await page.locator("#cfQuery").fill("Toshiro Umezawa");
   await page.getByRole("button",{name:/CREATE CASE FILE/}).click();
   await page.waitForFunction(()=>!document.getElementById("cfCanvas").hidden);
   assert.equal(await page.locator("#cfActions").isVisible(),true);
   const actual=await page.locator("#cfCanvas").evaluate(el=>({pixels:[el.width,el.height],prefix:el.toDataURL("image/png").slice(0,22)}));
   assert.deepEqual(actual.pixels,[1200,630]);
   assert.equal(actual.prefix,"data:image/png;base64,");
   const download=page.waitForEvent("download");
   await page.getByRole("button",{name:/DOWNLOAD PNG/}).click();
   const file=await download;
   assert.match(file.suggestedFilename(),/^deep-cuts-toshiro-umezawa\.png$/);
   const u=new URL(page.url());assert.equal(u.searchParams.get("commander"),"Toshiro Umezawa");
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"Mobile must not overflow "+width);
   await page.locator('input[value="deck"]').check();
   await page.locator("#cfQuery").fill("a".repeat(32));
   await page.getByRole("button",{name:/CREATE CASE FILE/}).click();
   await page.waitForFunction(()=>document.querySelector("#cfCanvas")?.getAttribute("aria-label")?.includes("An Underused Army"));
   assert.match(await page.locator("#cfStatus").textContent(),/public deck case file ready/i);
   const deckUrl=new URL(page.url());assert.equal(deckUrl.searchParams.get("deck"),"a".repeat(32));
   assert.deepEqual(errors,[]);
   await ctx.close();
  }
 }finally{await browser?.close();await new Promise(done=>server.close(done))}
});


test("Switching source or editing the query invalidates an in-flight case file and hides stale exports",{timeout:45000},async()=>{
 const {server,url}=await local();let browser,release,started;
 const gate=new Promise(resolve=>{release=resolve});
 const requestStarted=new Promise(resolve=>{started=resolve});
 try{
  browser=await launchBrowser();
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route(/^https:\/\//,route=>route.abort());
  await page.route("**/api/tool-cards",async route=>{
   started();await gate;
   try{await route.fulfill({json:{cards:[{name:"Toshiro Umezawa",type_line:"Legendary Creature — Human Samurai",color_identity:["B"],legalities:{commander:"legal"}}]}})}catch{/* request was canceled */}
  });
  await page.route("**/api/community?action=deck*",route=>route.fulfill({json:{deck:{id:"a".repeat(32),title:"A New Case",commander:"Toshiro Umezawa",handle:"PublicBrewer"}}}));
  await page.goto(url+"/case-file",{waitUntil:"domcontentloaded"});
  await page.locator("#cfQuery").fill("Toshiro Umezawa");
  await page.locator("#cfGenerate").click();
  await requestStarted;
  assert.equal(await page.locator("#cfForm").getAttribute("aria-busy"),"true");
  await page.locator('input[value="deck"]').check();
  assert.equal(await page.locator("#cfForm").getAttribute("aria-busy"),"false");
  assert.equal(await page.locator("#cfActions").isVisible(),false);
  await page.locator("#cfQuery").fill("a".repeat(32));
  await page.locator("#cfGenerate").click();
  await page.waitForFunction(()=>document.querySelector("#cfCanvas").getAttribute("aria-label").includes("A New Case")&&!document.querySelector("#cfCanvas").hidden);
  release();
  assert.equal(new URL(page.url()).searchParams.get("deck"),"a".repeat(32));
  await page.locator("#cfQuery").fill("b".repeat(32));
  assert.equal(await page.locator("#cfCanvas").isVisible(),false);
  assert.equal(await page.locator("#cfActions").isVisible(),false);
  assert.equal(new URL(page.url()).search,"");
  assert.deepEqual(errors,[]);
 }finally{release();await browser?.close();await new Promise(done=>server.close(done))}
});

test("An already-requested PNG keeps its original filename after the user changes the form",{timeout:45000},async()=>{
 const {server,url}=await local();let browser;
 try{
  browser=await launchBrowser();
  const context=await browser.newContext({acceptDownloads:true});
  const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route(/^https:\/\//,route=>route.abort());
  await page.route("**/api/tool-cards",route=>route.fulfill({json:{cards:[null,{name:"Toshiro Umezawa",type_line:"Legendary Creature — Human Samurai",oracle_text:"",color_identity:["B"],legalities:{commander:"legal"}}]}}));
  await page.goto(url+"/case-file",{waitUntil:"domcontentloaded"});
  await page.locator("#cfQuery").fill("Toshiro Umezawa");
  await page.locator("#cfGenerate").click();
  await page.locator("#cfActions").waitFor();
  // Capture the real encoded blob but delay its callback until after editing.
  await page.evaluate(()=>{
   const canvas=document.querySelector("#cfCanvas"),original=canvas.toBlob.bind(canvas);
   canvas.toBlob=(callback,type)=>original(blob=>{window.finishExport=()=>callback(blob)},type);
  });
  await page.locator("#cfDownload").click();
  await page.waitForFunction(()=>typeof window.finishExport==="function");
  await page.locator("#cfQuery").fill("Another commander");
  assert.equal(await page.locator("#cfActions").isVisible(),false);
  const pending=page.waitForEvent("download");
  await page.evaluate(()=>window.finishExport());
  assert.equal((await pending).suggestedFilename(),"deep-cuts-toshiro-umezawa.png");
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{await browser?.close();await new Promise(done=>server.close(done))}
});
