import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";

function browserPath(){
 for(const name of ["google-chrome","chromium","google-chrome-stable","chromium-browser"]){
  try{return execFileSync("which",[name],{encoding:"utf8"}).trim()}catch{}
 }
 throw Error("Chromium unavailable");
}
async function serve(){
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  let route=new URL(req.url,"http://localhost").pathname;
  if(route==="/nominations")route="/nominations.html";
  if(route==="/reports/commander-mustard")route="/reports/commander-mustard.html";
  const file=path.resolve(root,"."+route);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const mime=file.endsWith(".html")?"text/html":file.endsWith(".css")?"text/css":file.endsWith(".js")?"text/javascript":"image/svg+xml";
   res.writeHead(200,{"Content-Type":mime}).end(fs.readFileSync(file));
  }catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {server,url:"http://127.0.0.1:"+server.address().port};
}
test("Rescue Board preserves voting, reveals useful details and reads existing public findings only when opened",{timeout:85000},async()=>{
 const {server,url}=await serve();
 let browser;
 try{
  browser=await chromium.launch({executablePath:browserPath(),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:850}});
   const page=await ctx.newPage(),errors=[];
   let submissions=0,evidenceReads=0;
   page.on("pageerror",e=>errors.push(String(e)));
   await page.route(/^https:\/\//,route=>route.abort());
   await page.route("**/api/nominations",route=>{
    if(route.request().method()==="POST"){submissions++;return route.abort()}
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     candidates:[{id:10,name:"Reveka, Wizard Savant",votes:3},{id:11,name:"Rohgahh of Kher Keep",votes:1}],
     leader:{id:10,name:"Reveka, Wizard Savant",votes:3},pendingCount:0,totalVotes:4
    })});
   });
   await page.route("**/api/field-expansion?*",route=>{
    const u=new URL(route.request().url());
    if(u.searchParams.get("action")!=="evidence")return route.abort();
    evidenceReads++;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     items:[{id:"a".repeat(32),title:"Underrated synergy",body:'Testing <img src=x onerror=alert(1)> in a Commander list.',handle:"Explorer",status:"featured"}],
     case:"commander-mustard",voted:[]
    })});
   });
   try{
    await page.goto(url+"/nominations.html",{waitUntil:"domcontentloaded"});
    await page.locator("#nominationLeaderboard .rescue-board-entry").first().waitFor();
    assert.equal(await page.locator("#nominationLeaderboard .rescue-board-entry").count(),2);
    assert.equal(await page.locator(".rescue-board-stages>span").count(),4);
    assert.equal(await page.locator("nav.primary-nav a").filter({hasText:"RESCUE BOARD"}).count(),0);
    assert.equal(await page.locator("#rescuePublishedList li").count(),4);
    assert.equal(await page.locator(".rescue-published-fold").evaluate(el=>el.open),false);
    await page.locator(".rescue-board-summary").first().click();
    assert.equal(await page.locator(".rescue-board-entry").first().evaluate(el=>el.open),true);
    await page.getByRole("button",{name:"SHARE A BUILD IDEA ↗"}).first().click();
    assert.equal(await page.locator("#nomCommander").inputValue(),"Reveka, Wizard Savant");
    assert.equal(await page.evaluate(()=>document.activeElement.id),"nomStrategy");
    assert.equal(submissions,0,"Viewing and prefilling must never cast a vote");
    await page.locator(".rescue-published-fold>summary").click();
    assert.equal(await page.locator(".rescue-published-fold").evaluate(el=>el.open),true);
    const reportLink=page.locator("#rescuePublishedList a.rescue-published-link").filter({hasText:"Commander Mustard"});
    assert.match(await reportLink.getAttribute("href"),/reports\/commander-mustard/);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),"Nomination horizontal overflow at "+width);
    await page.goto(url+"/reports/commander-mustard.html",{waitUntil:"domcontentloaded"});
    const fold=page.locator("#reportCommunityFindings");
    await fold.waitFor();
    assert.equal(await fold.evaluate(el=>el.open),false);
    assert.equal(evidenceReads,0,"Closed disclosure must not request public research");
    await fold.locator("summary").click();
    await page.locator(".report-community-item").first().waitFor();
    assert.equal(evidenceReads,1);
    assert.equal(await page.locator(".report-community-item img").count(),0,"Untrusted text must never become live HTML");
    assert.match(await page.locator(".report-community-item").first().textContent(),/<img src=x onerror=alert\(1\)>/);
    assert.ok((await page.locator(".report-community-actions a").allTextContents()).some(x=>x.includes("FOLLOW")));
    await fold.locator("summary").click();
    await fold.locator("summary").click();
    assert.equal(evidenceReads,1,"Already loaded findings should not refetch on every toggle");
    assert.deepEqual(errors,[],"Unexpected browser errors at "+width);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
