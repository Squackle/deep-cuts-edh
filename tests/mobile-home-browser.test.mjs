// Regression: compact mobile homepage header and readable/footer touch targets.
// Browser runs against the real homepage scripts and stylesheet cascade.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";

function chrome(){
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  try{const cmd=execFileSync("which",[bin],{encoding:"utf8"}).trim();if(cmd)return cmd}catch{}
 }
 throw Error("Chromium browser unavailable");
}
const contentTypes={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml",".png":"image/png"};
async function server(){
 const root=process.cwd(),httpServer=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://localhost"),p=url.pathname==="/"?"/index.html":url.pathname;
  const filename=path.resolve(root,"."+p);
  if(!filename.startsWith(root+path.sep))return res.writeHead(403).end();
  try{const bytes=fs.readFileSync(filename);res.writeHead(200,{"Content-Type":contentTypes[path.extname(filename)]||"text/plain"}).end(bytes)}
  catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(resolve=>httpServer.listen(0,"127.0.0.1",resolve));
 return {httpServer,url:"http://127.0.0.1:"+httpServer.address().port};
}
test("Mobile homepage navigation, supporter strip, hero and footer remain compact and tappable",{timeout:45000},async()=>{
 const {httpServer,url}=await server();
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [320,390,600,1280]){
   const ctx=await browser.newContext({viewport:{width,height:844}});
   const page=await ctx.newPage();
   const errors=[];page.on("pageerror",e=>errors.push(String(e)));
   await page.route("**/api/supporter-ticker",route=>route.fulfill({status:200,contentType:"application/json",body:'{"supporters":[]}'}));
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(url+"/",{waitUntil:"domcontentloaded"});
    await page.locator(".header-profile-enabled .header-profile-button").waitFor();
    await page.locator(".site-supporter-strip").waitFor();
    await page.locator(".site-supporter-track.is-scrolling").waitFor();
    assert.ok(await page.locator(".site-supporter-unit").count()>=4,"Empty invitation must repeat and animate seamlessly");
    assert.equal(await page.locator(".site-supporter-name").count(),0,"Empty state must not fabricate a donor");
    assert.equal(await page.locator(".site-supporter-track").evaluate(el=>getComputedStyle(el).animationName),"site-supporter-roll");
    const before=await page.locator(".site-supporter-track").evaluate(el=>el.getBoundingClientRect().left);
    await page.waitForTimeout(180);
    const after=await page.locator(".site-supporter-track").evaluate(el=>el.getBoundingClientRect().left);
    assert.ok(after<before-1,"Empty supporter invitation must visibly move at "+width+"px");
    assert.equal(await page.locator(".site-supporter-track a:not([tabindex])").count(),1,"Only the real invitation link should be keyboard-focusable");

    const m=await page.evaluate(()=>{
     const one=s=>document.querySelector(s);
     const style=s=>getComputedStyle(one(s));
     const rect=s=>one(s).getBoundingClientRect();
     const footer=[...document.querySelectorAll(".site-footer .footer-links a")];
     return {
      pageWidth:document.documentElement.scrollWidth,
      viewport:window.innerWidth,
      headerHeight:rect(".site-header").height,
      shortcutDisplay:style(".site-mobile-shortcuts").display,
      supportDisplay:style(".site-support-action").display,
      menuDisplay:style(".site-menu-toggle").display,
      tickerHeight:rect(".site-supporter-strip").height,
      footerDisplay:style(".site-footer .footer-links").display,
      footerColumns:style(".site-footer .footer-links").gridTemplateColumns.split(" ").length,
      footerRects:footer.map(a=>a.getBoundingClientRect().toJSON()),
      footerNames:footer.map(a=>a.textContent.trim()),
      heroVisible:rect("#hubTitle").height>20,
      desktopNav:style(".site-desktop-navigation").display,
      menuOverflow:document.querySelector(".header-inner").scrollWidth>document.querySelector(".header-inner").clientWidth
     };
    });
    assert.ok(m.pageWidth<=m.viewport+1,`Horizontal overflow at ${width}px: ${JSON.stringify(m)}`);
    assert.equal(m.heroVisible,true);
    assert.equal(m.footerRects.length,7);
    if(width<=600){
     for(const r of m.footerRects)assert.ok(r.width>100&&r.height>=40,`Unreadable footer link at ${width}px`);
     assert.equal(m.shortcutDisplay,"none");
     assert.equal(m.supportDisplay,"none");
     assert.notEqual(m.menuDisplay,"none");
     assert.ok(m.headerHeight<=122,`Sticky header overly tall at ${width}: ${m.headerHeight}`);
     assert.ok(m.tickerHeight>=27&&m.tickerHeight<=30);
     assert.equal(m.footerDisplay,"grid");
     assert.equal(m.footerColumns,width<=350?1:2);
     assert.equal(m.menuOverflow,false,`Menu overflow at ${width}px`);
     await page.locator(".site-menu-toggle").click();
     await page.locator(".primary-nav.site-nav-open a").first().waitFor();
     assert.ok(await page.locator(".primary-nav.site-nav-open a[href='/set-watch']").count(),"Set Watch missing in mobile menu");
     assert.ok(await page.locator(".primary-nav.site-nav-open a[href='/games']").count(),"Arcade missing in mobile menu");
     assert.ok(m.footerNames.includes("SUPPORT"),"Support must remain accessible in footer");
    }else{
     assert.notEqual(m.desktopNav,"none","Desktop navigation was unintentionally hidden");
    }
    // The public HTMLRewriter injects the presence asset in production; the
    // static fixture adds it directly to test its actual mobile layout.
    await page.locator(".dc-feedback-launch").waitFor();
    await page.addStyleTag({url:url+"/site-presence.css"});
    await page.evaluate(()=>{
     const pill=document.createElement("div");
     pill.className="dc-online-pill";
     const dot=document.createElement("span");dot.className="dc-online-dot";
     const count=document.createElement("span");count.className="dc-online-number";count.textContent="12";
     const label=document.createElement("span");label.className="dc-online-label";label.textContent="online";
     pill.append(dot,count,label);document.body.append(pill);
    });
    const floating=await page.evaluate(()=>{
     const feedback=document.querySelector(".dc-feedback-launch");
     const pill=document.querySelector(".dc-online-pill");
     const a=feedback.getBoundingClientRect(),b=pill.getBoundingClientRect();
     return {feedback:a.toJSON(),pill:b.toJSON(),screenWidth:innerWidth,
      pointerEvents:getComputedStyle(pill).pointerEvents};
    });
    assert.ok(floating.pill.bottom<=floating.feedback.top-4,
      "Compact count must clear Feedback by at least 4px at "+width+"px: "+JSON.stringify(floating));
    assert.ok(floating.pill.height<=25&&floating.pill.width<=95,
      "Moxgate-inspired count must stay small at "+width+"px: "+JSON.stringify(floating));
    assert.ok(floating.pill.right<=width+1&&floating.pill.left>=0,
      "Counter must stay within viewport at "+width+"px: "+JSON.stringify(floating));
    assert.equal(floating.pointerEvents,"none","Counter must not intercept Feedback taps");
    assert.deepEqual(errors,[],"Uncaught browser errors at "+width);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>httpServer.close(resolve))}
});

test("Opted-in supporter tiers still animate; reduced-motion visitors see a stationary accessible link",{timeout:30000},async()=>{
 const {httpServer,url}=await server();let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const reduce of [false,true]){
   const ctx=await browser.newContext({viewport:{width:390,height:780},reducedMotion:reduce?"reduce":"no-preference"});
   const page=await ctx.newPage();
   await page.route("**/api/supporter-ticker",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({supporters:[{name:"Sample Chief",tier:"chief"},{name:"Sample Detective",tier:"detective"}]})}));
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(url+"/",{waitUntil:"domcontentloaded"});
    await page.locator(".site-supporter-strip.has-supporters").waitFor();
    const names=await page.locator(".site-supporter-unit").first().locator(".site-supporter-name").allTextContents();
    assert.deepEqual(names,["Sample Chief","Sample Detective"]);
    const track=page.locator(".site-supporter-track");
    assert.equal(await track.evaluate(el=>getComputedStyle(el).animationName),reduce?"none":"site-supporter-roll");
    const hidden=await page.locator(".site-supporter-track [aria-hidden='true'] a").count();
    assert.ok(hidden>=2,"Repeated copies must remain inaccessible to keyboard and screen readers");
    if(reduce)assert.equal(await page.locator(".site-supporter-track .site-supporter-unit").first().locator("a").first().getAttribute("tabindex"),null);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>httpServer.close(resolve))}
});
