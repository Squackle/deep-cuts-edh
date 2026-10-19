import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import {execFileSync} from "node:child_process";
import {chromium} from "playwright-core";
import {IDEAS} from "../matchmaker-core.js";
const types={".html":"text/html",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml",".png":"image/png"};
function chrome(){for(const x of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){try{const p=execFileSync("which",[x],{encoding:"utf8"}).trim();if(p)return p}catch{}}throw Error("Chromium unavailable")}
function serve(){
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,"http://localhost").pathname;
  const rel=pathname==="/matchmaker"?"/matchmaker.html":pathname==="/"?"/index.html":pathname;
  const file=path.resolve(root,"."+rel);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.writeHead(200,{"Content-Type":types[path.extname(file)]||"text/plain"}).end(fs.readFileSync(file))}
  catch{res.writeHead(404).end("Not found")}
 });
 return new Promise(resolve=>server.listen(0,"127.0.0.1",()=>resolve({server,url:"http://127.0.0.1:"+server.address().port})));
}
const colorFor=name=>{
 if(name==="Ghen, Arcanum Weaver")return ["W","B","R"];
 if(name==="The Council of Four"||name==="Tameshi, Reality Architect")return ["W","U"];
 if(name==="Rionya, Fire Dancer"||name==="Jaxis, the Troublemaker")return ["R"];
 if(name==="Alandra, Sky Dreamer")return ["U"];
 if(name==="Gretchen Titchwillow")return ["U","G"];
 return ["B"];
};
test("Commander Matchmaker renders five server-verified ideas with no account, accessible controls and no mobile overflow",{timeout:45000},async()=>{
 const {server,url}=await serve();
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:chrome(),args:["--no-sandbox","--disable-dev-shm-usage"]});
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:840}});
   const page=await context.newPage();
   const pageErrors=[];page.on("pageerror",e=>pageErrors.push(e.message));
   let lookupCount=0;
   await page.route("**/api/tool-cards",route=>{
    lookupCount++;
    const names=JSON.parse(route.request().postData()).names;
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({cards:names.map(name=>({
     name,type_line:"Legendary Creature — Test",oracle_text:"",legalities:{commander:"legal"},
     color_identity:colorFor(name),prices:{usd:"1.25"},
     image:"https://cards.scryfall.io/mock.jpg",scryfall_uri:"https://scryfall.com/search?q="+encodeURIComponent(name)
    }))})});
   });
   await page.route("**/api/supporter-ticker",route=>route.fulfill({status:200,contentType:"application/json",body:'{"supporters":[]}'}));
   await page.route(/^https:\/\//,route=>route.abort());
   await page.goto(url+"/matchmaker",{waitUntil:"domcontentloaded"});
   await page.getByRole("button",{name:/SURPRISE ME/}).click();
   await page.locator(".mm-card").first().waitFor();
   await page.waitForFunction(()=>document.querySelectorAll(".mm-card").length===5);
   assert.equal(await page.locator(".mm-card").count(),5);
   assert.equal(lookupCount,1,"Single cached batched card verification, not repeated per selection");
   assert.equal(await page.locator(".mm-card h3").count(),5);
   assert.ok((await page.locator(".mm-card-links a[href^='/deep-cut-finder?commander=']").count())>=5);
   assert.ok((await page.locator(".mm-status").textContent()).includes("verified Commander"));
   const view=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(view.scrollWidth<=view.width+1,"Horizontal overflow "+width+": "+JSON.stringify(view));
   await page.locator("#mmTheme").selectOption("spells");
   await page.getByRole("button",{name:/FIND MY COMMANDER IDEA/}).click();
   await page.waitForFunction(()=>document.querySelectorAll(".mm-card").length===5);
   assert.equal(lookupCount,1,"New preferences reuse verified cards in memory");
   const urlState=new URL(page.url());
   assert.equal(urlState.searchParams.get("theme"),"spells");
   assert.ok((await page.locator(".mm-card").first().textContent()).match(/Wizards|flashback|instants|cycling|spells|Goblins/i));
   assert.deepEqual(pageErrors,[]);
   await context.close();
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});
