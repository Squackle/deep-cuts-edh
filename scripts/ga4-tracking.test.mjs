import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";

const root=fileURLToPath(new URL("../",import.meta.url));
const read=p=>readFileSync(path.join(root,p),"utf8");
const ga=read("site-analytics.js");
const site="https://deep-cuts-edh.pages.dev";
const measurement="G-7SGFYBRH9H";

const visit=(pathname="/games",options={})=>{
 const appended=[];
 const search=options.search||"";
 const w={location:{pathname,origin:site,href:site+pathname+search}};
 const document={
  referrer:options.referrer||"",
  createElement:tag=>({tag,async:false,src:""}),
  head:{append:tag=>appended.push(tag)}
 };
 const context=vm.createContext({
  window:w,document,navigator:{globalPrivacyControl:!!options.gpc},Date,URL
 });
 vm.runInContext(ga,context,{filename:"site-analytics.js"});
 return {appended,w,context};
};

test("GA4 tag initializes once and sends a public pageview",()=>{
 const {appended,w,context}=visit("/reports/commander-mustard");
 assert.equal(appended.length,1);
 assert.equal(appended[0].tag,"script");
 assert.equal(appended[0].async,true);
 assert.equal(appended[0].src,"https://www.googletagmanager.com/gtag/js?id="+measurement);
 const calls=w.dataLayer.map(args=>Array.from(args));
 assert.equal(calls[0][0],"js");
 assert.equal(calls[1][0],"config");
 assert.equal(calls[1][1],measurement);
 assert.equal(calls[1][2].page_location,site+"/reports/commander-mustard");
 vm.runInContext(ga,context,{filename:"site-analytics.js"});
 assert.equal(appended.length,1,"No duplicate GA loader or config on repeat execution");
 assert.equal(w.dataLayer.length,2);
});

test("private account and owner routes never initialize GA4",()=>{
 for(const p of ["/profile","/profile.html","/members","/members.html",
  "/member-operations.html","/diagnostics","/api/community","/api/owner-ops"]){
  const {appended,w}=visit(p);
  assert.equal(appended.length,0,p);
  assert.equal(w.dataLayer,undefined,p);
 }
});
test("Google Analytics cannot receive query parameters from page and referrer",()=>{
 const {w}=visit("/deep-cut-finder",{search:"?key=PRIVATE_PROFILE_KEY#auth",
  referrer:site+"/community?recovery=PRIVATE_RECOVERY_KEY#token"});
 const value=Array.from(w.dataLayer[1])[2];
 assert.equal(value.page_location,site+"/deep-cut-finder");
 assert.equal(value.page_referrer,site+"/community");
 assert.equal(JSON.stringify(value).includes("PRIVATE"),false);
});
test("browser Global Privacy Control prevents GA4 loading",()=>{
 const {appended,w}=visit("/",{gpc:true});
 assert.equal(appended.length,0);
 assert.equal(w.dataLayer,undefined);
});
test("every public sitemap page has analytics loader, including standalone Stackbreaker",()=>{
 const xml=read("sitemap.xml");
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]));
 assert.ok(urls.length>=24);
 const header=read("header-profile.js");
 assert.match(header,/site-analytics\.js/);
 for(const url of urls){
  const relative=url.pathname==="/"
    ?"index.html":url.pathname.endsWith("/")
     ?url.pathname.slice(1)+"index.html":url.pathname.slice(1)+".html";
  assert.ok(existsSync(path.join(root,relative)),relative);
  const html=read(relative);
  assert.ok(html.includes('src="/site-analytics.js"')||
   /src=["'](?:\/|\.\.\/)?header-profile\.js["']/.test(html),
   "Missing shared GA4 loader from "+relative);
 }
});
test("privacy disclosures include analytics and private-page exclusion",()=>{
 const p=read("privacy.html");
 assert.match(p,/Google Analytics 4/);
 assert.match(p,/private profile, member, owner, and diagnostic pages/);
 assert.match(p,/G-7SGFYBRH9H/);
});
