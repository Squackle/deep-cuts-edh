import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";

function chrome(){
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  try{const p=execFileSync("which",[bin],{encoding:"utf8"}).trim();if(p)return p}catch{}
 }
 throw Error("Chromium unavailable");
}
async function server(){
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  const target=path.resolve(root,"."+new URL(req.url,"http://localhost").pathname);
  if(!target.startsWith(root+path.sep))return res.writeHead(403).end();
  try{
   const contentType={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml"}[path.extname(target)]||"text/plain";
   res.writeHead(200,{"Content-Type":contentType}).end(fs.readFileSync(target));
  }catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 return {server,url:"http://127.0.0.1:"+server.address().port};
}
const OWNER="dcissuer1_"+"a".repeat(64);
const KEY="dcmember1_"+"b".repeat(32)+"_"+"c".repeat(64);
const stats={community_profiles:2,verified_recovery_emails:1,pending_recovery_emails:0,public_decks:4,membership_records:1,active_complimentary:1,kofi_linked:0,activated_devices:0};
test("owner command center: each workspace operates, grant success and errors visible, no real credentials issued",{timeout:60000},async()=>{
 const {server:httpServer,url}=await server();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  const ctx=await browser.newContext({viewport:{width:390,height:860}});
  const page=await ctx.newPage(),errors=[],calls=[];
  let grantMode="deny";
  page.on("pageerror",e=>errors.push(String(e)));
  await page.route(/^https:\/\//,route=>route.abort());
  await page.route("**/api/**",route=>{
   const req=route.request(),pathname=new URL(req.url()).pathname;
   const body=req.postDataJSON?.()||{},method=req.method();
   calls.push({pathname,method,action:body?.action,authorization:req.headers().authorization?"bearer-present":"absent"});
   let result={},status=200,contentType="application/json";
   if(pathname==="/api/owner-members"){
    if(method==="GET"){
     const q=new URL(req.url()).searchParams,view=q.get("view");
     if(view==="overview")result={stats};
     else if(view==="profiles")result={profiles:[{id:"z",handle:"fixture",decks:1,comments:0,playtests:0,created_at:"2026-10-01 01:00:00"}]};
     else if(view==="members")result={members:[{id:"b".repeat(32),label:"QA fixture",source:"complimentary",tier:"detective",active:true,expiresAt:1893456000,devices:0,lastSeen:0}]};
     else if(view==="audit")result={events:[{id:"z",action:"issued",tier:"detective",member_id:"b".repeat(32),event_time:1780000000,detail:"QA fixture"}]};
    }else if(body.action==="grant"){
     if(grantMode==="deny"){status=403;result={error:"Owner authorization required."};}
     else if(grantMode==="html"){status=200;contentType="text/html";result="<html>Cloudflare login required</html>";}
     else result={ok:true,key:KEY,tier:body.tier,oneTime:true};
    }else if(body.action==="rotate")result={ok:true,key:KEY,tier:"detective",oneTime:true};
    else if(body.action==="extend")result={ok:true,expiresAt:1893456000};
    else if(body.action==="revoke")result={ok:true,status:"revoked"};
   }else if(pathname==="/api/kofi-member-issue"){
    if(body.action==="lookup")result={ok:true,verifiedPaymentRecorded:false};
    else if(body.action==="issue"||body.action==="replace")result={ok:true,key:KEY,tier:"detective",paidUntil:1893456000};
    else result={ok:true};
   }else if(pathname==="/api/field-expansion")result={ok:true,changed:true};
   else if(pathname==="/api/ad-entitlement")result={ok:true,notice:"Manual ad-free entitlement saved."};
   return route.fulfill({status,contentType,body:typeof result==="string"?result:JSON.stringify(result)});
  });
  try{
   await page.goto(url+"/member-operations.html",{waitUntil:"networkidle"});
   await page.locator('[data-owner-panel="grants"]').click();
   await page.locator('.owner-key-label input[name="operatorKey"]').fill(OWNER);
   await page.locator('#owner-panel-grants input[name="label"]').fill("Self QA");
   await page.locator('#complimentaryForm button[type="submit"]').click();
   await page.getByText("Owner authorization required.",{exact:true}).waitFor();
   assert.equal(await page.locator("#ownerGrantStatus").isVisible(),true);
   assert.equal(await page.locator("#issuedKeySection").isVisible(),false,"Rejected grant must not reveal any credential");
   assert.equal(calls.filter(c=>c.pathname==="/api/owner-members"&&c.action==="grant").length,1);
   grantMode="html";
   await page.locator('#complimentaryForm button[type="submit"]').click();
   await page.getByText(/Owner API returned a login page or unexpected response/).waitFor();
   assert.equal(await page.locator("#issuedKeySection").isVisible(),false);
   grantMode="success";
   await page.locator('#complimentaryForm button[type="submit"]').click();
   await page.locator("#issuedKeySection").waitFor({state:"visible"});
   assert.equal(await page.locator("#issuedKey").textContent(),KEY);
   assert.match(await page.locator("#ownerGrantStatus").textContent(),/One-time.+key issued/);
   assert.equal(await page.locator("#ownerGrantStatus").isVisible(),true,"Success must be visible inside Free access");
   const granted=calls.findLast(c=>c.action==="grant");
   assert.equal(granted.authorization,"bearer-present","Server request must have a separate bearer owner credential");
   // Directory overview, list view, membership record and audit.
   await page.locator('[data-owner-panel="directory"]').click();
   await page.locator("#ownerRefresh").click();
   await page.getByText("Private records loaded.",{exact:false}).waitFor();
   assert.ok((await page.locator("#ownerStats").textContent()).includes("Profiles"));
   assert.equal(await page.locator("#ownerConsoleStatus").isVisible(),true);
   await page.locator('[data-owner-view="members"]').click();
   await page.getByText("QA fixture",{exact:true}).waitFor();
   await page.locator('[data-owner-view="audit"]').click();
   await page.getByText("issued",{exact:true}).waitFor();
   // Membership ledger lookup: no auto-issuance without recorded real Ko-fi payment.
   await page.locator('[data-owner-panel="members"]').click();
   await page.locator('#opsForm input[name="email"]').fill("fixture@example.com");
   await page.locator('#opsForm [data-action="lookup"]').click();
   await page.getByText(/No currently qualifying payment appears/).waitFor();
   // Paid Ko-fi issuance, replacement and revocation use the separate owner key.
   await page.locator('#opsForm input[name="verifiedPayment"]').check();
   await page.locator('#opsForm input[name="verifiedOwnership"]').check();
   await page.locator('#opsForm [data-action="issue"]').click();
   await page.getByText(/key issued · paid-through/).waitFor();
   assert.equal(await page.locator("#issuedKey").textContent(),KEY);
   page.on("dialog",dialog=>dialog.type()==="prompt"?dialog.accept("30"):dialog.accept());
   await page.locator('#opsForm [data-action="replace"]').click();
   await page.waitForFunction(()=>document.querySelector('#operatorStatus').textContent.includes("key issued"));
   await page.locator('#opsForm [data-action="revoke"]').click();
   await page.getByText(/Access revoked. Billing must be handled separately/).waitFor();
   // Existing complimentary membership lifecycle controls.
   await page.locator('[data-owner-panel="directory"]').click();
   await page.locator('[data-owner-view="members"]').click();
   await page.getByText("QA fixture",{exact:true}).waitFor();
   const ownerMutation=async (label,action)=>{
    const response=page.waitForResponse(r=>r.url().endsWith("/api/owner-members")&&r.request().method()==="POST"&&r.request().postDataJSON()?.action===action);
    await page.getByRole("button",{name:label,exact:true}).click();
    await response;
    await page.locator("#ownerRefresh:enabled").waitFor();
   };
   await ownerMutation("EXTEND","extend");
   await ownerMutation("ROTATE KEY","rotate");
   assert.equal(await page.locator("#issuedKey").textContent(),KEY);
   await ownerMutation("REVOKE","revoke");
   assert.ok(["extend","rotate","revoke"].every(action=>calls.some(c=>c.action===action)));
   // Evidence moderation request.
   await page.locator('[data-owner-panel="evidence"]').click();
   await page.locator('#ownerEvidenceForm input[name="evidenceId"]').fill("e".repeat(32));
   await page.locator('#ownerEvidenceForm button[type="submit"]').click();
   await page.getByText(/Finding updated/).waitFor();
   await page.locator('#ownerEvidenceForm select[name="status"]').selectOption("active");
   await page.locator('#ownerEvidenceForm button[type="submit"]').click();
   await page.getByText(/Finding updated/).waitFor();
   await page.locator('#ownerEvidenceForm select[name="status"]').selectOption("hidden");
   await page.locator('#ownerEvidenceForm button[type="submit"]').click();
   await page.getByText(/Finding updated/).waitFor();
   // Ad-free reconciliation request.
   await page.locator('[data-owner-panel="adfree"]').click();
   await page.locator('#ownerAdFreeForm input[name="email"]').fill("fixture@example.com");
   await page.locator('#ownerAdFreeForm input[name="confirmedPayment"]').check();
   await page.locator('#ownerAdFreeForm button[type="submit"]').click();
   await page.getByText("Manual ad-free entitlement saved.").waitFor();
   await page.locator('#ownerAdFreeForm select[name="action"]').selectOption("revoke");
   await page.locator('#ownerAdFreeForm button[type="submit"]').click();
   await page.getByText("Manual ad-free entitlement saved.").waitFor();
   for(const action of ["lookup","issue","replace","revoke"]){
    assert.ok(calls.some(c=>c.pathname==="/api/kofi-member-issue"&&c.action===action),"Missing Ko-fi "+action);
   }

   await page.locator('[data-owner-panel="tools"]').click();
   assert.equal(await page.locator('#owner-panel-tools a[href="diagnostics.html"]').count(),1);
   await page.locator("#ownerLock").click();
   assert.equal(await page.locator('.owner-key-label input[name="operatorKey"]').inputValue(),"");
   assert.equal(await page.locator("#issuedKeySection").isVisible(),false);
   assert.equal(await page.locator("#issuedKey").textContent(),"");
   assert.equal(await page.locator("#ownerGrantStatus").textContent(),"");
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }finally{await browser?.close();await new Promise(ok=>httpServer.close(ok))}
});
