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
 pill.setAttribute("aria-label","Browsers currently online across Deep Cuts EDH");
 pill.textContent="● — ONLINE";document.body.append(pill);
 const heartbeat=async()=>{
  try{await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,page:activePage()}),cache:"no-store",keepalive:true})}catch{}
 };
 const refresh=async()=>{
  try{
   const r=await fetch(ENDPOINT,{cache:"no-store"});
   if(!r.ok)throw Error("Unavailable");
   const data=await r.json();if(!Number.isSafeInteger(data.online)||data.online<0)throw Error("Invalid count");
   pill.textContent="● "+data.online.toLocaleString()+" ONLINE";
   pill.title="Browsers connected to Deep Cuts EDH";
  }catch{pill.textContent="● — ONLINE";pill.title="Online count temporarily unavailable"}
 };
 const pulse=async()=>{await heartbeat();await refresh()};
 window.addEventListener("focus",()=>{savePage();pulse()});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden){savePage();pulse()}});
 window.addEventListener("online",pulse);window.addEventListener("pageshow",pulse);
 window.setInterval(pulse,INTERVAL);
 savePage();pulse();
})();
