import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanText,wrapText,rescueCardModel,cardSvg,shareMetaTags,sharePanelHtml,fetchCardArt} from '../src/share-card.js';
import {reportHtml} from '../src/weekly-rescues-html.js';
import {onRequestGet} from '../functions/share/rescues/[card].js';
import {svgToPng,SHARE_FONT_PATHS} from '../src/share-card-png.js';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);

const ART='https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448';
const report={
 date:'2026-10-30',status:'AI-assisted and source-checked; not independently playtested',
 commander:{name:'Vhati il-Dal',scryfall:'https://scryfall.com/card/tpr/214/vhati-il-dal',edhrecCardUseRank:null,imageUrl:ART},
 theme:'One-Toughness Control',hook:'A careful source-checked hypothesis.',usualBuild:'Approximate control',selectionReason:'Qualified.',
 sections:{headline:'One point',diagnosis:'d',prescription:'p',earlyGame:'e',midGame:'m',lateGame:'l',risks:'r',verdict:'v'},
 synergies:[],
 // Fields that must never reach a public card.
 ownerNotes:'INTERNAL moderator note',email:'secret@example.com',draft:{headline:'UNPUBLISHED DRAFT'}
};
const hostile={...report,commander:{...report.commander,name:'<script>alert(1)</script>"\'&$&'},theme:'</text><image href="https://evil.test/x.png"/>',hook:'‮evil​ '+'x'.repeat(5000)};

test('cleanText strips control/bidi characters and bounds length',()=>{
 assert.equal(cleanText('a‮b​c\n\td'),'a b c d');
 const long=cleanText('word '.repeat(100),50);assert.ok(Array.from(long).length<=50);assert.ok(long.endsWith('…'));
 assert.equal(cleanText(null),'');
});

test('wrapText respects line and width bounds, hard-splitting long words',()=>{
 const lines=wrapText('x'.repeat(200)+' tail',20,3);
 assert.equal(lines.length,3);for(const l of lines)assert.ok(Array.from(l).length<=21,l);
 assert.ok(lines[2].endsWith('…'));
});

test('card model reads only public report fields',()=>{
 const m=rescueCardModel(report);
 const all=JSON.stringify(m)+cardSvg(m)+sharePanelHtml(m);
 for(const secret of ['INTERNAL','secret@example.com','UNPUBLISHED'])assert.ok(!all.includes(secret),secret);
 assert.equal(m.url,'https://deep-cuts-edh.pages.dev/rescues/2026-10-30');
 assert.equal(m.imagePath,'/share/rescues/2026-10-30.svg?v=2');
 assert.equal(m.pngPath,'/share/rescues/2026-10-30.png?v=2');
 assert.throws(()=>rescueCardModel({...report,date:'../../x'}));
 assert.throws(()=>rescueCardModel(null));
});

test('hostile titles cannot inject markup into SVG, meta or panel',()=>{
 const m=rescueCardModel(hostile);
 const svg=cardSvg(m);
 assert.ok(!svg.includes('<script'));assert.ok(!/<image/i.test(svg));assert.ok(!svg.includes('evil.test"'));
 assert.ok(!/\shref="/.test(svg),'no external references');
 assert.ok(!svg.includes('‮'));
 assert.ok(svg.length<6000,'bounded output size');
 const meta=shareMetaTags(m,{title:'<b>x</b>',description:'"><script>'});
 assert.ok(!meta.includes('<b>')&&!meta.includes('"><script>'));
 const page=reportHtml(hostile);
 assert.ok(!page.includes('<script>alert'));
 assert.ok(!page.includes('<image href'));
 assert.ok(page.includes('$&amp;'),'replacement patterns are not interpreted');
});

test('report page carries Open Graph tags and the share panel',()=>{
 const html=reportHtml(report);
 assert.match(html,/<meta property="og:image" content="https:\/\/deep-cuts-edh\.pages\.dev\/share\/rescues\/2026-10-30\.png\?v=2">/);
 assert.match(html,/<meta property="og:image:type" content="image\/png">/);
 assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
 assert.match(html,/<meta property="og:url" content="https:\/\/deep-cuts-edh\.pages\.dev\/rescues\/2026-10-30">/);
 assert.match(html,/data-share-card/);assert.match(html,/data-share-action="copy"/);assert.match(html,/data-share-action="png"/);
 assert.match(html,/<script defer src="\/share-card\.js"><\/script>/);
 assert.match(html,/<header class="site-header">/,'shared header retained');
});

test('share route serves only published reports and refuses forged dates',async()=>{
 const realFetch=globalThis.fetch;const seen=[];
 globalThis.fetch=async url=>{const u=new URL(url);
  if(u.hostname==='cards.scryfall.io')return new Response(fs.readFileSync(new URL('tests/fixtures/synthetic-card.jpg',root)),{headers:{'Content-Type':'image/jpeg'}});
  seen.push(String(url));const d=u.searchParams.get('date');
  return d==='2026-10-30'?Response.json({report}):new Response('{}',{status:404})};
 try{
  const ok=await onRequestGet({params:{card:'2026-10-30.svg'}});
  assert.equal(ok.status,200);assert.match(ok.headers.get('Content-Type'),/image\/svg\+xml/);
  assert.match(ok.headers.get('Content-Security-Policy'),/default-src 'none'/);
  const okSvg=await ok.text();assert.match(okSvg,/Vhati il-Dal/);assert.match(okSvg,/<image [^>]*href="data:image\/jpeg;base64,/,'commander card embedded');
  assert.equal((await onRequestGet({params:{card:'2026-11-06.svg'}})).status,404,'unpublished date is not a card');
  for(const bad of ['../x.svg','2026-10-30','2026-10-30.svg/../','2026-10-30.jpg','2026-10-30.png.svg'])
   assert.equal((await onRequestGet({params:{card:bad}})).status,404,bad);
  assert.equal(seen.length,2,'malformed ids never reach upstream');
 }finally{globalThis.fetch=realFetch}
});

test('server PNG renders the card at 1200x630 with bundled fonts only',async()=>{
 const wasm=fs.readFileSync(new URL('src/vendor/resvg-wasm/index_bg.wasm',root));
 const requested=[];
 const loadFont=async p=>{requested.push(p);return fs.readFileSync(new URL('.'+p,root))};
 const png=await svgToPng(cardSvg(rescueCardModel(hostile)),{wasm,loadFont});
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG signature');
 const view=new DataView(png.buffer,png.byteOffset);
 assert.equal(view.getUint32(16),1200);assert.equal(view.getUint32(20),630);
 assert.deepEqual(requested,SHARE_FONT_PATHS);
 for(const p of SHARE_FONT_PATHS)assert.ok(p.startsWith('/assets/share-fonts/')&&p.endsWith('.ttf'));
 assert.ok(fs.existsSync(new URL('assets/share-fonts/LICENSE-OFL-1.1.txt',root)));
 assert.ok(fs.existsSync(new URL('src/vendor/resvg-wasm/LICENSE-MPL-2.0.txt',root)));
});

test('card art: only verified Scryfall images, embedded as data URIs',async()=>{
 const jpg=fs.readFileSync(new URL('tests/fixtures/synthetic-card.jpg',root));
 const calls=[];
 const ok=async(url,init)=>{calls.push([url,init?.redirect]);return new Response(jpg,{headers:{'Content-Type':'image/jpeg'}})};
 const art=await fetchCardArt(ART,{fetchImpl:ok});
 assert.match(art,/^data:image\/jpeg;base64,/);assert.equal(calls[0][1],'manual','redirects not followed');
 for(const bad of ['https://evil.test/x.jpg','http://cards.scryfall.io/x.jpg','javascript:alert(1)',null])
  assert.equal(await fetchCardArt(bad,{fetchImpl:ok}),null,String(bad));
 assert.equal(await fetchCardArt(ART,{fetchImpl:async()=>new Response('<svg onload=alert(1)>',{headers:{'Content-Type':'image/jpeg'}})}),null,'magic bytes checked');
 assert.equal(await fetchCardArt(ART,{fetchImpl:async()=>new Response(jpg,{headers:{'Content-Type':'text/html'}})}),null);
 assert.equal(await fetchCardArt(ART,{fetchImpl:async()=>new Response(new Uint8Array(700_000).fill(0xff),{headers:{'Content-Type':'image/jpeg'}})}),null,'size bounded');
 assert.equal(await fetchCardArt(ART,{fetchImpl:async()=>{throw Error('down')}}),null);
 const m=rescueCardModel(report);
 const withArt=cardSvg(m,{art});
 assert.match(withArt,/<image [^>]*href="data:image\/jpeg;base64,/);
 for(const bad of ['https://evil.test/x.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,AA"/><script>'])
  assert.doesNotMatch(cardSvg(m,{art:bad}),/<image /,bad);
 const opts={wasm:fs.readFileSync(new URL('src/vendor/resvg-wasm/index_bg.wasm',root)),loadFont:async p=>fs.readFileSync(new URL('.'+p,root))};
 const [a,b]=[await svgToPng(withArt,opts),await svgToPng(cardSvg(m),opts)];
 assert.ok(Math.abs(a.length-b.length)>b.length*0.05,'card image changes the rendered PNG ('+a.length+' vs '+b.length+' bytes)');
});
