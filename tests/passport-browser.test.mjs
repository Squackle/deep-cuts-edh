import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {launchBrowser} from "./helpers/browser.mjs";

const source=readFileSync(new URL("../passport.js",import.meta.url),"utf8");
const stats=n=>({verifiedSource:true,games:{daily:[{completed:n,won:1}],arcane:[]},community:{publishedDecks:2,challengeEntries:0,visibleContributions:1,playtests:0}});
test("Passport retains available verified sections, deduplicates pending refresh and clears stale investigator records",{timeout:45000},async()=>{
 let browser,release;
 const gate=new Promise(resolve=>{release=resolve});
 try{
  browser=await launchBrowser();
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  let current="Alice",counts={};
  await page.route("http://passport.test/**",async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==="/")return route.fulfill({contentType:"text/html",body:'<!doctype html><div id="passportStatus"></div><div id="passportStats"></div><div id="passportAwards"></div><script type="module" src="/passport.js"></script>'});
   if(u.pathname==="/passport.js")return route.fulfill({contentType:"application/javascript",body:source});
   if(u.pathname==="/community.js")return route.fulfill({contentType:"application/javascript",body:'export const state={me:null,key:""};'});
   if(u.pathname==="/api/community"||u.pathname==="/api/daily-games"){
    const handle=u.searchParams.get("handle")||current;
    const k=handle+u.pathname;counts[k]=(counts[k]||0)+1;
    if(handle==="Bob"){await gate;try{await route.fulfill({json:u.pathname==="/api/community"?stats(99):{badges:[{title:"Bob award"}]}})}catch{}return}
    if(handle==="Charlie"&&u.pathname==="/api/daily-games")return route.fulfill({status:503,json:{error:"Unavailable"}});
    if(handle==="Dana"&&u.pathname==="/api/community")return route.fulfill({json:{verifiedSource:true,games:{daily:[]},community:{}}});
    return route.fulfill({json:u.pathname==="/api/community"?stats(handle==="Charlie"?3:7):{badges:[{title:handle+" award"}]}});
   }
   return route.fulfill({status:404,body:"Not found"});
  });
  await page.goto("http://passport.test/",{waitUntil:"domcontentloaded"});
  const switchTo=async handle=>{
   current=handle;
   await page.evaluate(async h=>{
    const {state}=await import("/community.js");
    state.me=h?{handle:h}:null;
    window.dispatchEvent(new Event("deepcuts:profile-change"));
    window.dispatchEvent(new Event("pageshow"));
   },handle);
  };
  await switchTo("Alice");
  await page.getByText("Alice award",{exact:true}).waitFor();
  assert.equal(await page.locator("#passportStats .passport-stat strong").first().textContent(),"7");
  assert.equal(counts["Alice/api/community"],1);
  assert.equal(counts["Alice/api/daily-games"],1);
  await switchTo("Bob");
  assert.equal(await page.getByText("Alice award",{exact:true}).count(),0);
  assert.equal(await page.locator("#passportStats .passport-stat").count(),0);
  await switchTo("Charlie");
  await page.getByText("Verified game awards are temporarily unavailable.",{exact:true}).waitFor();
  assert.equal(await page.locator("#passportStats .passport-stat strong").first().textContent(),"3");
  release();
  assert.match(await page.locator("#passportStatus").textContent(),/Some verified records/);
  await switchTo("Dana");
  await page.getByText("Dana award",{exact:true}).waitFor();
  assert.equal(await page.locator("#passportStats .passport-stat").count(),0);
  assert.match(await page.locator("#passportStats").textContent(),/temporarily unavailable/);
  await switchTo(null);
  assert.equal(await page.locator("#passportAwards").textContent(),"");
  assert.equal(await page.locator("#passportStats").textContent(),"");
  assert.match(await page.locator("#passportStatus").textContent(),/Sign in/);
  assert.deepEqual(errors,[]);
 }finally{release();await browser?.close()}
});
