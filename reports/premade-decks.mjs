/* Editorial Commander decklists: progressive disclosure, no shopping, no tracking.
   Future standard Rescue Reports auto-inherit the display via guide.js.
   These drafts remain free; purchase readiness is managed separately. */
const make=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
};
const TIERS=[["budget","Budget"],["standard","Standard"],["no-limit","No Limit"]];
const BASICS=new Set(["plains","island","swamp","mountain","forest","wastes",
 "snow-covered plains","snow-covered island","snow-covered swamp",
 "snow-covered mountain","snow-covered forest"]);
const line=parse=>/^\s*(\d{1,3})\s+(\S.*?)\s*$/.exec(parse);
/* All premade card rows link to Scryfall. Exact card-page links are resolved
   on hover/focus, with an exact-name Scryfall search as the safe fallback.
   The hover preview is requested only when needed, never for 1,200 cards. */
export const scryfallSearchUrl=name=>
 "https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"')+"&unique=cards";
export const scryfallCardApiUrl=name=>
 "https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name);
export function safeCardDetails(card){
 const raw=card?.image_uris?.normal||
  card?.card_faces?.find(face=>face?.image_uris?.normal)?.image_uris?.normal;
 let image=null,uri=null;
 try{
  const u=new URL(raw);
  if(u.protocol==="https:"&&["cards.scryfall.io","c1.scryfall.com","c2.scryfall.com"].includes(u.hostname))image=u.href;
 }catch{/* No valid image, retain readable text fallback. */}
 try{
  const u=new URL(card?.scryfall_uri);
  if(u.protocol==="https:"&&u.hostname==="scryfall.com")uri=u.href;
 }catch{/* Exact-name search is still accessible. */}
 return {image,uri};
}
const cardCache=new Map();
let cardQueue=Promise.resolve(),lastCardRequest=0;
async function cardDetails(name){
 if(!cardCache.has(name)){
  const promise=cardQueue.then(async()=>{
   // Respect the public Scryfall API's request-rate guidance.
   const wait=Math.max(0,125-(Date.now()-lastCardRequest));
   if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
   lastCardRequest=Date.now();
   const response=await fetch(scryfallCardApiUrl(name),{
    method:"GET",headers:{"Accept":"application/json"},
    mode:"cors",credentials:"omit"
   });
   if(!response.ok)return {image:null,uri:null};
   return safeCardDetails(await response.json());
  }).catch(()=>({image:null,uri:null}));
  cardQueue=promise.then(()=>undefined);
  cardCache.set(name,promise);
  if(cardCache.size>100)cardCache.delete(cardCache.keys().next().value);
 }
 return cardCache.get(name);
}
let visibleAnchor=null,hoverDelay=null,popup=null;
function hideCardPreview(){
 if(hoverDelay!==null)clearTimeout(hoverDelay);
 hoverDelay=null;visibleAnchor=null;
 if(popup)popup.hidden=true;
}
function positionCardPreview(anchor){
 if(!popup||popup.hidden||!anchor?.getBoundingClientRect)return;
 const point=anchor.getBoundingClientRect();
 const bounds=popup.getBoundingClientRect();
 const gap=14,pad=12;
 const right=point.right+gap,left=point.left-gap-bounds.width;
 const x=right+bounds.width+pad<=window.innerWidth?right:
  left>=pad?left:Math.max(pad,Math.min(point.left,window.innerWidth-bounds.width-pad));
 const y=Math.max(pad,Math.min(point.top-30,window.innerHeight-bounds.height-pad));
 popup.style.left=Math.round(x)+"px";
 popup.style.top=Math.round(y)+"px";
}
function previewNode(){
 if(popup?.isConnected)return popup;
 popup=make("div","premade-card-preview");
 popup.hidden=true;
 popup.setAttribute("aria-hidden","true");
 document.body.append(popup);
 return popup;
}
function showCardPreview(anchor,name,mouse=false){
 // Phones are intentionally out of scope. A keyboard user may still focus.
 if(mouse&&window.matchMedia&&!window.matchMedia("(hover: hover) and (pointer: fine)").matches)return;
 hideCardPreview();
 visibleAnchor=anchor;
 hoverDelay=setTimeout(async()=>{
  hoverDelay=null;
  if(visibleAnchor!==anchor)return;
  const panel=previewNode();
  panel.replaceChildren(
   make("strong","premade-preview-name",name),
   make("p","premade-preview-loading","Loading Scryfall card…")
  );
  panel.hidden=false;
  positionCardPreview(anchor);
  const data=await cardDetails(name);
  // Do not display stale images when the mouse has moved to another card.
  if(visibleAnchor!==anchor)return;
  if(data.uri)anchor.href=data.uri;
  panel.replaceChildren(make("strong","premade-preview-name",name));
  if(data.image){
   const img=make("img","premade-preview-image");
   img.alt=name+" — Scryfall card image";
   img.loading="eager";
   img.decoding="async";
   img.addEventListener("load",()=>{if(visibleAnchor===anchor)positionCardPreview(anchor)});
   img.addEventListener("error",()=>{
    if(visibleAnchor!==anchor)return;
    img.remove();
    panel.append(make("p","premade-preview-loading","Image unavailable — open on Scryfall for card details."));
    positionCardPreview(anchor);
   });
   img.src=data.image;
   panel.append(img);
  }else{
   panel.append(make("p","premade-preview-loading","Image unavailable — open on Scryfall for card details."));
  }
  panel.append(make("span","premade-preview-hint","Click the card name to open Scryfall ↗"));
  positionCardPreview(anchor);
 },125);
}
if(typeof document!=="undefined"){
 // One listener per module, not per card, and no global image preload.
 document.addEventListener("keydown",e=>{if(e.key==="Escape")hideCardPreview()});
 window.addEventListener("scroll",hideCardPreview,{passive:true});
 window.addEventListener("resize",hideCardPreview,{passive:true});
}

export function checkDraft(tier,commanders){
 if(!tier||!Array.isArray(tier.sections)||!Array.isArray(commanders)||!commanders.length)
  return {ok:false,count:0};
 const seen=new Set();let count=0;
 for(const section of tier.sections){
  if(typeof section.role!=="string"||!section.role||!Array.isArray(section.cards))return {ok:false,count};
  for(const entry of section.cards){
   if(typeof entry!=="string")return {ok:false,count};
   const match=line(entry);
   if(!match)return {ok:false,count};
   const qty=Number(match[1]),name=match[2].toLowerCase();
   if(qty<1||qty>100||seen.has(name)||(!BASICS.has(name)&&qty!==1))return {ok:false,count};
   seen.add(name);count+=qty;
  }
 }
 const commanderLines=tier.sections.filter(s=>s.role==="Commander").flatMap(s=>s.cards);
 return {ok:count===100&&commanderLines.length===commanders.length &&
   commanders.every(c=>commanderLines.includes("1 "+c)),
   count};
}
export function deckText(tier){
 return tier.sections.map(section=>
  "# "+section.role+"\n"+section.cards.join("\n")).join("\n\n");
}
async function loadDrafts(){
 try{
  const res=await fetch(new URL("./premade-decks.json",import.meta.url),{credentials:"omit"});
  if(!res.ok)return {};
  const data=await res.json();
  return data?.schemaVersion===1&&data.cases&&typeof data.cases==="object"?data.cases:{};
 }catch{return {};}
}
function sectionView(info,tier,commanders){
 const list=make("div","premade-role-list");
 for(const group of tier.sections){
  const count=group.cards.reduce((n,entry)=>n+Number(line(entry)[1]),0);
  const groupWrap=make("section","premade-role");
  const heading=make("h4","premade-role-title",group.role+" · "+count);
  const lines=make("ul","premade-card-lines");
  for(const entry of group.cards){
   const match=line(entry);
   const item=make("li");
   const name=match[2],anchor=make("a","premade-card-link",match[1]+" × "+name);
   anchor.href=scryfallSearchUrl(name);
   anchor.target="_blank";
   anchor.rel="noopener noreferrer";
   anchor.title="Open "+name+" on Scryfall (new tab)";
   anchor.addEventListener("mouseenter",()=>showCardPreview(anchor,name,true));
   anchor.addEventListener("mouseleave",hideCardPreview);
   anchor.addEventListener("focus",()=>showCardPreview(anchor,name));
   anchor.addEventListener("blur",hideCardPreview);
   item.append(anchor);
   lines.append(item);
  }
  groupWrap.append(heading,lines);
  list.append(groupWrap);
 }
 info.append(list);
 const controls=make("div","premade-actions");
 const copy=make("button","premade-copy","Copy 100-card deck");
 copy.type="button";
 const status=make("span","premade-copy-status","");
 status.setAttribute("role","status");
 status.setAttribute("aria-live","polite");
 copy.addEventListener("click",async()=>{
  try{
   await navigator.clipboard.writeText(tier.sections.flatMap(g=>g.cards).join("\n"));
   status.textContent="Deck copied";
  }catch{status.textContent="Clipboard unavailable; select the cards above.";}
 });
 controls.append(copy,status);
 info.append(controls);
}
export async function mountPremadeDecks(data){
 const container=document.querySelector(".report-content");
 if(!container||!Array.isArray(data?.commanders)||!data.commanders.length ||
    document.querySelector(".premade-decklists"))return;
 const slug=location.pathname.split("/").pop()?.replace(/\.html$/,"")||"";
 if(!/^[a-z0-9-]{1,100}$/.test(slug))return;
 const cases=await loadDrafts();
 const found=cases[slug];
 const box=make("details","premade-decklists");
 box.id="premade-decklists";
 const label=make("summary","premade-summary","SEE DEEPCUTS PREMADE DECKLISTS");
 const inside=make("div","premade-content");
 const intro=make("p","premade-intro",
  "Explore complete builds by role. All decklists are free and optional — prices and affiliate checkout are not live.");
 inside.append(intro);
 const tiers=make("div","premade-tiers");
 for(const [id,title] of TIERS){
  const tier=found?.tiers?.[id],result=checkDraft(tier,data.commanders);
  const details=make("details","premade-tier");
  const summary=make("summary","premade-tier-summary",title+(result.ok?" · 100 cards":" · Coming soon"));
  details.append(summary);
  const body=make("div","premade-tier-body");
  if(result.ok){
   const msg=make("p","premade-unverified",found.preview||data.preview?
    "Preview deck: release status, Commander legality and printing availability must be checked before play or purchase.":
    "Editorial 100-card build. Individual card legality, strategy and prices are not independently verified yet.");
   body.append(msg);
   sectionView(body,tier,data.commanders);
  }else body.append(make("p","premade-unverified","This complete decklist has not been prepared yet. The existing starter core remains free below."));
  details.append(body);
  details.addEventListener("toggle",()=>{
   if(!details.open)return;
   for(const other of tiers.children)if(other!==details)other.open=false;
  });
  tiers.append(details);
 }
 inside.append(tiers);
 box.append(label,inside);
 const anchor=container.querySelector(".report-core-warning") ||
  container.querySelector(".report-references");
 if(anchor)anchor.after(box);else container.append(box);
}
