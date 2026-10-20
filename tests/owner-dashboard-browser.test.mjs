import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {launchBrowser} from "./helpers/browser.mjs";


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
  browser=await launchBrowser();
  for(const width of [320,390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:860}});
   const page=await ctx.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   // Simulate server-side, read-only owner verification. No actual owner key is used.
   const validKey="dcissuer1_"+"a".repeat(64);
   let verifiedCalls=0;
   await page.route("**/api/owner-ops?view=overview",route=>{
    verifiedCalls++;
    const correct=route.request().headers().authorization==="Bearer "+validKey;
    return route.fulfill({status:correct?200:403,contentType:"application/json",
     body:JSON.stringify(correct?{ok:true,view:"overview",stats:{}}:{error:"Owner authorization required."})});
   });
   await page.route("**/api/owner-ops?view=presence",route=>route.fulfill({
    status:200,contentType:"application/json",body:JSON.stringify({
     ok:true,view:"presence",registeredMembers:12,presence:{online:3,pages:{Home:3}}
    })
   }));
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(url+"/member-operations.html",{waitUntil:"networkidle"});
    assert.equal(await page.title(),"Owner Command Center | Deep Cuts EDH");
    assert.equal(await page.locator(".owner-v2-menu-button").count(),7);
    assert.equal(await page.locator(".owner-v2-home").isVisible(),true);
    assert.equal(await page.locator("#owner-panel-members").isVisible(),false);
    assert.equal(await page.locator(".owner-presence-stat").count(),3,"Three private metrics are visible in the header");
    const bound=await page.evaluate(()=>{
     const form=document.querySelector("#opsForm");
     const k=form.elements.operatorKey;
     return {bound:!!k,connected:k?.isConnected,type:k?.type,inForm:form.contains(k),mainWidth:document.querySelector("main.ops").scrollWidth,viewport:window.innerWidth}
    });
    assert.ok(bound.bound&&bound.connected&&bound.type==="password"&&!bound.inForm,"Owner key must remain form-associated after moving to toolbar: "+JSON.stringify(bound));
    assert.ok(bound.mainWidth<=(width+2), "Owner panel horizontal overflow: "+JSON.stringify(bound));
    const cases=[["Business","Paid memberships","members","#opsForm"],["Community","Member directory","directory","#ownerTable"],["Business","Free keys","grants","#complimentaryForm"],["Community","Evidence","evidence","#ownerEvidenceForm"],["Business","Ad-free","adfree","#ownerAdFreeForm"]];
    for(const [group,label,tab,form] of cases){
     await page.locator('[data-owner-v2-group="'+group+'"]').click();
     await page.getByRole("button",{name:label,exact:true}).click();
     assert.equal(await page.locator("#owner-panel-"+tab).isVisible(),true,tab);
     assert.equal(await page.locator(form).count(),1,form);
    }
    await page.locator('[data-owner-v2-group="Business"]').click();
    await page.getByRole("button",{name:"Free keys",exact:true}).click();
    await page.locator("#owner-panel-grants input[name=label]").fill("QA sample");
    const input=page.locator('.owner-key-label input[name=operatorKey]');
    assert.equal(await page.locator("#ownerUnlock").count(),1,"Unlock button exists");
    const actions=await page.locator(".owner-access-actions").locator("button").evaluateAll(
      buttons=>buttons.map(b=>b.id)
    );
    assert.deepEqual(actions,["ownerUnlock","ownerLock"],"Unlock appears immediately left of Lock & clear");
    await input.fill("dcissuer1_"+"b".repeat(64));
    await page.locator("#ownerUnlock").click();
    await page.waitForFunction(()=>document.getElementById("ownerLockStatus").textContent.includes("not accepted"));
    assert.equal(await page.locator(".owner-presence-stat strong").first().textContent(),"—","Invalid key must not unlock");
    await page.evaluate(()=>{window.__ownerUnlockNoNavigationMarker=37});
    await input.fill(validKey);
    await page.locator("#ownerUnlock").click();
    await page.waitForFunction(()=>document.getElementById("ownerLockStatus").textContent.includes("Owner verified"));
    await page.waitForFunction(()=>document.querySelector(".owner-presence-stat strong").textContent==="3");
    assert.equal(verifiedCalls,2,"Unlock must check the server, not only key shape");
    assert.equal(await page.locator(".owner-presence-stat strong").nth(1).textContent(),"12");
    assert.equal(await page.evaluate(()=>window.__ownerUnlockNoNavigationMarker),37,"Unlock must not reload page");
    assert.equal(await input.inputValue(),validKey,"Key stays only in the current page until locked or reloaded");
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0,"No owner credential stored in browser storage");
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
    assert.equal(await page.locator(".owner-presence-stat strong").first().textContent(),"—","Lock wipes visitor metrics");
    assert.equal(await page.locator("#owner-panel-grants input[name=label]").inputValue(),"");
    assert.equal(await page.locator("#ownerLockStatus").textContent(),"Owner key cleared. Re-enter it to continue.");
    await input.fill(validKey);
    await page.locator("#ownerUnlock").click();
    await page.waitForFunction(()=>document.getElementById("ownerLockStatus").textContent.includes("Owner verified"));
    await page.reload({waitUntil:"networkidle"});
    assert.equal(await page.locator('.owner-key-label input[name=operatorKey]').inputValue(),"","Reload does not remember owner secret");
    assert.equal(await page.locator("#ownerUnlock").count(),1);
    assert.deepEqual(errors,[], "Unexpected browser errors at "+width);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>httpServer.close(resolve))}
});