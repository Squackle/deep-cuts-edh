/* The HTML ships a crawlable, source-verified latest report. Update it only
 * when the public weekly publisher releases a newer dated article.
 * This is presentational: publication and source checks remain server-side.
 */
const LATEST_URL='https://deep-cuts-weekly-publisher.logan-ottfamily.workers.dev/v1/latest';

// Use the published card's CDN artwork, never the rate-limited
// /cards/named image-lookup endpoint on every homepage visit.
export function trustedCardImage(url){
 if(typeof url!=='string')return null;
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&u.hostname==='cards.scryfall.io'&&
   /^\/normal\/(?:front|back)\/[a-f0-9]\/[a-f0-9]\/[a-f0-9-]{36}\.jpg$/.test(u.pathname)&&
   (!u.search||/^\?\d+$/.test(u.search))?u.href:null;
 }catch{return null}
}
// Never switch the featured name/link until its exact card image has loaded.
// Failure preserves the fully functional previous report and portrait.
export function preloadCardImage(url,create=()=>new Image()){
 return new Promise(resolve=>{
  try{
   const image=create();let settled=false;
   const done=value=>{if(!settled){settled=true;resolve(value)}};
   image.onload=()=>done(image.naturalWidth>0);
   image.onerror=()=>done(false);
   image.src=url;
   if(image.complete)done(image.naturalWidth>0);
  }catch{resolve(false)}
 });
}
export function watchFeaturedImage(image){
 if(!image)return false;
 let usedFallback=false;
 const failed=()=>{
  if(usedFallback)return;
  usedFallback=true;
  image.src='/assets/deep-cuts-mark.svg';
 };
 image.addEventListener('error',failed,{once:true});
 if(image.complete&&image.naturalWidth===0)failed();
 return true;
}
export function newerWeeklyReport(payload,featuredDate){
 const item=payload?.report;
 if(!item||typeof item!=='object'||Array.isArray(item))return null;
 const {date,commander,theme}=item;
 if(typeof date!=='string'||!/^20\d\d-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z')))return null;
 if(typeof featuredDate!=='string'||date<=featuredDate)return null;
 if(typeof commander!=='string'||typeof theme!=='string')return null;
 const name=commander.trim(),subject=theme.trim();
 if(!name||name.length>110||!subject||subject.length>130)return null;
 const image=trustedCardImage(item.imageUrl);
 if(!image)return null;
 return {date,commander:name,theme:subject,url:'/rescues/'+date,image};
}
export function applyWeeklyFeature(root,report,documentNode){
 if(!root||!report||!documentNode)return false;
 const date=root.querySelector('[data-weekly-date-label]');
 const name=root.querySelector('[data-weekly-name]');
 const theme=root.querySelector('[data-weekly-theme]');
 const image=root.querySelector('[data-weekly-image]');
 if(!date||!name||!theme||!image)return false;
 root.setAttribute('href',report.url);
 root.setAttribute('aria-label','Read the latest weekly Commander Rescue Report: '+report.commander);
 root.dataset.weeklyDate=report.date;
 date.textContent=report.date;
 name.textContent=report.commander;
 theme.textContent=report.theme;
 image.alt=report.commander+' Magic card';
 watchFeaturedImage(image);
 image.src=report.image;
 const archive=documentNode.getElementById('homeLatestWeeklyText');
 if(archive){
  archive.setAttribute('href',report.url);
  archive.textContent='LATEST WEEKLY: '+report.commander+' ↗';
 }
 return true;
}
if(typeof document!=='undefined'){
 const featured=document.getElementById('homeWeeklyFeature');
 if(featured&&typeof fetch==='function'){
  watchFeaturedImage(featured.querySelector('[data-weekly-image]'));
  fetch(LATEST_URL,{headers:{Accept:'application/json'},cache:'no-store'})
   .then(r=>{if(!r.ok)throw Error('Weekly archive unavailable');return r.json();})
   .then(data=>{
    const next=newerWeeklyReport(data,featured.dataset.weeklyDate);
    if(next)preloadCardImage(next.image).then(ok=>{
     if(ok&&featured.dataset.weeklyDate<next.date)applyWeeklyFeature(featured,next,document);
    });
   }).catch(()=>{ /* Keep the fully linked, crawlable featured fallback. */ });
 }
}
