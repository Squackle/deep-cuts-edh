/* Workers-only entry: the .wasm import becomes a precompiled WebAssembly
 * module in the Pages Functions bundle (Workers cannot compile from bytes).
 * Imported lazily by functions/share/rescues/[card].js for PNG requests. */
import wasm from './vendor/resvg-wasm/index_bg.wasm';
import {svgToPng} from './share-card-png.js';
export const renderCardPng=(svg,loadFont)=>svgToPng(svg,{wasm,loadFont});
