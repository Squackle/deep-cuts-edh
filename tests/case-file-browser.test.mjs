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
