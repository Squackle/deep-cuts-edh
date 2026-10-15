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
   await page.route(/^https:\/\//,route=>route.abort());
   try{
    await page.goto(url+"/",{waitUntil:"domcontentloaded"});
    await page.locator(".header-profile-enabled .header-profile-button").waitFor();
    await page.locator(".site-supporter-strip").waitFor();
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
    assert.deepEqual(errors,[],"Uncaught browser errors at "+width);
   }finally{await ctx.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>httpServer.close(resolve))}
});
