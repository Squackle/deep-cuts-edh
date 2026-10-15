/* Shared header profile shortcut. The avatar is the signed-in Community
   commander's saved portrait; anonymous users get a sign-in silhouette.
   Authentication uses the existing HttpOnly device cookie or an existing
   temporary profile key. No secrets are persisted or exposed in the header. */
(() => {
 "use strict";
 const ACCOUNT_URL="/profile";
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
   button.title="Sign in or create a Community profile";
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
 // Central navigation shared by every public page.
 // Preserve the existing mobile menu; enhance desktop without editing every page.
 function setupNavigation(root){
  const nav=root.querySelector(".primary-nav");
  if(!nav||root.querySelector(".site-menu-toggle"))return;
  nav.id="site-primary-navigation";
  nav.setAttribute("aria-label","Mobile site navigation");
  const pagePath=location.pathname.replace(/\.html$/,"").replace(/\/$/,"")||"/";
  const original=Array.from(nav.children).filter(a=>a.tagName==="A");
  const items=new Map(original.map(a=>[a.textContent.trim().toUpperCase(),a]));
  const addLink=(label,url)=>{
   if(items.has(label))return;
   const a=node("a","site-nav-extra",label);
   a.href=url;
   if(pagePath===url.replace(/\.html$/,""))a.setAttribute("aria-current","page");
   items.set(label,a);
  };
  addLink("SET WATCH","/set-watch");
  addLink("DEEP CUT FINDER","/deep-cut-finder");
  addLink("BINDER TO BREW","/binder-to-brew");
  const mobileGroups=[
   ["DISCOVER",["RESCUE REPORT","COMMANDERS","SET WATCH","DEEP CUT FINDER"]],
   ["BUILD & PLAY",["CARD LIBRARY","DECK WORKSHOP","BINDER TO BREW","ARCADE"]],
   ["CONNECT",["NOMINATIONS","COMMUNITY","MEMBERS' LOUNGE"]]
  ];
  for(const [i,[label,names]] of mobileGroups.entries()){
   const group=node("div","site-nav-group");
   const heading=node("span","site-nav-heading",label);
   heading.id="site-nav-heading-"+i;
   group.setAttribute("role","group");
   group.setAttribute("aria-labelledby",heading.id);
   group.append(heading);
   for(const name of names){
    const link=items.get(name);
    if(link)group.append(link);
   }
   nav.append(group);
  }
  // Unexpected legacy links remain reachable instead of silently vanishing.
  const last=nav.querySelector(".site-nav-group:last-child");
  for(const link of original)if(link.parentElement===nav)last?.append(link);

  const desktop=node("nav","site-desktop-navigation");
  desktop.setAttribute("aria-label","Main site navigation");
  const desktopDetails=[];
  const section=(label,names)=>{
   const details=node("details","site-desktop-group");
   const summary=node("summary","site-desktop-trigger");
   summary.append(node("span",null,label));
   const chevron=node("span","site-desktop-chevron","⌄");
   chevron.setAttribute("aria-hidden","true");
   summary.append(chevron);
   const panel=node("div","site-desktop-panel");
   for(const name of names){
    const source=items.get(name);
    if(!source)continue;
    const link=source.cloneNode(true);
    link.classList.add("site-desktop-item");
    // Preserve active navigation even when the original page omits it.
    const current=(name==="DEEP CUT FINDER"&&pagePath==="/deep-cut-finder")||
      (name==="BINDER TO BREW"&&pagePath==="/binder-to-brew")||
      (name==="SET WATCH"&&pagePath==="/set-watch")||
      (name==="RESCUE REPORT"&&pagePath.startsWith("/reports/"));
    if(current)link.setAttribute("aria-current","page");
    panel.append(link);
   }
   if(panel.querySelector('[aria-current="page"]'))details.classList.add("site-desktop-current");
   details.append(summary,panel);
   details.addEventListener("toggle",()=>{
    if(details.open)for(const other of desktopDetails)if(other!==details)other.open=false;
   });
   desktopDetails.push(details);
   desktop.append(details);
  };
  section("DISCOVER",["RESCUE REPORT","COMMANDERS","CARD LIBRARY","SET WATCH","DEEP CUT FINDER"]);
  section("BUILD",["DECK WORKSHOP","BINDER TO BREW"]);
  const arcade=items.get("ARCADE")?.cloneNode(true);
  if(arcade){
   arcade.classList.add("site-desktop-arcade");
   if(pagePath==="/games"||pagePath.startsWith("/games/"))arcade.setAttribute("aria-current","page");
   desktop.append(arcade);
  }
  section("CONNECT",["NOMINATIONS","COMMUNITY","MEMBERS' LOUNGE"]);
  const closeDesktop=()=>{for(const d of desktopDetails)d.open=false};
  desktop.addEventListener("click",e=>{if(e.target.closest("a"))closeDesktop()});
  document.addEventListener("pointerdown",e=>{if(!desktop.contains(e.target))closeDesktop()});
  document.addEventListener("keydown",e=>{
   if(e.key!=="Escape")return;
   const opened=desktopDetails.find(d=>d.open);
   if(opened){closeDesktop();opened.querySelector("summary")?.focus();}
  });
  root.insertBefore(desktop,nav);
  root.classList.add("site-desktop-ready");

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
  const games=node("a","site-mobile-quick site-mobile-games","ARCADE");
  games.href="/games";
  const watch=node("a","site-mobile-quick site-mobile-watch","SET WATCH ↗");
  watch.href="/set-watch";
  if(pagePath==="/games"||pagePath.startsWith("/games/"))games.setAttribute("aria-current","page");
  if(pagePath==="/set-watch")watch.setAttribute("aria-current","page");
  shortcuts.append(games,watch);
  root.insertBefore(toggle,desktop);
  root.insertBefore(shortcuts,desktop);
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
  media.addEventListener?.("change",()=>{setOpen(false);closeDesktop()});
 }
 // Tiny editorial supporter roll beneath the shared top bar. No donor
 // names are inferred from payments; the endpoint returns opt-in credits only.
 function setupSupporterTicker(root){
  const header=root.closest(".site-header");
  if(!header||header.querySelector(".site-supporter-strip"))return;
  const strip=node("div","site-supporter-strip");
  strip.setAttribute("aria-label","Supporter recognition");
  const inner=node("div","site-supporter-inner");
  const label=node("span","site-supporter-label","BROUGHT TO YOU BY OUR SUPPORTERS:");
  const view=node("div","site-supporter-window");
  const track=node("div","site-supporter-track");
  view.append(track);inner.append(label,view);strip.append(inner);header.append(strip);
  let supporters=[];
  const unit=()=>{
   const tile=node("span","site-supporter-unit");
   if(!supporters.length){
    const empty=node("span","site-supporter-empty");
    empty.append("Your name could be here · ");
    const join=node("a",null,"SUPPORT THE ARCHIVE ↗");
    join.href="/supporters";empty.append(join);tile.append(empty);
   }else{
    for(const entry of supporters){
     const link=node("a","site-supporter-name site-supporter-"+entry.tier,entry.name);
     link.href="/supporters";
     const tier={chief:"Chief Investigator",detective:"Detective",informant:"Informant"}[entry.tier];
     link.setAttribute("aria-label",entry.name+" · "+tier+" supporter");
     link.title=tier+" supporter";
     tile.append(link);
    }
   }
   return tile;
  };
  const decorative=element=>{
   element.setAttribute("aria-hidden","true");
   element.querySelectorAll("a").forEach(a=>a.tabIndex=-1);
   return element;
  };
  function render(){
   const group=node("span","site-supporter-group");
   const original=unit();
   group.append(original);track.replaceChildren(group);
   // A single short credit or empty invitation cannot fill the ribbon.
   // Repeat enough identical tiles to cover its viewport before cloning the
   // whole cycle; half-width translation then loops without a blank stretch.
   const tileWidth=Math.max(120,original.getBoundingClientRect().width+23);
   const repeats=Math.max(2,Math.min(16,Math.ceil((view.clientWidth+32)/tileWidth)+1));
   for(let i=1;i<repeats;i++)group.append(decorative(original.cloneNode(true)));
   const copy=decorative(group.cloneNode(true));
   track.append(copy);
   const pixels=group.getBoundingClientRect().width;
   track.style.setProperty("--site-supporter-duration",Math.max(24,Math.round(pixels/45))+"s");
   track.classList.add("is-scrolling");
   strip.classList.toggle("has-supporters",supporters.length>0);
  }
  // Invite supporters from first paint, even with zero opt-ins or an offline API.
  render();
  let previousWidth=view.clientWidth;
  window.addEventListener("resize",()=>{
   const width=view.clientWidth;
   if(Math.abs(width-previousWidth)>=24){previousWidth=width;render()}
  },{passive:true});
  fetch("/api/supporter-ticker",{credentials:"omit",cache:"no-store"})
   .then(async response=>{if(!response.ok)throw Error("Supporter roll unavailable");return response.json()})
   .then(data=>{
    supporters=Array.isArray(data?.supporters)?data.supporters.filter(x=>
     x&&typeof x.name==="string"&&x.name.length>=2&&x.name.length<=36&&
     ["chief","detective","informant"].includes(x.tier)).slice(0,50):[];
    render(); // Empty lists scroll the invitation; no invented supporter names.
   }).catch(()=>{}); // Keep the moving invitation when the API is unavailable.
 }
 function setup(){
  // Hive Run uses a slim arcade header but shares our real account avatar,
  // portrait crop, sign-in link and account-change events.
  const root=document.querySelector(".site-header .header-inner")||
             document.querySelector(".lab-header[data-profile-header]");
  if(!root||root.querySelector(".header-profile-button"))return;
  root.classList.add("header-profile-enabled");
  setupNavigation(root);
  setupSupporterTicker(root);
  button=node("a","header-profile-button");
  button.href=ACCOUNT_URL;
  button.setAttribute("aria-label","Sign in or create your investigator profile");
  button.title="Sign in or create a Community profile";
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
  // One consistent supporter destination on every main-site header.
  // Reuse the homepage's gold button; never hijack a page action or sign-in link.
  if(root.closest(".site-header")){
   const support=root.querySelector(".header-action")||node("a","header-action");
   support.href="/supporters";
   support.setAttribute("aria-label","Support Deep Cuts EDH");
   support.textContent="SUPPORT THE SITE ↗";
   support.classList.add("site-support-action");
   if(!support.parentElement)root.append(support);
  }
  const presence=node("span","header-profile-presence");
  presence.setAttribute("aria-hidden","true");
  caption=node("span","header-profile-caption","PROFILE");
  button.append(frame,presence,caption);
  // After the last navigation link and any existing action button.
  root.append(button);
  if(root.querySelector(".site-desktop-navigation")){
   const menu=node("details","header-profile-menu");
   const trigger=node("summary","header-profile-menu-trigger");
   trigger.setAttribute("aria-label","Open profile shortcuts");
   trigger.title="Profile shortcuts";
   const glyph=node("span","header-profile-menu-glyph");
   glyph.setAttribute("aria-hidden","true");
   for(let i=0;i<3;i++)glyph.append(node("span"));
   trigger.append(glyph);
   const panel=node("nav","header-profile-menu-panel");
   panel.setAttribute("aria-label","Profile shortcuts");
   for(const [label,url] of [["MY PROFILE","/profile"],["MY COLLECTION","/profile#collection"],["NOTIFICATIONS","/profile#dispatches"],["ACCOUNT SETTINGS","/profile#account"]]){
    const a=node("a",null,label);a.href=url;panel.append(a);
   }
   menu.append(trigger,panel);root.append(menu);
   document.addEventListener("pointerdown",e=>{if(!menu.contains(e.target))menu.open=false});
   document.addEventListener("keydown",e=>{if(e.key==="Escape"&&menu.open){menu.open=false;trigger.focus()}});
   menu.addEventListener("click",e=>{if(e.target.closest("a"))menu.open=false});
  }
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
