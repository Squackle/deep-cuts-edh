import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newerWeeklyReport,applyWeeklyFeature,trustedCardImage,preloadCardImage,watchFeaturedImage} from '../home-weekly-feature.mjs';

const homepage=readFileSync('index.html','utf8');
const source=readFileSync('home-weekly-feature.mjs','utf8');
const trusted='https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448';
const newest={report:{date:'2026-11-06',commander:'A Weird & <Unexpected> Commander',theme:'Artifact-control discovery',imageUrl:trusted}};

test('Homepage visibly features latest published weekly report with crawlable static link',()=>{
 assert.match(homepage,/id="homeWeeklyFeature" data-weekly-date="2026-10-30" href="\/rescues\/2026-10-30"/);
 assert.match(homepage,/data-weekly-name>Vhati il-Dal<\/strong>/);
 assert.match(homepage,/data-weekly-theme>One-Toughness Control<\/small>/);
 assert.ok(homepage.includes(trusted.replace(/&/g,'&amp;')),'Static featured card uses direct verified image CDN');
 assert.doesNotMatch(homepage,/api\.scryfall\.com\/cards\/named\?exact=Vhati/);
 assert.match(homepage,/LATEST WEEKLY RESCUE/);
 assert.match(homepage,/id="homeLatestWeeklyText" href="\/rescues\/2026-10-30"/);
 assert.match(homepage,/<script type="module" src="\/home-weekly-feature.mjs"><\/script>/);
 assert.match(homepage,/href="\/reports\/commander-mustard"/,'Original Commander Mustard report is still accessible from the archive');
 assert.equal((homepage.match(/<h1\b/g)||[]).length,1);
});
test('Newly published Friday article becomes featured and older or invalid results cannot overwrite fallback',()=>{
 const result=newerWeeklyReport(newest,'2026-10-30');
 assert.equal(result.url,'/rescues/2026-11-06');
 assert.equal(result.commander,'A Weird & <Unexpected> Commander');
 assert.equal(result.image,trusted);
 assert.equal(newerWeeklyReport(newest,'2026-11-06'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,date:'2026-10-24'}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,date:'javascript:alert(1)'}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,commander:''}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,theme:'a'.repeat(150)}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,imageUrl:undefined}},'2026-10-30'),null,'No source-verified image, no broken hero promotion');
 assert.equal(newerWeeklyReport({report:{...newest.report,imageUrl:'https://evil.example/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg'}},'2026-10-30'),null);
 assert.equal(trustedCardImage('https://cards.scryfall.io.evil.test/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg'),null);
 assert.equal(newerWeeklyReport({report:null},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({notAReport:{}},'2026-10-30'),null);
});
test('DOM update changes the accessible feature and archive link without HTML injection',()=>{
 const textNode=()=>({textContent:'',alt:'',src:'',addEventListener(name,fn){if(name==='error')this.onError=fn;}});
 const children=Object.fromEntries(['[data-weekly-date-label]','[data-weekly-name]','[data-weekly-theme]','[data-weekly-image]'].map(x=>[x,textNode()]));
 const attrs={};
 const root={dataset:{weeklyDate:'2026-10-30'},querySelector:s=>children[s],setAttribute:(key,val)=>attrs[key]=val};
 const archive={setAttribute:(key,val)=>attrs['archive:'+key]=val,textContent:''};
 const doc={getElementById:(id)=>id==='homeLatestWeeklyText'?archive:null};
 const item=newerWeeklyReport(newest,root.dataset.weeklyDate);
 assert.equal(applyWeeklyFeature(root,item,doc),true);
 assert.equal(attrs.href,'/rescues/2026-11-06');
 assert.equal(attrs['aria-label'],'Read the latest weekly Commander Rescue Report: '+newest.report.commander);
 assert.equal(root.dataset.weeklyDate,'2026-11-06');
 assert.equal(children['[data-weekly-name]'].textContent,newest.report.commander);
 assert.equal(children['[data-weekly-theme]'].textContent,newest.report.theme);
 assert.equal(attrs['archive:href'],'/rescues/2026-11-06');
 assert.match(archive.textContent,/A Weird & <Unexpected> Commander/);
 assert.equal(typeof children['[data-weekly-image]'].onError,'function');
 children['[data-weekly-image]'].onError();
 assert.equal(children['[data-weekly-image]'].src,'/assets/deep-cuts-mark.svg');
 assert.doesNotMatch(source,/\binnerHTML\b|\beval\(/);
});
test('Unreachable weekly API cannot remove the featured current report',()=>{
 assert.match(source,/\.catch\(\(\)=>\{ \/\* Keep the fully linked, crawlable featured fallback/);
 assert.match(source,/https:\/\/deep-cuts-weekly-publisher\.logan-ottfamily\.workers\.dev\/v1\/latest/);
 assert.doesNotMatch(source,/api\.scryfall\.com\/cards\/named\?exact=/);
 assert.match(homepage,/data-weekly-name>Vhati il-Dal<\/strong>/);
});

test('A future featured report only promotes after its actual card image loads',async()=>{
 const success={complete:false,naturalWidth:0};
 Object.defineProperty(success,'src',{set(value){this._src=value;this.naturalWidth=488;this.onload()},get(){return this._src}});
 assert.equal(await preloadCardImage(trusted,()=>success),true);
 const fail={complete:false,naturalWidth:0};
 Object.defineProperty(fail,'src',{set(value){this._src=value;this.onerror()},get(){return this._src}});
 assert.equal(await preloadCardImage(trusted,()=>fail),false);
 const cached={complete:true,naturalWidth:488,src:''};
 assert.equal(await preloadCardImage(trusted,()=>cached),true);
 assert.equal(await preloadCardImage(trusted,()=>{throw Error('image blocked')}),false);
 assert.match(source,/preloadCardImage\(next.image\)\.then\(ok=>/);
 assert.match(source,/if\(ok&&featured.dataset.weeklyDate<next.date\)applyWeeklyFeature/);
});
test('Broken initial hero images have a one-shot first-party visual fallback',()=>{
 const callbacks={};
 const img={complete:true,naturalWidth:0,src:'https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg',addEventListener(name,fn){callbacks[name]=fn}};
 assert.equal(watchFeaturedImage(img),true);
 assert.equal(img.src,'/assets/deep-cuts-mark.svg');
 img.src='https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg';
 callbacks.error();
 assert.equal(img.src,'https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg');
});
