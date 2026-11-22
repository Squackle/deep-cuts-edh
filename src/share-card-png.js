/* Server-side PNG for Case File Cards: social platforms (Facebook, X,
 * Discord, iMessage, Slack) do not render SVG og:image, so the same
 * first-party SVG is rasterized with vendored resvg (WebAssembly).
 *
 * Only cardSvg() output is ever rendered here: it contains no external
 * references, and resvg is given no system fonts or file access, only the
 * bundled OFL Liberation fonts. */
import {initWasm,Resvg} from './vendor/resvg-wasm/index.mjs';
export const SHARE_FONT_PATHS=[
 '/assets/share-fonts/LiberationSerif-Bold.ttf',
 '/assets/share-fonts/LiberationSerif-Italic.ttf',
 '/assets/share-fonts/LiberationSans-Regular.ttf',
 '/assets/share-fonts/LiberationMono-Bold.ttf'
];
let ready=null;
let fonts=null;
// wasm: a WebAssembly.Module (Workers import) or bytes (Node tests).
export function ensureWasm(wasm){
 ready??=initWasm(wasm).catch(error=>{ready=null;throw error});
 return ready;
}
// loadFont(path) -> Promise<ArrayBuffer|Uint8Array>; cached per isolate.
export async function loadShareFonts(loadFont){
 if(fonts)return fonts;
 const loaded=await Promise.all(SHARE_FONT_PATHS.map(async p=>new Uint8Array(await loadFont(p))));
 if(loaded.some(f=>f.byteLength<1000))throw Error('Share card font missing');
 return fonts=loaded;
}
export async function svgToPng(svg,{wasm,loadFont}){
 await ensureWasm(wasm);
 const fontBuffers=await loadShareFonts(loadFont);
 const resvg=new Resvg(svg,{
  fitTo:{mode:'width',value:1200},
  font:{fontBuffers,defaultFontFamily:'Liberation Sans',serifFamily:'Liberation Serif',sansSerifFamily:'Liberation Sans',monospaceFamily:'Liberation Mono'}
 });
 try{
  const image=resvg.render();
  try{return image.asPng()}finally{image.free()}
 }finally{resvg.free()}
}
