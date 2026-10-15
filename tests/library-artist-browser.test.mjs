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
  const url=new URL(req.url,"http://localhost");
  const name=url.pathname==="/library"?"/library.html":url.pathname;
  const file=path.resolve(root,"."+name);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  try{
   const type=file.endsWith(".js")?"text/javascript":file.endsWith(".html")?"text/html":file.endsWith(".css")?"text/css":file.endsWith(".svg")?"image/svg+xml":"application/octet-stream";
   res.writeHead(200,{"Content-Type":type}).end(fs.readFileSync(file));
  }catch{res.writeHead(404).end("Not found")}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 return {server,url:"http://127.0.0.1:"+server.address().port};
}
test("Artist combobox selects fuzzy suggestion, filters distinct prints, restores share link and clears",{timeout:65000},async()=>{
 const {server,url}=await serve();
 let browser;
 try{
  browser=await chromium.launch({executablePath:browserPath(),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:850}});
   const page=await context.newPage(),errors=[],searches=[],suggestRequests=[];
   page.on("pageerror",e=>errors.push(String(e)));
   await page.route(/^https:\/\//,route=>{
    const path=new URL(route.request().url).pathname;
    if(path==="/cards/search"){
     const requestUrl=new URL(route.request().url),q=requestUrl.searchParams.get("q")||"";
     searches.push({q,unique:requestUrl.searchParams.get("unique")});
     if(q.includes('a:"John Avon"')){
      const card={name:"Forest",oracle_id:"shared",type_line:"Basic Land — Forest",
       prices:{usd:"1.25"},legalities:{commander:"legal"},image_uris:{normal:"/assets/favicon.svg"}};
      route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
       object:"list",data:[{...card,id:"art-one",artist:"John Avon",collector_number:"1",set:"lea"},
        {...card,id:"art-two",artist:"John Avon",collector_number:"2",set:"lea"}],
       has_more:false,total_cards:2})});
     }else route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({object:"list",data:[],has_more:false,total_cards:0})});
    }else route.abort();
   });
   await page.route("**/api/artist-suggest?*",route=>{
    const q=new URL(route.request().url).searchParams.get("q");
    suggestRequests.push(q);
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     suggestions:["John Avon","Jane Avon"].filter(x=>x.toLowerCase().includes("avon")||q.toLowerCase().includes("jon"))
    })});
   });
   await page.route("**/api/card-inclusion?*",route=>route.fulfill({status:200,contentType:"application/json",body:'{"available":false}'}));
   await page.route("**/api/community?*",route=>route.fulfill({status:401,contentType:"application/json",body:'{"error":"Not signed in"}'}));
   await page.route("**/api/supporter-ticker*",route=>route.fulfill({status:200,contentType:"application/json",body:'{"supporters":[]}'}));
   try{
    await page.goto(url+"/library",{waitUntil:"domcontentloaded"});
    if(width<780)await page.getByRole("button",{name:/FILTERS/}).click();
    const field=page.locator("#artistInput");
    await field.fill("jon avon");
    await page.getByRole("option",{name:"John Avon"}).waitFor();
    assert.ok(suggestRequests.length>=1);
    await field.press("ArrowDown");
    assert.equal(await field.getAttribute("aria-activedescendant"),"artistOption0");
    await field.press("Enter");
    assert.equal(await page.locator("#artistSelected").inputValue(),"John Avon");
    assert.equal(await page.locator("#printingFilter").inputValue(),"art");
    await page.waitForFunction(()=>document.querySelectorAll("#cardGallery .library-card").length===2);
    assert.ok(searches.some(x=>x.q.includes('a:"John Avon"')&&x.unique==="art"));
    const link=await page.locator("#openScryfallSearch").getAttribute("href");
    assert.ok(link.includes("John+Avon")||link.includes("John%20Avon"));
    assert.equal(await page.locator('#activeFilterChips button').filter({hasText:"Artist: John Avon"}).count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Mobile horizontal overflow");
    const share=await page.evaluate(()=>import("/library-facets.js").then(m=>m.shareURL()));
    assert.ok(new URL(share).searchParams.get("artist")==="John Avon");
    assert.ok(new URL(share).searchParams.get("print")==="art");
    await page.reload({waitUntil:"domcontentloaded"});
    if(width<780)await page.getByRole("button",{name:/FILTERS/}).click();
    assert.equal(await page.locator("#artistSelected").inputValue(),"John Avon");
    await page.locator("#activeFilterChips button").filter({hasText:"Artist: John Avon"}).click();
    assert.equal(await page.locator("#artistSelected").inputValue(),"");
    assert.equal(await page.locator("#artistInput").inputValue(),"");
    assert.deepEqual(errors,[],"Page script errors at "+width);
   }finally{await context.close()}
  }
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
});
