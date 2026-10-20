/* Scryfall card artwork on desktop mouse hover of premade Commander decklists.
 * Fetch ONLY after hover/focus; cache card metadata; throttle /cards/named
 * lookups to respect Scryfall's limits. A failed lookup retains an exact-name
 * Scryfall search link, so unavailable previews never break navigation. */
const CACHE_LIMIT=160;
const CARD_API='https://api.scryfall.com/cards/named?exact=';
const PREVIEW_HOST='scryfall.com';
const apiCache=new Map();
let requestQueue=Promise.resolve(),lastRequest=0;

export function exactScryfallSearchUrl(name){
 return 'https://scryfall.com/search?q='+encodeURIComponent('!"'+String(name)+'"')+'&unique=cards';
}
const httpsImageUrl=url=>{
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&(u.hostname==='scryfall.io'||u.hostname.endsWith('.scryfall.io'))?u.href:null;
 }catch{return null}
};
const exactCardPageUrl=url=>{
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&u.hostname===PREVIEW_HOST&&u.pathname.startsWith('/card/')?u.href:null;
 }catch{return null}
};
export function scryfallCardDetails(card){
 if(!card||typeof card!=='object')return null;
 const face=Array.isArray(card.card_faces)?card.card_faces.find(f=>f?.image_uris):null;
 const images=card.image_uris||face?.image_uris||{};
 const image=httpsImageUrl(images.large)||httpsImageUrl(images.normal);
 const href=exactCardPageUrl(card.scryfall_uri);
 if(!href&&!image)return null;
 return {href,image};
}
/* Serial queue: max one lookup every 180 ms; failures are cached briefly
 * within the session to avoid repeated hammering of unavailable cards. */
export function resolveScryfallCard(name){
 const key=String(name||'').trim().toLowerCase();
 if(!key)return Promise.resolve(null);
 if(apiCache.has(key))return apiCache.get(key);
 const task=requestQueue.then(async()=>{
  const delay=Math.max(0,180-(Date.now()-lastRequest));
  if(delay)await new Promise(done=>setTimeout(done,delay));
  lastRequest=Date.now();
  try{
   const r=await fetch(CARD_API+encodeURIComponent(name),{
    credentials:'omit',headers:{Accept:'application/json'}
   });
   if(!r.ok)return null;
   return scryfallCardDetails(await r.json());
  }catch{return null}
 });
 requestQueue=task.then(()=>undefined,()=>undefined);
 apiCache.set(key,task);
 if(apiCache.size>CACHE_LIMIT)apiCache.delete(apiCache.keys().next().value);
 return task;
}
function make(tag,className,text){
 const el=document.createElement(tag);
 if(className)el.className=className;
 if(text!==undefined)el.textContent=text;
 return el;
}
/* Single fixed overlay lives outside overflow-hidden cards and accordions. */
export function installPremadeCardHover(root,{lookup=resolveScryfallCard}={}){
 if(!root||!document.body?.append)return {close:()=>{}};
 const popup=make('div','premade-card-hover');
 popup.hidden=true;
 popup.setAttribute('role','tooltip');
 popup.setAttribute('aria-hidden','true');
 const title=make('div','premade-card-hover-name');
 const image=make('img','premade-card-hover-image');
 image.alt='';
 image.hidden=true;
 image.decoding='async';
 const notice=make('p','premade-card-hover-notice','');
 popup.append(title,image,notice);
 document.body.append(popup);
 let active=null,requestId=0;
 const close=()=>{
  active=null;requestId++;
  popup.hidden=true;image.hidden=true;
  image.removeAttribute('src');
 };
 const place=()=>{
  if(!active||popup.hidden)return;
  const rect=active.getBoundingClientRect();
  const width=popup.getBoundingClientRect().width;
  const height=popup.getBoundingClientRect().height;
  const w=window.innerWidth,h=window.innerHeight;
  const left=rect.right+16+width<=w-12?rect.right+16:
   rect.left-16-width>=12?rect.left-16-width:
   Math.max(12,Math.min(w-width-12,rect.left));
  const top=Math.max(12,Math.min(rect.top-28,h-height-12));
  popup.style.left=left+'px';
  popup.style.top=top+'px';
 };
 const show=anchor=>{
  if(!anchor||anchor===active)return;
  const name=anchor.dataset?.scryfallCard;
  if(!name)return;
  active=anchor;
  const id=++requestId;
  title.textContent=name;
  notice.textContent='Loading card image…';
  image.hidden=true;image.removeAttribute('src');
  popup.hidden=false;
  place();
  lookup(name).then(result=>{
   if(requestId!==id||active!==anchor)return;
   if(result?.href)anchor.href=result.href;
   if(result?.image){
    image.hidden=false;
    image.src=result.image;
    notice.textContent='';
    place();
   }else{
    notice.textContent='Preview unavailable — open the card on Scryfall.';
    place();
   }
  }).catch(()=>{
   if(requestId===id&&active===anchor){
    notice.textContent='Preview unavailable — open the card on Scryfall.';
    place();
   }
  });
 };
 image.addEventListener('load',place);
 const isCard=event=>{
  const a=event.target?.closest?.('a.premade-card-link');
  return a&&root.contains(a)?a:null;
 };
 root.addEventListener('pointerover',event=>{
  if(event.pointerType&&event.pointerType!=='mouse')return;
  const a=isCard(event);
  if(a&&(!event.relatedTarget||!a.contains(event.relatedTarget)))show(a);
 });
 root.addEventListener('pointerout',event=>{
  const a=isCard(event);
  if(a&&a===active&&(!event.relatedTarget||!a.contains(event.relatedTarget)))close();
 });
 root.addEventListener('focusin',event=>{const a=isCard(event);if(a)show(a)});
 root.addEventListener('focusout',event=>{
  const a=isCard(event);if(a&&a===active)close();
 });
 root.addEventListener('toggle',event=>{if(event.target.open===false)close()},true);
 window.addEventListener('scroll',close,{passive:true});
 window.addEventListener('resize',close);
 return {close};
}
