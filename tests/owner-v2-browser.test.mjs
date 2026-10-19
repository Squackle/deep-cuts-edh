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
 const empty={overview:{stats:{nominations:1,reports:0,feedback:1,drafts:0,active_grants:0}},nominations:{pending:[{id:42,name:"Community Nominee QA",rationale:"A unique strategy <img src=x onerror=alert(1)>",strategy:"Artifact recursion",cards:"Sol Ring",budget:"$100",created_at:"2026-10-15 12:00:00",status:"pending",votes:3}],reviewed:[{id:5,name:"Approved QA Nominee",status:"approved",created_at:"2026-10-14 12:00:00",votes:7}],counts:[{status:"pending",nominations:1},{status:"approved",nominations:1}],note:"Community submissions"},moderation:{nominations:[{id:42,name:"QA Commander",rationale:"Interesting synergy",strategy:"Test deck",votes:3}],reports:[],evidence:[]},feedback:{feedback:[{id:1,category:"bug",message:"A test report",page:"/games",status:"new",created_at:"2026-10-15"}]},publishing:{drafts:[],candidates:[]},games:{daily:[{game:"cold",plays:3,wins:1,average_score:170}],arcane:[],hive:[{mode:"brood",rules_version:"hive-1.3",runs:4,average_score:120,best_score:230,average_evolutions:1}],note:"Mock scores"},integrity:{sessions:[],scores:[],note:"No fraud assumptions"},schedule:{cold:[],arcane:[],challenge:[]},site:{records:{profiles:2,decks:3},webhook:[],audit:[{category:"feedback",action:"reviewed",target:"1",occurred_at:1781000000}]},revenue:{summary:{active_renewals:0,recorded_cents_30d:0},note:"Only webhook data"},capacity:{state:"connected",freeReference:{planVerified:false,label:"Free-tier comparison",workersRequestsDay:100000,d1RowsReadDay:5000000,d1RowsWrittenDay:100000,d1DatabaseBytes:500000000},configuration:{connected:true,message:"Synthetic metrics fixture"},workers:{scope:"Entire Cloudflare account",today:{date:"2026-10-15",requests:321,errors:2},daily:[{date:"2026-10-09",requests:20,errors:0},{date:"2026-10-10",requests:65,errors:1},{date:"2026-10-11",requests:45,errors:0},{date:"2026-10-12",requests:100,errors:1},{date:"2026-10-13",requests:175,errors:0},{date:"2026-10-14",requests:270,errors:1},{date:"2026-10-15",requests:321,errors:2}],mayBeIncomplete:false},d1:{scope:"Entire Cloudflare account",today:{date:"2026-10-15",rowsRead:1500,rowsWritten:13},daily:[{date:"2026-10-09",rowsRead:200,rowsWritten:1},{date:"2026-10-10",rowsRead:450,rowsWritten:2},{date:"2026-10-11",rowsRead:600,rowsWritten:4},{date:"2026-10-12",rowsRead:800,rowsWritten:3},{date:"2026-10-13",rowsRead:975,rowsWritten:6},{date:"2026-10-14",rowsRead:1200,rowsWritten:8},{date:"2026-10-15",rowsRead:1500,rowsWritten:13}],databases:{community:{id:"community",label:"Community D1",sizeBytes:1048576,rowsRead:1200,rowsWritten:11},hive:{id:"hive",label:"Hive Run D1",sizeBytes:131072,rowsRead:300,rowsWritten:2}},mayBeIncomplete:false}},analytics:{activity:{new_profiles_30d:0},content:[],note:"No web visitors"},features:{flags:[{flag:"public_nominations",enabled:1},{flag:"public_feedback",enabled:1}]},recovery:{tables:[{name:"nominations"}],latest:[],note:"Restores handled in Cloudflare"}};
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
    const sweepLink=page.locator(".owner-v2-home .owner-v2-security-cta");
    assert.equal(await sweepLink.count(),1);
    assert.equal(await sweepLink.isVisible(),true);
    assert.equal(await sweepLink.getAttribute("href"),"https://github.com/Squackle/deep-cuts-edh/actions/workflows/security-sweep.yml");
    assert.equal(await sweepLink.getAttribute("target"),"_blank");
    assert.match(await sweepLink.getAttribute("rel"),/noopener/);
    assert.match(await page.locator(".owner-v2-security-help").textContent(),/select Run workflow on main/i);
    assert.equal(await page.locator(".owner-v2-menu-button").count(),7);
    // Read-only service shortcuts have real public logos, accessible names, and safe outbound links.
    const quick=page.locator(".owner-service-quick");
    assert.equal(await quick.isVisible(),true);
    assert.equal(await quick.locator("a.owner-service-card").count(),7);
    assert.equal(await quick.locator("a[href='https://chatgpt.com/']").count(),1);
    assert.equal(await quick.locator("a[href='https://search.google.com/search-console']").count(),1);
    const cloudflare=quick.locator("a[href='https://dash.cloudflare.com/']");
    assert.equal(await cloudflare.getAttribute("target"),"_blank");
    assert.match(await cloudflare.getAttribute("rel"),/noopener noreferrer/);
    assert.equal(await cloudflare.getAttribute("referrerpolicy"),"no-referrer");
    const icons=quick.locator(".owner-service-icon img");
    assert.equal(await icons.count(),7);
    assert.equal(await icons.first().getAttribute("referrerpolicy"),"no-referrer");
    await page.locator('[data-owner-v2-group="Site"]').click();
    await page.getByRole("button",{name:"External services",exact:true}).click();
    const services=page.locator("#owner-panel-services");
    assert.equal(await services.isVisible(),true);
    assert.equal(await services.locator("a.owner-service-card").count(),15);
    assert.equal(await services.locator("a[href='https://search.google.com/search-console/insights']").count(),1);
    assert.equal(await services.locator("a[href='https://adsense.google.com/']").count(),1);
    assert.equal(await services.locator("a[href='https://analytics.google.com/']").count(),1);
    assert.equal(await services.locator("a[href^='https://follow.it/deep-cuts-edh-commander-rescue-reports']").count(),1);
    assert.equal(await services.locator("a[href='https://github.com/Squackle/deep-cuts-edh']").count(),1);
    assert.equal(await services.locator("a[href='https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=en']").count(),1);
    assert.equal(requests.length,0,"Opening the service launcher does not call owner APIs");
    const serviceOverflow=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));
    assert.ok(serviceOverflow.body<=width+2,"Service launcher must not overflow on mobile "+JSON.stringify(serviceOverflow));

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
    // The dedicated Content > Nominations section must show real records, not a blank panel.
    await page.locator('[data-owner-v2-group="Content"]').click();
    await page.getByRole("button",{name:"Nominations",exact:true}).click();
    await page.getByText("Community Nominee QA",{exact:true}).waitFor();
    assert.ok(requests.some(r=>r.view==="nominations"&&r.auth));
    assert.equal(await page.getByText("Approved QA Nominee",{exact:true}).isVisible(),true);
    assert.equal(await page.locator('.owner-v2-nomination-record img').count(),0,"Do not parse nomination rationale as HTML");
    assert.match(await page.locator('.owner-v2-nomination-record').textContent(),/3 recorded votes/);
    const nomination=page.locator('[data-nomination-id="42"]');
    await nomination.getByRole("button",{name:"Approve",exact:true}).click();
    assert.ok(requests.some(r=>r.payload.kind==="nomination"&&r.payload.action==="approved"&&r.payload.id==="42"));
    assert.ok(requests.some(r=>r.method==="GET"&&r.view==="nominations"),"Refresh community nomination data after approval");
    await page.getByRole("button",{name:"Home",exact:true}).first().click();
    await page.locator('[data-owner-v2-group="Content"]').click();
    await page.getByRole("button",{name:"Publishing",exact:true}).click();
    await page.getByText(/Manage research and draft status/).waitFor();
    await page.locator('.owner-v2-editor input[name="commander"]').fill("Chainer");
    await page.locator('.owner-v2-editor input[name="title"]').fill("An updated research note");
    await page.getByRole("button",{name:"Save editorial record"}).click();
    await page.waitForTimeout(100);
    assert.ok(requests.some(r=>r.payload.kind==="editorial"));
    await page.locator('[data-owner-v2-group="Security"]').click();
    await page.getByRole("button",{name:"Security sweep",exact:true}).click();
    const securitySweep=page.getByRole("link",{name:"Run security sweep ↗",exact:true});
    assert.equal(await securitySweep.isVisible(),true);
    assert.equal(await page.locator(".owner-v2-home .owner-v2-security-cta").isVisible(),false);
    for(const [group,section] of [["Games","Game statistics"],["Business","Free keys"],["Site","Feature switches"],["Security","Admin activity"]]){
      await page.locator('[data-owner-v2-group="'+group+'"]').click();
      await page.getByRole("button",{name:section,exact:true}).click();
      if(section==="Free keys")assert.equal(await page.locator("#complimentaryForm").isVisible(),true);
    }
    await page.locator('[data-owner-v2-group="Site"]').click();
    await page.getByRole("button",{name:"Capacity & usage",exact:true}).click();
    await page.getByText("Free-tier comparison · not your verified plan",{exact:true}).waitFor();
    assert.ok(requests.some(r=>r.view==="capacity"&&r.auth),"Capacity view must require owner key");
    assert.equal(await page.locator(".owner-v2-capacity-track").count(),5);
    assert.match(await page.locator(".owner-v2-capacity-trend").first().textContent(),/321/);
    // Lightweight graph appears directly below Today, reusing the same already-loaded metrics.
    const graph=page.locator(".owner-v2-usage-graph");
    assert.equal(await graph.isVisible(),true);
    assert.equal(await graph.getByRole("button").count(),4);
    assert.equal(await graph.getByRole("button",{name:"Worker requests"}).getAttribute("aria-pressed"),"true");
    assert.equal(await graph.locator("svg[role='img'] circle").count(),7);
    assert.match(await graph.locator("svg[role='img']").getAttribute("aria-label"),/2026-10-15 321/);
    assert.match(await graph.locator(".owner-v2-chart-summary").textContent(),/996 over 7 recorded UTC days/);
    const beforeChartInteraction=requests.filter(r=>r.view==="capacity").length;
    await graph.getByRole("button",{name:"D1 rows read"}).click();
    assert.equal(await graph.getByRole("button",{name:"D1 rows read"}).getAttribute("aria-pressed"),"true");
    assert.match(await graph.locator("svg[role='img']").getAttribute("aria-label"),/2026-10-15 1,500/);
    await graph.getByRole("button",{name:"Worker errors"}).click();
    assert.match(await graph.locator(".owner-v2-chart-summary").textContent(),/Worker errors/);
    assert.equal(requests.filter(r=>r.view==="capacity").length,beforeChartInteraction,"Switching chart metric must not fetch another API response");
    assert.equal(await page.locator(".owner-v2-capacity-trend").count(),2,"Existing usage history must remain visible");
    const chartOrder=await page.evaluate(()=>{
      const panel=document.querySelector(".owner-v2-usage-graph");
      const metrics=panel?.parentElement?.querySelector(".owner-v2-stat-grid");
      const quota=panel?.parentElement?.querySelector(".owner-v2-capacity-meter");
      return !!panel&&!!metrics&&!!quota&&!!(metrics.compareDocumentPosition(panel)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(panel.compareDocumentPosition(quota)&Node.DOCUMENT_POSITION_FOLLOWING);
    });
    assert.equal(chartOrder,true,"Graph belongs between Today numbers and quota meters");
    const capacityOverflow=await page.evaluate(()=>({width:document.body.scrollWidth,viewport:window.innerWidth}));
    assert.ok(capacityOverflow.width<=width+2,"Capacity mobile horizontal overflow "+JSON.stringify(capacityOverflow));
    await page.getByRole("button",{name:"Refresh metrics",exact:true}).click();
    assert.ok(requests.filter(r=>r.view==="capacity").length>=2,"Refresh button must request current metrics");
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
