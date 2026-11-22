/* Shareable Case File Cards (issue #65), first release.
 *
 * Builds a branded 1200x630 social card as a self-contained SVG from PUBLIC,
 * already-published content only. Every text field is normalized, length-
 * bounded and XML-escaped here, so untrusted titles cannot inject markup into
 * the SVG, the report page or Open Graph tags. The SVG references no external
 * images or fonts, so browsers can rasterize it to PNG without tainting a
 * canvas and a hostile value cannot trigger a network request.
 */
export const SITE_ORIGIN='https://deep-cuts-edh.pages.dev';
export const CARD_WIDTH=1200;
export const CARD_HEIGHT=630;
// Bump when the card design changes: it is part of the image URLs and the edge
// cache key, so social platforms and caches fetch the new design.
export const CARD_VERSION='3';
const DATE=/^20\d\d-\d\d-\d\d$/;

const XML_ESCAPES={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const xml=value=>String(value??'').replace(/[&<>"']/g,ch=>XML_ESCAPES[ch]);

// Normalize lookalike characters, remove control/bidi-override/zero-width
// characters, collapse whitespace and bound the length (ellipsis on cut).
export function cleanText(value,max=120){
 let text=String(value??'').normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g,' ')
  .replace(/\s+/g,' ').trim();
 const chars=Array.from(text);
 if(chars.length>max)text=chars.slice(0,Math.max(1,max-1)).join('').replace(/[\s.,;:!?-]+$/,'')+'…';
 return text;
}

// Greedy word wrap by approximate character width. Overlong words are hard
// split; overflow beyond maxLines ends in an ellipsis.
export function wrapText(text,maxChars,maxLines){
 const words=cleanText(text,maxChars*maxLines*2).split(' ').filter(Boolean);
 const lines=[];let line='';
 for(let word of words){
  while(Array.from(word).length>maxChars){
   if(line){lines.push(line);line='';}
   const chars=Array.from(word);lines.push(chars.slice(0,maxChars).join(''));word=chars.slice(maxChars).join('');
  }
  const next=line?line+' '+word:word;
  if(Array.from(next).length<=maxChars)line=next;else{lines.push(line);line=word;}
 }
 if(line)lines.push(line);
 if(lines.length>maxLines){
  const kept=lines.slice(0,maxLines);
  kept[maxLines-1]=cleanText(kept[maxLines-1]+' …',maxChars).replace(/\s*…?$/,'')+'…';
  return kept;
 }
 return lines;
}

/* Public card model for a published Weekly Rescue Report. Only fields that
 * already appear on the public /rescues/<date> page are read; anything else on
 * the object (drafts, notes, status internals) is ignored by construction. */
export function rescueCardModel(report){
 if(!report||typeof report!=='object'||!report.commander||!DATE.test(String(report.date||'')))
  throw Error('Not a published Rescue Report');
 const date=report.date;
 const path=`/rescues/${date}`;
 return {
  kind:'rescue',
  kicker:`WEEKLY RESCUE · CASE FILE ${date}`,
  title:cleanText(report.commander.name,60)||'Unnamed commander',
  subtitle:cleanText(report.theme,70),
  blurb:cleanText(report.hook,180),
  footer:'AI-ASSISTED · SOURCE-CHECKED',
  path,
  url:SITE_ORIGIN+path,
  imagePath:`/share/rescues/${date}.svg?v=${CARD_VERSION}`,
  pngPath:`/share/rescues/${date}.png?v=${CARD_VERSION}`,
  alt:`Deep Cuts EDH case file card: ${cleanText(report.commander.name,60)}, ${cleanText(report.theme,70)}`
 };
}

const tspans=(lines,x,lineHeight)=>lines.map((l,i)=>`<tspan x="${x}" dy="${i?lineHeight:0}">${xml(l)}</tspan>`).join('');

// Only a base64 JPEG/PNG data URI (built server-side from a verified Scryfall
// image) may be embedded; anything else is dropped, so the card never makes a
// network request when rendered by resvg or a browser.
const SAFE_ART=/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_ART_BYTES=600_000;

export function cardSvg(model,{art}={}){
 const hasArt=typeof art==='string'&&art.length<MAX_ART_BYTES*1.4&&SAFE_ART.test(art);
 // Text column narrows when the commander card sits on the right.
 const long=Array.from(model.title).length>(hasArt?16:28);
 const titleSize=long?62:76;
 const titleLines=wrapText(model.title,hasArt?(long?20:16):(long?28:22),2);
 const subLines=wrapText(model.subtitle,hasArt?32:40,2);
 const blurbChars=hasArt?50:64;
 const ruleEnd=hasArt?790:1090;
 const titleY=224;
 const subY=titleY+(titleLines.length-1)*(titleSize+8)+64;
 const blurbY=subY+(subLines.length-1)*46+56;
 // Keep the blurb inside the parchment panel (last baseline <= 520).
 const blurbRoom=Math.max(0,Math.min(3,Math.floor((520-blurbY)/34)+1));
 const blurbLines=blurbRoom?wrapText(model.blurb,blurbChars,blurbRoom):[];
 // Full commander card (Scryfall "normal", 488x680) at the right of the panel.
 const cardArt=hasArt?`<rect x="832" y="128" width="280" height="390" rx="14" fill="#000" fill-opacity=".28"/>
<image x="824" y="120" width="280" height="390" preserveAspectRatio="xMidYMid slice" clip-path="url(#cardClip)" href="${art}"/>
<rect x="824" y="120" width="280" height="390" rx="13" fill="none" stroke="#1d1d1d" stroke-opacity=".55" stroke-width="2"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-label="${xml(model.alt)}">
<title>${xml(model.alt)}</title>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d3a2e"/><stop offset="1" stop-color="#122219"/></linearGradient><clipPath id="cardClip"><rect x="824" y="120" width="280" height="390" rx="13"/></clipPath></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<rect x="28" y="28" width="1144" height="574" fill="none" stroke="#c9a85a" stroke-width="3"/>
<rect x="40" y="40" width="1120" height="550" fill="none" stroke="#c9a85a" stroke-opacity=".35" stroke-width="1"/>
<rect x="72" y="84" width="1056" height="462" rx="4" fill="#f6efdf"/>
<rect x="72" y="84" width="14" height="462" fill="#c9a85a"/>
<text x="120" y="134" font-family="ui-monospace,Menlo,Consolas,'Liberation Mono',monospace" font-size="${hasArt?20:22}" font-weight="800" letter-spacing="${hasArt?2:3}" fill="#805f35">${xml(model.kicker)}</text>
<line x1="120" y1="154" x2="${ruleEnd}" y2="154" stroke="#c7b488" stroke-width="2"/>
<text y="${titleY}" font-family="Georgia,'Times New Roman','Liberation Serif',serif" font-size="${titleSize}" font-weight="700" fill="#1f3d2f">${tspans(titleLines,120,titleSize+8)}</text>
<text y="${subY}" font-family="Georgia,'Times New Roman','Liberation Serif',serif" font-size="38" font-style="italic" fill="#8a6a2f">${tspans(subLines,120,46)}</text>
<text y="${blurbY}" font-family="system-ui,-apple-system,'Segoe UI',Arial,'Liberation Sans',sans-serif" font-size="25" fill="#43584a">${tspans(blurbLines,120,34)}</text>
${cardArt}
<text x="120" y="584" font-family="Georgia,'Times New Roman','Liberation Serif',serif" font-size="26" font-weight="700" letter-spacing="2" fill="#f6efdf">DEEP CUTS <tspan fill="#c9a85a" font-style="italic">EDH</tspan></text>
<text x="1080" y="584" text-anchor="end" font-family="ui-monospace,Menlo,Consolas,'Liberation Mono',monospace" font-size="17" font-weight="700" letter-spacing="2" fill="#c9a85a">${xml(model.footer)} · deep-cuts-edh.pages.dev</text>
</svg>`;
}

// Fetch the commander card image from Scryfall's CDN (URL already verified by
// safeCardImage) and return it as a data URI, or null on any failure.
export async function fetchCardArt(url,{fetchImpl=fetch,timeoutMs=6000}={}){
 if(typeof url!=='string')return null;
 try{
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='cards.scryfall.io')return null;
  const res=await fetchImpl(u.href,{headers:{Accept:'image/jpeg,image/png'},redirect:'manual',signal:AbortSignal.timeout(timeoutMs)});
  if(!res.ok)return null;
  const type=String(res.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
  if(type!=='image/jpeg'&&type!=='image/png')return null;
  const bytes=new Uint8Array(await res.arrayBuffer());
  if(!bytes.length||bytes.length>MAX_ART_BYTES)return null;
  // Check magic bytes, not just the header.
  const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47;
  if(!(jpeg||png))return null;
  let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return `data:image/${png?'png':'jpeg'};base64,${btoa(bin)}`;
 }catch{return null}
}

// Open Graph + Twitter metadata for the public page. All values escaped.
export function shareMetaTags(model,{title,description}){
 // Social platforms need a raster image; the PNG is rendered server-side.
 const image=SITE_ORIGIN+model.pngPath;
 const tags=[
  ['property','og:type','article'],['property','og:site_name','Deep Cuts EDH'],
  ['property','og:title',cleanText(title,110)],['property','og:description',cleanText(description,200)],
  ['property','og:url',model.url],['property','og:image',image],
  ['property','og:image:type','image/png'],['property','og:image:width',String(CARD_WIDTH)],['property','og:image:height',String(CARD_HEIGHT)],
  ['property','og:image:alt',model.alt],
  ['name','twitter:card','summary_large_image'],['name','twitter:title',cleanText(title,70)],
  ['name','twitter:description',cleanText(description,200)],['name','twitter:image',image],['name','twitter:image:alt',model.alt]
 ];
 return tags.map(([k,n,v])=>`<meta ${k}="${n}" content="${xml(v)}">`).join('');
}

// Share panel shown on the public page: preview, Copy Link, PNG/SVG download.
export function sharePanelHtml(model){
 const shareText=`${model.title}: ${model.subtitle} — a Deep Cuts EDH case file`;
 const file=`deep-cuts-${model.kind}-${model.path.split('/').pop()}`;
 return `<section class="share-card-panel" data-share-card data-share-url="${xml(model.url)}" data-share-image="${xml(model.imagePath)}" data-share-file="${xml(file)}" data-share-text="${xml(shareText)}" aria-labelledby="share-card-heading">
<h2 id="share-card-heading">Share this case file</h2>
<img class="share-card-preview" src="${xml(model.imagePath)}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" alt="${xml(model.alt)}" loading="lazy" decoding="async">
<p class="share-card-text">${xml(shareText)}</p>
<div class="share-card-actions">
<button type="button" data-share-action="copy">COPY LINK</button>
<button type="button" data-share-action="png">DOWNLOAD IMAGE (PNG)</button>
<a href="${xml(model.imagePath)}" download="${xml(file)}.svg">DOWNLOAD SVG</a>
<button type="button" data-share-action="native" hidden>SHARE…</button>
</div>
<p class="share-card-status" role="status" aria-live="polite"></p>
</section>`;
}

export const svgResponse=(svg,status=200)=>new Response(svg,{status,headers:{
 'Content-Type':'image/svg+xml; charset=utf-8',
 'Cache-Control':'public, max-age=3600, s-maxage=3600',
 'X-Content-Type-Options':'nosniff',
 // Opened directly, the SVG may not run script or load anything external.
 'Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'",
 'Access-Control-Allow-Origin':'*'
}});

export const pngResponse=(bytes,status=200)=>new Response(bytes,{status,headers:{
 'Content-Type':'image/png',
 'Cache-Control':'public, max-age=86400, s-maxage=86400',
 'X-Content-Type-Options':'nosniff',
 'Access-Control-Allow-Origin':'*'
}});
