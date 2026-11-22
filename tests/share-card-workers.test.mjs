import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
const root=new URL('../',import.meta.url);
const report={date:'2026-10-30',commander:{name:'Vhati il-Dal',scryfall:'https://scryfall.com/card/tpr/214/vhati-il-dal'},theme:'One-Toughness Control',hook:'A careful source-checked hypothesis.',usualBuild:'x',selectionReason:'x',sections:{headline:'h',diagnosis:'d',prescription:'p',earlyGame:'e',midGame:'m',lateGame:'l',risks:'r',verdict:'v'},synergies:[]};

// Mirrors the Pages Functions bundle: the .wasm import stays a separate
// CompiledWasm module (Workers forbid compiling WebAssembly from bytes).
test('workerd: share card route renders PNG from the bundled WebAssembly module',{timeout:60000},async t=>{
 const entry=`import {onRequestGet} from ${JSON.stringify(new URL('functions/share/rescues/[card].js',root).pathname)};
export default {fetch(request,env,ctx){const card=new URL(request.url).pathname.split('/').pop();return onRequestGet({request,env,params:{card},waitUntil:p=>ctx.waitUntil(p)})}};`;
 const wasmPlugin={name:'wasm',setup(b){b.onResolve({filter:/\.wasm$/},()=>({path:'./index_bg.wasm',external:true}))}};
 const bundle=await build({stdin:{contents:entry,resolveDir:root.pathname,loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',plugins:[wasmPlugin]});
 const upstream=[];const assets=[];
 const mf=new Miniflare({
  modules:[{type:'ESModule',path:'worker.js',contents:bundle.outputFiles[0].text},
   {type:'CompiledWasm',path:'index_bg.wasm',contents:readFileSync(new URL('src/vendor/resvg-wasm/index_bg.wasm',root))}],
  compatibilityDate:'2026-07-01',
  serviceBindings:{ASSETS:async request=>{const p=new URL(request.url).pathname;assets.push(p);
   if(!/^\/assets\/share-fonts\/[A-Za-z-]+\.ttf$/.test(p))return new Response('nope',{status:404});
   return new Response(readFileSync(new URL('.'+p,root)))}},
  outboundService:async request=>{const u=new URL(request.url);upstream.push(u.href);
   if(u.hostname!=='deep-cuts-weekly-publisher.logan-ottfamily.workers.dev')throw Error('blocked '+u.hostname);
   return u.searchParams.get('date')==='2026-10-30'?Response.json({report}):new Response('{}',{status:404})}
 });
 t.after(()=>mf.dispose());
 const png=await mf.dispatchFetch('https://site.invalid/share/rescues/2026-10-30.png');
 assert.equal(png.status,200,await png.clone().text().catch(()=>''));
 assert.equal(png.headers.get('Content-Type'),'image/png');
 const bytes=new Uint8Array(await png.arrayBuffer());
 assert.deepEqual([...bytes.subarray(0,4)],[137,80,78,71]);
 const view=new DataView(bytes.buffer);assert.equal(view.getUint32(16),1200);assert.equal(view.getUint32(20),630);
 assert.equal(assets.length,4,'four bundled fonts fetched from same-origin assets');
 const svg=await mf.dispatchFetch('https://site.invalid/share/rescues/2026-10-30.svg');
 assert.equal(svg.status,200);assert.match(svg.headers.get('Content-Type'),/image\/svg\+xml/);await svg.text();
 const missing=await mf.dispatchFetch('https://site.invalid/share/rescues/2026-11-06.png');
 assert.equal(missing.status,404,'unpublished dates never get a card');await missing.text();
 const bad=await mf.dispatchFetch('https://site.invalid/share/rescues/evil.png');
 assert.equal(bad.status,404);await bad.text();
 assert.ok(upstream.every(u=>!u.includes('evil')));
});
