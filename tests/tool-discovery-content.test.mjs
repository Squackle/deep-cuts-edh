import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root='https://deep-cuts-edh.pages.dev';
const pages={
 'matchmaker':['mmNextSteps','/rescues#budget-commander-ideas','/deep-cut-finder'],
 'deep-cut-finder':['finderGuideTitle','/reports/commander-mustard','/reports/chainer-dementia-master','/matchmaker'],
 'combos':['comboGuideTitle','/deep-cut-finder','/rescues'],
 'deck':['deckJourneyTitle','/binder-to-brew','/matchmaker'],
 'binder-to-brew':['binderGuideTitle','/deep-cut-finder','/rescues#budget-commander-ideas']
};
test('discovery pages provide static contextual guidance and canonical public links without JavaScript',()=>{
 const sitemap=readFileSync('sitemap.xml','utf8');
 for(const [slug,[id,...links]] of Object.entries(pages)){
  const html=readFileSync(slug+'.html','utf8');
  const main=html.match(/<main\b[\s\S]*?<\/main>/)?.[0];
  assert.ok(main,slug);
  assert.match(html,new RegExp('<link rel="canonical" href="'+root.replaceAll('.','\\.')+'/'+slug+'">'));
  assert.equal((html.match(/<h1\b/gi)||[]).length,1);
  assert.doesNotMatch(html,/<meta[^>]+name="robots"[^>]+content="noindex/i);
  assert.ok(sitemap.includes('<loc>'+root+'/'+slug+'</loc>'));
  const section=main.match(new RegExp('<section[^>]+aria-labelledby="'+id+'"[^>]*>[\\s\\S]*?<\\/section>'))?.[0];
  assert.ok(section,slug+' missing contextual content');
  assert.ok(section.includes('id="'+id+'"'),slug+' missing accessible heading');
  for(const link of links){
   assert.ok(section.includes('href="'+link+'"'),slug+' missing '+link);
   const [path,fragment]=link.split('#'),file=path.slice(1)+'.html';
   assert.ok(existsSync(file),file);
   if(fragment)assert.ok(readFileSync(file,'utf8').includes('id="'+fragment+'"'),link);
  }
 }
});
