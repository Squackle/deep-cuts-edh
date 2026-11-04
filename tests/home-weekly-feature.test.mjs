import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newerWeeklyReport,applyWeeklyFeature} from '../home-weekly-feature.mjs';

const homepage=readFileSync('index.html','utf8');
const source=readFileSync('home-weekly-feature.mjs','utf8');
const newest={report:{date:'2026-11-06',commander:'A Weird & <Unexpected> Commander',theme:'Artifact-control discovery'}};

test('Homepage visibly features latest published weekly report with crawlable static link',()=>{
 assert.match(homepage,/id="homeWeeklyFeature" data-weekly-date="2026-10-30" href="\/rescues\/2026-10-30"/);
 assert.match(homepage,/data-weekly-name>Vhati il-Dal<\/strong>/);
 assert.match(homepage,/data-weekly-theme>One-Toughness Control<\/small>/);
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
 assert.ok(result.image.includes('A%20Weird%20%26%20%3CUnexpected%3E%20Commander'));
 assert.equal(newerWeeklyReport(newest,'2026-11-06'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,date:'2026-10-24'}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,date:'javascript:alert(1)'}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,commander:''}},'2026-10-30'),null);
 assert.equal(newerWeeklyReport({report:{...newest.report,theme:'a'.repeat(150)}},'2026-10-30'),null);
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
 assert.match(homepage,/aria-label="Read the latest weekly Commander Rescue Report: Vhati il-Dal"/);
});
