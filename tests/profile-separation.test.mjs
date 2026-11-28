import test from "node:test";
import "./community-debloat-transition.test.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=x=>fs.readFileSync(x,"utf8");
const community=read("community.html"),profile=read("profile.html"),
 app=read("community.js"),exp=read("field-expansion.js"),header=read("header-profile.js");
// Deliberately narrow static-source contract: consume each selected opening
// tag completely. Do not reinterpret decoded HTML or silently skip bad tokens.
function fixtureTags(markup,starts){
 const tags=[];
 const token=/\s+([A-Za-z_:][A-Za-z0-9_:.-]*)(?:\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)'|([^\s"'=<>`]+)))?/y;
 for(let match;(match=starts.exec(markup));){
  if(match[0]==="<!--"){
   const end=markup.indexOf("-->",starts.lastIndex);
   assert.ok(end>=0,"Unterminated fixture comment");
   starts.lastIndex=end+3;
   continue;
  }
  const attrs=new Map();
  let cursor=starts.lastIndex;
  while(true){
   token.lastIndex=cursor;
   const attr=token.exec(markup);
   if(!attr)break;
   const name=attr[1].toLowerCase();
   assert.ok(!attrs.has(name),"Duplicate fixture attribute: "+name);
   attrs.set(name,attr[2]??attr[3]??attr[4]??null);
   cursor=token.lastIndex;
  }
  const close=/\s*>/y;close.lastIndex=cursor;
  assert.ok(close.exec(markup),"Malformed fixture opening tag");
  starts.lastIndex=close.lastIndex;
  tags.push({attrs,end:close.lastIndex});
 }
 return tags;
}
function panels(html){
 const names=[];
 for(const {attrs} of fixtureTags(html,/<!--|<section(?=[\s/>])/gi)){
  const classes=(attrs.get("class")??"").split(/\s+/);
  const candidate=classes.includes("cm-panel")||attrs.has("data-panel");
  if(!candidate)continue;
  assert.ok(classes.filter(x=>x==="cm-panel").length===1,"Panel requires exact cm-panel class token");
  assert.ok([...attrs.keys()].every(k=>["class","data-panel","hidden"].includes(k)),"Unexpected panel attribute");
  assert.ok(!attrs.has("hidden")||attrs.get("hidden")===null,"Panel hidden must be a boolean attribute");
  const name=attrs.get("data-panel");
  assert.ok(typeof name==="string"&&/^[a-z]+$/.test(name),"Invalid panel name");
  assert.ok(!names.includes(name),"Duplicate panel name");
  names.push(name);
 }
 return names;
}
const scriptSources=html=>fixtureTags(html,/<!--|<script(?=[\s/>])/gi).filter(({attrs})=>attrs.has("src")).map(({attrs})=>{
 const src=attrs.get("src");assert.ok(typeof src==="string"&&src.trim()!=="","Invalid script src");return src;
});
const turnstileURL="https://challenges.cloudflare.com/turnstile/v0/api.js";
function isTurnstileSource(raw){
 if(typeof raw!=="string"||raw!==raw.trim())return false;
 try{
  const u=new URL(raw,"https://deep-cuts-edh.pages.dev/");
  return u.protocol==="https:"&&u.origin==="https://challenges.cloudflare.com"&&!u.username&&!u.password&&!u.port&&u.pathname==="/turnstile/v0/api.js"&&!u.search&&!u.hash;
 }catch{return false}
}
// The absence assertion is stricter than a trusted-source predicate: an
// invalid or unapproved URL on the Turnstile host must not pass as public UI.
function isTurnstileHost(raw){
 try{return new URL(raw,"https://deep-cuts-edh.pages.dev/").hostname==="challenges.cloudflare.com"}catch{return false}
}
const privateBookmark=html=>fixtureTags(html,/<!--|<a(?=[\s/>])/gi).some(({attrs})=>["/profile#account","profile#account","/profile#collection","profile#collection"].includes(attrs.get("href")));
test("Panel extraction requires complete section attributes and distinct exact names",()=>{
 assert.deepEqual(panels('<section class="cm-panel profile-overview" data-panel="overview"></section><section class="cm-panel" data-panel="account" hidden></section>'),["overview","account"]);
 assert.deepEqual(panels('<!-- <section class="cm-panel" data-panel="account"> --><section class="cm-paper">'),[]);
 for(const markup of [
  '<section class="cm-panel" data-panel-extra="account">',
  '<section class="cm-panel" data-panel="account" data-panel="cases">',
  '<section class="cm-panel" class="cm-paper" data-panel="account">',
  '<section class="cm-panel-extra" data-panel="account">',
  '<section class="cm-panel" data-panel="account"junk>',
  '<section class="cm-panel" data-panel="account"',
  '<section class="cm-panel" data-panel="account extra">',
  '<section class="cm-panel" data-panel="account"><section class="cm-panel" data-panel="account">'
 ])assert.throws(()=>panels(markup),{code:"ERR_ASSERTION"});
});
test("Private navigation contracts distinguish exact routes and real Turnstile sources",()=>{
 assert.equal(isTurnstileSource(turnstileURL),true);
 assert.equal(isTurnstileSource("//challenges.cloudflare.com/turnstile/v0/api.js"),true);
 for(const raw of ["https://evil.example/challenges.cloudflare.com/turnstile","https://challenges.cloudflare.com.evil.example/turnstile","https://challenges.cloudflare.com/turnstile-lookalike","http://challenges.cloudflare.com/turnstile/v0/api.js","https://attacker@challenges.cloudflare.com/turnstile/v0/api.js","https://attacker:password@challenges.cloudflare.com/turnstile/v0/api.js","https://challenges.cloudflare.com:444/turnstile/v0/api.js",turnstileURL+"?extra=1",turnstileURL+"#extra",turnstileURL+"/extra","not a URL"])assert.equal(isTurnstileSource(raw),false);
 assert.equal(isTurnstileHost("http://challenges.cloudflare.com/turnstile/v0/api.js"),true);
 assert.equal(isTurnstileHost("https://attacker@challenges.cloudflare.com/turnstile/v0/api.js"),true);
 assert.equal(isTurnstileHost("https://challenges.cloudflare.com:444/turnstile/v0/api.js"),true);
 assert.deepEqual(scriptSources('<script data-src="'+turnstileURL+'"></script>'),[]);
 for(const markup of ["<SCRIPT SRC='"+turnstileURL+"'></SCRIPT>","<script src="+turnstileURL+"></script>"])assert.deepEqual(scriptSources(markup),[turnstileURL]);
 for(const markup of ['<script src="other.js" src="'+turnstileURL+'"></script>','<script src="'+turnstileURL+'" SRC="other.js"></script>','<script src="'+turnstileURL+'"junk></script>','<script src="'+turnstileURL+'"','<script src>'])assert.throws(()=>scriptSources(markup),{code:"ERR_ASSERTION"});
 assert.deepEqual(scriptSources('<!-- <script src="'+turnstileURL+'"></script> -->'),[]);
 assert.equal(privateBookmark('<a href="profile#account">Account</a>'),true);
 assert.throws(()=>privateBookmark('<a href="/wrong" href="/profile#account">Account</a>'),{code:"ERR_ASSERTION"});
 assert.equal(privateBookmark('<!-- <a href="/profile#account">Account</a> -->'),false);
 for(const href of ["https://evil.example/profile#account","/notprofile#account","/profile#account-other","/profile#collection?extra"])assert.equal(privateBookmark('<a href="'+href+'">Account</a>'),false);
});
test("Community has only public social features, with no personal forms or private data panels",()=>{
 assert.deepEqual(panels(community),["cases","decks","challenge","lab","network","evidence","compare","reputation"]);
 for(const bad of ["registerForm","loginForm","recoverStartForm","accountLoggedOut","accountLoggedIn","ownProfile","collectionItems","dispatchList","identitySummary"])
  assert.ok(!community.includes('id="'+bad+'"'),"Leaked private UI: "+bad);
 assert.doesNotMatch(community,/Free profiles use their own recovery keys/);
 assert.ok(!scriptSources(community).some(isTurnstileHost),"Public Community must not load private Turnstile scripts");
});
test("Profile has only personal destinations and intact forms/keys",()=>{
 assert.deepEqual(panels(profile),["overview","collection","following","dispatches","account"]);
 const sources=scriptSources(profile).filter(isTurnstileHost);
 assert.equal(sources.length,1,"Profile has exactly one Turnstile source");
 assert.ok(isTurnstileSource(sources[0]),"Profile requires the approved HTTPS Turnstile script");
 for(const id of ["registerForm","loginForm","recoverStartForm","recoverFinishForm","editProfileForm","deleteAccount",
 "signOut","rememberThisDevice","ownProfile","newKeyBox","profileRecoveryKeyBox",
 "collectionAddForm","collectionImportButton","collectionClearButton","collectionItems",
 "dispatchList","dispatchReadAll","watchlist","activityFeed","profileOverviewSignedOut","profileOverviewSignedIn"]){
  assert.ok(profile.includes('id="'+id+'"'),"Profile UI missing "+id);
 }
 assert.match(profile,/<meta name="robots" content="noindex,follow">/);
 assert.ok(profile.includes('<link rel="canonical" href="https://deep-cuts-edh.pages.dev/profile">'));
 assert.match(profile,/<h1>MY <em>PROFILE\.<\/em><\/h1>/);
});
test("Profile avatar is independent of social navigation and has useful shortcuts",()=>{
 assert.match(header,/const ACCOUNT_URL="\/profile"/);
 for(const url of ["/profile#collection","/profile#dispatches","/profile#account"]){
  assert.ok(header.includes('"'+url+'"'));
 }
 assert.ok(header.includes("header-profile-menu"));
 assert.ok(header.includes('.lab-header[data-profile-header]'),"Do not remove Hive Run shared avatar");
});
test("Existing old personal Community bookmarks redirect to new profile sections",()=>{
 assert.match(app,/location\.replace\("\/profile"\+location\.hash\)/);
 for(const tab of ["account","collection","dispatches","following"]){
  assert.ok(app.includes('"'+tab+'"'),"Missing deep-link route "+tab);
 }
 assert.match(app,/window\.addEventListener\("hashchange"/);
 assert.match(app,/dataset\.communityPage/);
});
test("Private and public initializers don't bind forms from the other page",()=>{
 assert.match(app,/if\(isProfile\)\{\s*bindAccount\(\)/);
 assert.match(app,/\}else\{\s*bindCases\(\)/);
 assert.match(app,/if\(!\$\("watchlist"\)\|\|!\$\("activityFeed"\)\)return;/);
 for(const id of ["evidenceForm","collectionAddForm","compareRun","dispatchRefresh"])assert.ok(exp.includes('getElementById("'+id+'")'));
});
test("Public profiles still use public Community URL without exposing edit tools",()=>{
 assert.match(app,/community\.html\?profile=/);
 assert.match(community,/id="publicProfile"/);
 assert.match(community,/id="findProfile"/);
 assert.doesNotMatch(profile,/id="publicProfile"/);
});
test("Dashboard maintains saved decks, collection, following, achievements and notifications",()=>{
 for(const phrase of ["My Decks","My Collection","Following","Notifications","Account Settings"]){
  assert.ok(profile.includes(phrase),"Dashboard missing "+phrase);
 }
 assert.match(app,/attachProfileReputation/);
 assert.match(app,/attachHiveRecords/);
 assert.match(profile,/href="\/deck"/);
});
test("Old URLs and backend interfaces remain in place",()=>{
 for(const file of ["functions/api/community.js","functions/api/profile-device.js","functions/api/profile-recovery.js","functions/api/field-expansion.js"]){
  assert.ok(fs.existsSync(file),file+" missing");
 }
 assert.ok(community.includes('<link rel="canonical" href="https://deep-cuts-edh.pages.dev/community">'));
 for(const page of ["games.html","supporters.html"]){
  const html=read(page);
  assert.ok(privateBookmark(html),page+" still points to old private tab");
 }
});
test("Responsive profile layout, privacy notice and account navigation exist",()=>{
 const css=read("profile-layout.css");
 for(const token of [".profile-quick-grid","max-width:750px","max-width:430px",":focus-visible"])assert.ok(css.includes(token));
 assert.match(profile,/Your collection and account settings are only visible to you/);
});

test("Community sections use clear names without gaps from removed private tabs",()=>{
 const nav=community.match(/<nav class="cm-tabs"[\s\S]*?<\/nav>/)?.[0]||"";
 for(const name of ["DISCUSSIONS","DECK ARCHIVE","CHALLENGES","FIELD REPORTS","FIND PLAYERS","RESEARCH BOARDS","LEGACY COMPARE","RANKINGS"])assert.ok(nav.includes(name),name+" missing");
 assert.doesNotMatch(nav,/>\d{2} \/ /);
});

// Verify Passport read-only profile data through the existing profile regression suite.
import "./passport.test.mjs";
