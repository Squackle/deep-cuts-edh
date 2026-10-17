/* Site-wide lightweight visitor presence. One opaque ID per browser, not per tab.
 * We count browsers that keep this site open; clicks/scrolling are irrelevant.
 */
(()=>{
 "use strict";
 const ENDPOINT="/api/site-presence",KEY="deep-cuts-browser-presence-v1",LAST_PAGE="deep-cuts-browser-last-page-v1",INTERVAL=30000;
 const path=location.pathname.toLowerCase();
 const page=path==="/"||path==="/index.html"?"Home":
  path.startsWith("/library")?"Card Library":
  path.startsWith("/deep-cut-finder")?"Deep Cut Finder":
  path.startsWith("/deck")||path.startsWith("/binder-to-brew")?"Tools & Resources":
  path.startsWith("/combos")?"Combo Finder":
  path.startsWith("/set-watch")?"Set Watch":
  path.startsWith("/games/hive-run")?"Hive Run":
  path.startsWith("/games/")?"Daily Games":
  path.startsWith("/games")?"Arcade":
  path.startsWith("/community")?"Community":
  path.startsWith("/reports/")?"Rescue Reports":
  path.startsWith("/nominations")?"Nominations":
  path.startsWith("/profile")?"Member Profiles":
  path.startsWith("/members")?"Members Lounge":
  path.startsWith("/supporters")?"Supporters":"Other";
 let id;
 try{
  id=localStorage.getItem(KEY);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[47][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id||"")){
   id=crypto.randomUUID();localStorage.setItem(KEY,id);
  }
 }catch{id=crypto.randomUUID()}
 const savePage=()=>{
  if(document.visibilityState==="hidden")return;
  try{localStorage.setItem(LAST_PAGE,JSON.stringify({page,at:Date.now()}))}catch{}
 };
 const activePage=()=>{
  try{
   const x=JSON.parse(localStorage.getItem(LAST_PAGE)||"null");
   if(x&&typeof x.page==="string"&&Date.now()-x.at<86400000)return x.page;
  }catch{}
  return page;
 };
 const pill=document.createElement("div");
 pill.className="dc-online-pill";pill.setAttribute("role","status");
 pill.setAttribute("aria-label","Online browsers across Deep Cuts EDH");
 const dot=document.createElement("span");dot.className="dc-online-dot";dot.setAttribute("aria-hidden","true");
 const count=document.createElement("span");count.className="dc-online-number";count.textContent="—";
 const label=document.createElement("span");label.className="dc-online-label";label.textContent="online";
 pill.append(dot,count,label);
 // Share the existing 28px supporter ribbon: scrolling acknowledgments
 // take the flexible left slot while the count stays fixed at its right edge.
 // The separate Hive Run header has no supporter ticker and retains a slim
 // standalone rail instead. Never add a second row to the regular site header.
 function mount(){
  const header=document.querySelector(".site-header");
  const gameHeader=document.querySelector(".lab-header[data-profile-header]");
  if(header){
   const placeWithSupporters=()=>{
    const inner=header.querySelector(".site-supporter-strip .site-supporter-inner");
    if(!inner)return false;
    inner.append(pill); // After the scrolling window, outside its animation.
    return true;
   };
   if(!placeWithSupporters()){
    // Header and presence scripts can initialize in either order.
    const observer=new MutationObserver(()=>{
     if(placeWithSupporters())observer.disconnect();
    });
    observer.observe(header,{childList:true,subtree:true});
   }
  }else{
   const rail=document.createElement("div");rail.className="dc-online-rail";
   const inner=document.createElement("div");inner.className="dc-online-rail-inner";
   inner.append(pill);rail.append(inner);
   if(gameHeader)gameHeader.after(rail);
   else document.body.prepend(rail);
  }
 }
 if(document.readyState==="loading")
  document.addEventListener("DOMContentLoaded",mount,{once:true});
 else mount();
 const heartbeat=async()=>{
  try{await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,page:activePage()}),cache:"no-store",keepalive:true})}catch{}
 };
 const refresh=async()=>{
  try{
   const r=await fetch(ENDPOINT,{cache:"no-store"});
   if(!r.ok)throw Error("Unavailable");
   const data=await r.json();if(!Number.isSafeInteger(data.online)||data.online<0)throw Error("Invalid count");
   count.textContent=data.online.toLocaleString();
   pill.setAttribute("aria-label",data.online.toLocaleString()+" browsers online across Deep Cuts EDH");
   pill.title="Browsers connected to Deep Cuts EDH";
  }catch{
   count.textContent="—";
   pill.setAttribute("aria-label","Online browser count temporarily unavailable");
   pill.title="Online count temporarily unavailable";
  }
 };
 const pulse=async()=>{await heartbeat();await refresh()};
 window.addEventListener("focus",()=>{savePage();pulse()});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden){savePage();pulse()}});
 window.addEventListener("online",pulse);window.addEventListener("pageshow",pulse);
 window.setInterval(pulse,INTERVAL);
 savePage();pulse();
})();
