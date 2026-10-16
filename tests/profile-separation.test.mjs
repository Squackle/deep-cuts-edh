import test from "node:test";
import "./community-debloat-transition.test.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
const read=x=>fs.readFileSync(x,"utf8");
const community=read("community.html"),profile=read("profile.html"),
 app=read("community.js"),exp=read("field-expansion.js"),header=read("header-profile.js");
const panels=html=>[...html.matchAll(/<section class="cm-panel(?: [^"]+)?" data-panel="([^"]+)"/g)].map(x=>x[1]);
test("Community has only public social features, with no personal forms or private data panels",()=>{
 assert.deepEqual(panels(community),["cases","decks","challenge","lab","network","evidence","compare","reputation"]);
 for(const bad of ["registerForm","loginForm","recoverStartForm","accountLoggedOut","accountLoggedIn","ownProfile","collectionItems","dispatchList","identitySummary"])
  assert.ok(!community.includes('id="'+bad+'"'),"Leaked private UI: "+bad);
 assert.doesNotMatch(community,/Free profiles use their own recovery keys/);
 assert.doesNotMatch(community,/challenges\.cloudflare\.com\/turnstile/);
});
test("Profile has only personal destinations and intact forms/keys",()=>{
 assert.deepEqual(panels(profile),["overview","collection","following","dispatches","account"]);
 for(const id of ["registerForm","loginForm","recoverStartForm","recoverFinishForm","editProfileForm","deleteAccount",
 "signOut","rememberThisDevice","ownProfile","newKeyBox","profileRecoveryKeyBox",
 "collectionAddForm","collectionImportButton","collectionClearButton","collectionItems",
 "dispatchList","dispatchReadAll","watchlist","activityFeed","profileOverviewSignedOut","profileOverviewSignedIn"]){
  assert.ok(profile.includes('id="'+id+'"'),"Profile UI missing "+id);
 }
 assert.match(profile,/<meta name="robots" content="noindex,follow">/);
 assert.match(profile,/<link rel="canonical" href="https:\/\/deep-cuts-edh.pages.dev\/profile">/);
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
 assert.match(community,/<link rel="canonical" href="https:\/\/deep-cuts-edh.pages.dev\/community">/);
 for(const page of ["games.html","supporters.html"]){
  const html=read(page);
  assert.match(html,/\/?profile#(?:account|collection)/,page+" still points to old private tab");
 }
});
test("Responsive profile layout, privacy notice and account navigation exist",()=>{
 const css=read("profile-layout.css");
 for(const token of [".profile-quick-grid","max-width:750px","max-width:430px",":focus-visible"])assert.ok(css.includes(token));
 assert.match(profile,/Your collection and account settings are only visible to you/);
});

test("Community sections use clear names without gaps from removed private tabs",()=>{
 const nav=community.match(/<nav class="cm-tabs"[\s\S]*?<\/nav>/)?.[0]||"";
 for(const name of ["DISCUSSIONS","DECK GALLERY","CHALLENGES","PLAYTESTING","FIND PLAYERS","RESEARCH BOARDS","COMPARE DECKS","RANKINGS"])assert.ok(nav.includes(name),name+" missing");
 assert.doesNotMatch(nav,/>\d{2} \/ /);
});
