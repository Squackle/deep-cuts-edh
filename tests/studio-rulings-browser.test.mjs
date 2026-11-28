import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {launchBrowser} from "./helpers/browser.mjs";

test("CodeQL #5: actual lookup handler rejects foreign requests and renders safe legitimate rulings",{timeout:30000},async()=>{
 const browser=await launchBrowser();
 try{
  const page=await browser.newPage();
  const id="12345678-1234-1234-1234-123456789abc";
  const origin="https://studio.test";
  const canonical="https://api.scryfall.com/cards/"+id+"/rulings";
  const cardLink="https://scryfall.com/card/mh3/123/example";
  const payload='<img src=x onerror="window.__xss=1">';
  let fixture={id,name:"Example card",rulings_uri:canonical,scryfall_uri:cardLink};
  const requests=[];
  let redirect=false;
  await page.route("**/*",async route=>{
   const u=new URL(route.request().url());
   if(u.origin===origin){
    if(u.pathname==="/")return route.fulfill({contentType:"text/html",body:'<!doctype html><input id="rulingCard"><button id="lookupRulings">Look up</button><div id="rulingsStatus"></div><div id="rulingsResults"></div><script type="module" src="/studio-v3.js"></script>'});
    if(["/studio-v3.js","/shared.js","/src/studio-rulings-url.mjs"].includes(u.pathname))
     return route.fulfill({contentType:"application/javascript",body:readFileSync(new URL(".."+u.pathname,import.meta.url),"utf8")});
    return route.abort();
   }
   requests.push(u.href);
   const headers={"access-control-allow-origin":"*"};
   if(u.origin==="https://api.scryfall.com"&&u.pathname==="/cards/named")return route.fulfill({headers,json:fixture});
   if(u.href===canonical){
    if(redirect)return route.fulfill({status:302,headers:{...headers,location:"https://evil.test/redirected"}});
    return route.fulfill({headers,json:{data:[{source:"wotc",published_at:"2026-01-01",comment:payload}]}});
   }
   return route.abort();
  });
  await page.goto(origin);
  const button=page.locator("#lookupRulings"),status=page.locator("#rulingsStatus");
  await page.locator("#rulingCard").fill("Example card");
  await button.click();
  await page.waitForFunction(()=>document.querySelector("#rulingsStatus").textContent.includes("published rulings shown"));
  assert.equal(await page.locator(".ruling-entry p").textContent(),payload);
  assert.equal(await page.locator("#rulingsResults img").count(),0);
  assert.equal(await page.locator("#rulingsResults a").getAttribute("href"),cardLink);
  assert.equal(await page.evaluate(()=>window.__xss),undefined);
  assert.equal(requests.filter(x=>x===canonical).length,1);
  for(const bad of ["https://evilscryfall.com/cards/"+id+"/rulings","not a URL",canonical.replace("/rulings","/other")]){
   fixture={...fixture,rulings_uri:bad};
   await button.click();
   await page.waitForFunction(()=>document.querySelector("#rulingsStatus").textContent.includes("Unexpected rulings source"));
   assert.equal(await page.locator("#rulingsResults a").count(),0);
  }
  assert.equal(requests.filter(x=>x===canonical).length,1);
  fixture={...fixture,rulings_uri:canonical,scryfall_uri:"javascript:alert(1)"};
  await button.click();
  await page.waitForFunction(()=>document.querySelector("#rulingsStatus").textContent.includes("published rulings shown"));
  assert.equal(await page.locator("#rulingsResults a").getAttribute("href"),"https://scryfall.com");
  redirect=true;
  await button.click();
  await page.waitForFunction(()=>document.querySelector("#rulingsStatus").textContent.includes("Couldn't find card rulings"));
  assert.equal(await page.locator("#rulingsResults a").count(),0);
  assert.ok(requests.every(x=>new URL(x).origin==="https://api.scryfall.com"),JSON.stringify(requests));
 }finally{await browser.close()}
});