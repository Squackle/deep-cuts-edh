import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";
function chrome(){
 for(const cmd of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  try{let p=execFileSync("which",[cmd],{encoding:"utf8"}).trim();if(p)return p}catch{}
 }
 throw Error("Chromium unavailable");
}
async function host(){
 const root=process.cwd();
 const srv=http.createServer((req,res)=>{
  const file=path.resolve(root,"."+new URL(req.url,"http://local").pathname);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const t={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml"}[path.extname(file)]||"text/plain";
   res.writeHead(200,{"Content-Type":t}).end(fs.readFileSync(file))
  }catch{res.writeHead(404).end("Missing")}
 });
 await new Promise(ok=>srv.listen(0,"127.0.0.1",ok));
 return {srv,url:"http://127.0.0.1:"+srv.address().port};
}
const result=(view)=>{
 const empty={overview:{stats:{nominations:1,reports:0,feedback:1,drafts:0,active_grants:0}},moderation:{nominations:[{id:42,name:"QA Commander",rationale:"Interesting synergy",strategy:"Test deck",votes:3}],reports:[],evidence:[]},feedback:{feedback:[{id:1,category:"bug",message:"A test report",page:"/games",status:"new",created_at:"2026-10-15"}]},publishing:{drafts:[],candidates:[]},games:{daily:[{game:"cold",plays:3,wins:1,average_score:170}],arcane:[],hive:[{mode:"brood",rules_version:"hive-1.3",runs:4,average_score:120,best_score:230,average_evolutions:1}],note:"Mock scores"},integrity:{sessions:[],scores:[],note:"No fraud assumptions"},schedule:{cold:[],arcane:[],challenge:[]},site:{records:{profiles:2,decks:3},webhook:[],audit:[{category:"feedback",action:"reviewed",target:"1",occurred_at:1781000000}]},revenue:{summary:{active_renewals:0,recorded_cents_30d:0},note:"Only webhook data"},analytics:{activity:{new_profiles_30d:0},content:[],note:"No web visitors"},features:{flags:[{flag:"public_nominations",enabled:1},{flag:"public_feedback",enabled:1}]},recovery:{tables:[{name:"nominations"}],latest:[],note:"Restores handled in Cloudflare"}};
 return {ok:true,view,...(empty[view]||{})};
};
test("Command Center 2.0 home, sections, real-form preservation, owner API actions, lock, mobile layout",{timeout:75000},async()=>{
 const {srv,url}=await host();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [320,390,768,1280]){
   const ctx=await browser.newContext({viewport:{width,height:870}});
   const page=await ctx.newPage(),errors=[],requests=[];
   page.on("pageerror",e=>errors.push(String(e)));
   await page.route(/^https:\/\//,r=>r.abort());
   await page.route("**/api/owner-ops**",route=>{
    const req=route.request();
    const view=new URL(req.url()).searchParams.get("view")||"overview";
    let payload={};
    try{payload=req.postDataJSON()||{}}catch{}
    requests.push({method:req.method(),view,payload,auth:!!req.headers().authorization});
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(req.method()==="POST"?{ok:true,message:"Saved and audited"}:result(view))});
   });
   try{
    await page.goto(url+"/member-operations.html",{waitUntil:"networkidle"});
    assert.equal(await page.locator(".owner-v2-home h2").textContent(),"Welcome back.");
    assert.equal(await page.locator(".owner-v2-home-tile").count(),6);
    assert.equal(await page.locator(".owner-v2-menu-button").count(),7);
    assert.equal(await page.locator(".owner-key-label input[name=operatorKey]").count(),1);
    const overflow=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
    assert.ok(overflow.body<=width+2,"Mobile horizontal overflow "+JSON.stringify(overflow));
    await page.locator('[data-owner-v2-group="Community"]').click();
    await page.getByRole("button",{name:"Moderation",exact:true}).click();

    await page.locator(".owner-v2-tool-panel .owner-v2-message").first().waitFor({state:"attached"});
    await page.locator('.owner-key-label input[name="operatorKey"]').fill("dcissuer1_"+"a".repeat(64));
    await page.getByRole("button",{name:"Community",exact:true}).first().click();
    await page.getByRole("button",{name:"Moderation",exact:true}).click();
    await page.getByText("QA Commander").waitFor();
    assert.ok(requests.some(r=>r.view==="moderation"&&r.auth));
    page.on("dialog",dialog=>dialog.accept());
    await page.getByRole("button",{name:"Approve",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector(".owner-v2-message")?.textContent!==undefined);
    // Confirm dialog is supplied in advance for state-changing actions.
    await page.getByRole("button",{name:"Home",exact:true}).first().click();
    await page.locator('[data-owner-v2-group="Content"]').click();
    await page.getByRole("button",{name:"Publishing",exact:true}).click();
    await page.getByText(/Manage research and draft status/).waitFor();
    await page.locator('.owner-v2-editor input[name="commander"]').fill("Chainer");
    await page.locator('.owner-v2-editor input[name="title"]').fill("An updated research note");
    await page.getByRole("button",{name:"Save editorial record"}).click();
    await page.waitForTimeout(100);
    assert.ok(requests.some(r=>r.payload.kind==="editorial"));
    for(const [group,section] of [["Games","Game statistics"],["Business","Free keys"],["Site","Feature switches"],["Security","Admin activity"]]){
      await page.locator('[data-owner-v2-group="'+group+'"]').click();
      await page.getByRole("button",{name:section,exact:true}).click();
      if(section==="Free keys")assert.equal(await page.locator("#complimentaryForm").isVisible(),true);
    }
    await page.locator('[data-owner-v2-group="Site"]').click();
    await page.getByRole("button",{name:"Site status",exact:true}).click();
    await page.getByText("2",{exact:true}).first().waitFor();
    await page.locator("#ownerLock").click();
    assert.equal(await page.locator('.owner-key-label input[name=operatorKey]').inputValue(),"");
    assert.equal(await page.locator(".owner-v2-home").isVisible(),true);
    assert.equal(await page.getByText("QA Commander").count(),0);
    assert.deepEqual(errors,[]);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(ok=>srv.close(ok))}
});
