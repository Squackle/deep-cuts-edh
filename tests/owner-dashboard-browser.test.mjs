import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";

function chrome(){
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  try{const found=execFileSync("which",[bin],{encoding:"utf8"}).trim();if(found)return found}catch{}
 }
 throw Error("Chromium browser unavailable");
}
const contentTypes={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml"};
async function server(){
 const root=process.cwd();
 const httpServer=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  const file=path.resolve(root,"."+pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.writeHead(200,{"Content-Type":contentTypes[path.extname(file)]||"text/plain"}).end(fs.readFileSync(file))}
  catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(resolve=>httpServer.listen(0,"127.0.0.1",resolve));
 return {httpServer,url:"http://127.0.0.1:"+httpServer.address().port};
}
test("owner command center preserves real forms, tabs and local lock on desktop/mobile",{timeout:60000},async()=>{
 const {httpServer,url}=await server();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [320,390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:860}});
   const page=await ctx.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(url+"/member-operations.html",{waitUntil:"networkidle"});
    assert.equal(await page.title(),"Owner Command Center | Deep Cuts EDH");
    assert.equal(await page.locator(".owner-main-nav button").count(),7);
    assert.equal(await page.locator("#owner-panel-overview").isVisible(),true);
    assert.equal(await page.locator("#owner-panel-members").isVisible(),false);
    const bound=await page.evaluate(()=>{
     const form=document.querySelector("#opsForm");
     const k=form.elements.operatorKey;
     return {bound:!!k,connected:k?.isConnected,type:k?.type,inForm:form.contains(k),mainWidth:document.querySelector("main.ops").scrollWidth,viewport:window.innerWidth}
    });
    assert.ok(bound.bound&&bound.connected&&bound.type==="password"&&!bound.inForm,"Owner key must remain form-associated after moving to toolbar: "+JSON.stringify(bound));
    assert.ok(bound.mainWidth<=(width+2), "Owner panel horizontal overflow: "+JSON.stringify(bound));
    const cases=[["members","#opsForm"],["directory","#ownerTable"],["grants","#complimentaryForm"],["evidence","#ownerEvidenceForm"],["adfree","#ownerAdFreeForm"]];
    for(const [tab,form] of cases){
     await page.locator('[data-owner-panel="'+tab+'"]').click();
     assert.equal(await page.locator("#owner-panel-"+tab).isVisible(),true,tab);
     assert.equal(await page.locator(form).count(),1,form);
    }
    await page.locator("#owner-panel-grants input[name=label]").fill("QA sample");
    await page.locator('.owner-key-label input[name=operatorKey]').fill("dcissuer1_"+"a".repeat(64));
    await page.evaluate(()=>{
     const key=document.querySelector("#issuedKey");
     key.textContent="PRIVATE-QA-NOT-REAL";
     document.querySelector("#issuedKeySection").hidden=false;
     document.querySelector("#ownerStats").textContent="Private statistics QA";
    });
    await page.locator("#ownerLock").click();
    assert.equal(await page.locator('.owner-key-label input[name=operatorKey]').inputValue(),"");
    assert.equal(await page.locator("#issuedKey").textContent(),"");
    assert.equal(await page.locator("#issuedKeySection").isVisible(),false);
    assert.equal(await page.locator("#ownerStats").textContent(),"");
    assert.equal(await page.locator("#owner-panel-grants input[name=label]").inputValue(),"");
    assert.deepEqual(errors,[], "Unexpected browser errors at "+width);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>httpServer.close(resolve))}
});