/* Shared header profile shortcut. The avatar is the signed-in Field Network
   commander's saved portrait; anonymous users get a sign-in silhouette.
   Authentication uses the existing HttpOnly device cookie or an existing
   temporary profile key. No secrets are persisted or exposed in the header. */
(() => {
 "use strict";
 const ACCOUNT_URL="/community.html#account";
 const endpoint="/api/community?action=me";
 const KEY="dc-profile-key";
 const NAME_PATTERN=/^dcprofile1_[a-f0-9]{32}_[a-f0-9]{64}$/;
 const DEFAULT_ZOOM=2.8;
 let button,photo,placeholder,caption,requestVersion=0,lastCheck=0;
 function node(tag,className,text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
 }
 function makeIcon(){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 24 24");
  svg.setAttribute("width","24");svg.setAttribute("height","24");
  svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
  svg.setAttribute("fill","none");
  svg.setAttribute("stroke","currentColor");
  svg.setAttribute("stroke-width","1.75");
  svg.setAttribute("stroke-linecap","round");
  svg.setAttribute("stroke-linejoin","round");
  for(const d of ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"]){
   const path=document.createElementNS("http://www.w3.org/2000/svg","path");
   path.setAttribute("d",d);svg.append(path);
  }
  return svg;
 }
 function portraitUrl(name){
  return "https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name)+"&format=image&version=art_crop";
 }
 function focusImage(profile){
  const number=(v,fallback)=>v===null||v===undefined?fallback:Number(v);
  const zoom=Math.max(1.8,Math.min(4.2,number(profile.focus_zoom,DEFAULT_ZOOM)||DEFAULT_ZOOM));
  const x=Math.max(0,Math.min(100,number(profile.focus_x,50)));
  const y=Math.max(0,Math.min(100,number(profile.focus_y,30)));
  const limit=(zoom-1)*50;
  const dx=Math.max(-limit,Math.min(limit,(50-x)*zoom));
  const dy=Math.max(-limit,Math.min(limit,(50-y)*zoom));
  photo.style.transform="translate("+dx.toFixed(2)+"%, "+dy.toFixed(2)+"%) scale("+zoom.toFixed(2)+")";
 }
 function showProfile(profile){
  const valid=profile&&typeof profile.handle==="string"&&
   /^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(profile.handle);
  button.classList.toggle("is-signed-in",!!valid);
  if(!valid){
   button.classList.remove("has-portrait");
   photo.removeAttribute("src");
   caption.textContent="PROFILE";
   button.title="Sign in or create a Field Network profile";
   button.setAttribute("aria-label","Sign in or create your investigator profile");
   return;
  }
  caption.textContent="MY PROFILE";
  button.title="Open @"+profile.handle+"'s investigator dossier";
  button.setAttribute("aria-label","Open @"+profile.handle+"'s investigator profile");
  if(typeof profile.avatar!=="string"||!profile.avatar){
   photo.removeAttribute("src");button.classList.remove("has-portrait");
   return;
  }
  focusImage(profile);
  const next=portraitUrl(profile.avatar);
  if(photo.getAttribute("src")!==next){
   button.classList.remove("has-portrait");
   photo.src=next;
  }else if(photo.complete&&photo.naturalWidth){
   button.classList.add("has-portrait");
  }
 }
 function browserKey(){
  try{
   const key=sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||"";
   return NAME_PATTERN.test(key)?key:"";
  }catch{return ""}
 }
 async function refresh(){
  if(!button)return;
  const version=++requestVersion;
  lastCheck=Date.now();
  const headers={"Accept":"application/json"};
  const key=browserKey();
  if(key)headers.Authorization="Bearer "+key;
  try{
   let response=await fetch(endpoint,{
    method:"GET",credentials:"same-origin",cache:"no-store",headers
   });
   // A stale old key should not conceal a different valid remembered-device
   // cookie: the backend intentionally rejects invalid explicit Bearer headers.
   if(response.status===401&&key){
    response=await fetch(endpoint,{
     method:"GET",credentials:"same-origin",cache:"no-store",
     headers:{"Accept":"application/json"}
    });
   }
   if(version!==requestVersion)return;
   if(!response.ok){showProfile(null);return}
   const data=await response.json();
   if(version===requestVersion)showProfile(data.profile||null);
  }catch{
   if(version===requestVersion)showProfile(null);
  }
 }
 // Central navigation shared by every public page and future report.
 function setupNavigation(root){
  const nav=root.querySelector(".primary-nav");
  if(!nav||root.querySelector(".site-menu-toggle"))return;
  nav.id="site-primary-navigation";
  if(!nav.querySelector('a[href="/set-watch.html"]')){
   const watch=node("a","set-watch-nav-link","SET WATCH");
   watch.href="/set-watch.html";
   const after=nav.querySelector('a[href="/index.html#archive"]');
   if(after)after.after(watch);else nav.append(watch);
  }
  if(location.pathname==="/set-watch.html"){
   nav.querySelector('a[href="/set-watch.html"]')?.setAttribute("aria-current","page");
  }
  const links=Array.from(nav.children).filter(a=>a.tagName==="A");
  const groups=[
   ["DISCOVER",["/index.html#latest","/index.html#archive","/set-watch.html"]],
   ["BUILD & PLAY",["/library.html","/deck.html","/games.html"]],
   ["COMMUNITY",["/nominations.html","/community.html","/members.html"]]
  ];
  for(const [i,[label,urls]] of groups.entries()){
   const group=node("div","site-nav-group");
   const heading=node("span","site-nav-heading",label);
   heading.id="site-nav-heading-"+i;
   group.setAttribute("role","group");
   group.setAttribute("aria-labelledby",heading.id);
   group.append(heading);
   for(const url of urls){
    const link=links.find(a=>a.getAttribute("href")===url);
    if(link)group.append(link);
   }
   nav.append(group);
  }
  const last=nav.querySelector(".site-nav-group:last-child");
  for(const link of links)if(link.parentElement===nav)last?.append(link);
  const toggle=node("button","site-menu-toggle");
  toggle.type="button";
  toggle.setAttribute("aria-controls",nav.id);
  toggle.setAttribute("aria-expanded","false");
  toggle.setAttribute("aria-label","Open site navigation menu");
  const glyph=node("span","site-menu-glyph");
  glyph.setAttribute("aria-hidden","true");
  for(let i=0;i<3;i++)glyph.append(node("span"));
  const title=node("span","site-menu-label","MENU");
  toggle.append(glyph,title);
  const shortcuts=node("div","site-mobile-shortcuts");
  shortcuts.setAttribute("aria-label","Quick links");
  const games=node("a","site-mobile-quick site-mobile-games","DAILY GAMES");
  games.href="/games.html";
  const watch=node("a","site-mobile-quick site-mobile-watch","SET WATCH ↗");
  watch.href="/set-watch.html";
  if(location.pathname==="/games.html"||location.pathname.startsWith("/games/"))games.setAttribute("aria-current","page");
  if(location.pathname==="/set-watch.html")watch.setAttribute("aria-current","page");
  shortcuts.append(games,watch);
  root.insertBefore(toggle,nav);
  root.insertBefore(shortcuts,nav);
  const setOpen=open=>{
   nav.classList.toggle("site-nav-open",open);
   toggle.setAttribute("aria-expanded",String(open));
   toggle.setAttribute("aria-label",open?"Close site navigation menu":"Open site navigation menu");
   title.textContent=open?"CLOSE":"MENU";
  };
  toggle.addEventListener("click",()=>setOpen(!nav.classList.contains("site-nav-open")));
  nav.addEventListener("click",event=>{if(event.target.closest("a"))setOpen(false)});
  document.addEventListener("keydown",event=>{
   if(event.key==="Escape"&&nav.classList.contains("site-nav-open")){
    setOpen(false);toggle.focus();
   }
  });
  const media=window.matchMedia("(max-width: 1180px)");
  media.addEventListener?.("change",()=>setOpen(false));
 }
 function setup(){
  const root=document.querySelector(".site-header .header-inner");
  if(!root||root.querySelector(".header-profile-button"))return;
  root.classList.add("header-profile-enabled");
  setupNavigation(root);
  button=node("a","header-profile-button");
  button.href=ACCOUNT_URL;
  button.setAttribute("aria-label","Sign in or create your investigator profile");
  button.title="Sign in or create a Field Network profile";
  const frame=node("span","header-profile-frame");
  placeholder=node("span","header-profile-placeholder");
  placeholder.setAttribute("aria-hidden","true");
  placeholder.append(makeIcon());
  photo=node("img","header-profile-photo");
  photo.alt="";
  photo.loading="eager";
  photo.decoding="async";
  photo.referrerPolicy="no-referrer";
  photo.addEventListener("load",()=>{
   if(button.classList.contains("is-signed-in")&&photo.naturalWidth)button.classList.add("has-portrait");
  });
  photo.addEventListener("error",()=>button.classList.remove("has-portrait"));
  frame.append(placeholder,photo);
  const presence=node("span","header-profile-presence");
  presence.setAttribute("aria-hidden","true");
  caption=node("span","header-profile-caption","PROFILE");
  button.append(frame,presence,caption);
  // After the last navigation link and any existing action button.
  root.append(button);
  window.addEventListener("deepcuts:profile-change",event=>{
   requestVersion++;
   lastCheck=Date.now();
   if(event.detail&&Object.prototype.hasOwnProperty.call(event.detail,"profile")){
    showProfile(event.detail.profile);
   }else refresh();
  });
  window.addEventListener("pageshow",event=>{if(event.persisted)refresh()});
  window.addEventListener("storage",event=>{
   if(event.key===KEY||event.key===null)refresh();
  });
  document.addEventListener("visibilitychange",()=>{
   if(!document.hidden&&Date.now()-lastCheck>60000)refresh();
  });
  refresh();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
 else setup();
})();
