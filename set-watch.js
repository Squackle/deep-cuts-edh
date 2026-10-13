/* MTG Set Watch — on-demand Scryfall previews, with 4h edge cache and no hardcoded spoilers. */
const $=id=>document.getElementById(id);
const page=!!$("swUpcoming"),home=!!$("setWatchHome");
const state={sets:[],selected:null,cards:[],page:0,more:false,shown:24,focus:"all",seq:0,loading:false,total:0,error:""};
const el=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
function safeLink(url,fallback="https://scryfall.com/sets",previewSource=false){
 try{const u=new URL(url);if(u.protocol==="https:"&&(previewSource||["scryfall.com","cards.scryfall.io","magic.wizards.com"].includes(u.hostname)))return u.toString()}catch{}
 return fallback;
}
function fmtDate(value){const d=new Date(value+"T12:00:00Z");return Number.isNaN(d.valueOf())?value:new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(d)}
async function api(endpoint){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),11000);
 try{const response=await fetch("/api/set-previews"+endpoint,{headers:{"Accept":"application/json"},signal:controller.signal});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||"Preview data is temporarily unavailable.");
 return data;
 }finally{clearTimeout(timeout)}
}
function setButton(record,recent=false){
 const button=el("button",recent?"sw-recent-button":"sw-set");button.type="button";
 if(recent){button.textContent=record.name+" · "+fmtDate(record.released_at)}
 else{
  const head=el("div","sw-set-top");
  head.append(el("span","",record.type.replaceAll("_"," ").toUpperCase()),el("span","sw-set-date",fmtDate(record.released_at)));
  button.append(head,el("strong","sw-set-name",record.name),el("span","sw-set-foot","REVEALED CARDS & RELEASE DETAILS ↗"));
 }
 button.dataset.code=record.code;
 button.addEventListener("click",()=>openSet(record.code,true));
 return button;
}
function reflectSelection(){
 document.querySelectorAll("[data-code]").forEach(b=>{const active=b.dataset.code===state.selected?.code;b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",String(active))});
}
function showSets(data){
 const upcoming=$("swUpcoming"),recent=$("swRecent");upcoming.replaceChildren();recent.replaceChildren();
 const future=data.upcoming||[],past=data.recent||[];
 if(!future.length)upcoming.append(el("p","sw-loading","No upcoming paper sets currently listed. Check back as announcements appear."));
 for(const s of future)upcoming.append(setButton(s));
 if(!past.length)recent.append(el("p","sw-loading","No recent sets in the tracking window."));
 for(const s of past)recent.append(setButton(s,true));
 if($("swUpdated"))$("swUpdated").textContent="SCRYFALL DATA · REFRESHES ABOUT EVERY 4 HOURS";
}
function cardTile(card){
 const article=el("article","sw-card");
 const art=el("a","sw-card-art");art.href=safeLink(card.url);art.target="_blank";art.rel="noopener noreferrer";art.setAttribute("aria-label","View "+card.name+" on Scryfall");
 if(card.image){const img=el("img");img.src=safeLink(card.image,"https://scryfall.com");img.alt=card.name+" Magic card image";img.loading="lazy";img.decoding="async";art.append(img)}
 else art.append(el("span","sw-card-art-placeholder","Image not available yet"));
 article.append(art);
 const title=el("h3"),link=el("a","",card.name);link.href=safeLink(card.url);link.target="_blank";link.rel="noopener noreferrer";title.append(link);article.append(title);
 article.append(el("p","sw-card-meta",[card.type,card.rarity].filter(Boolean).join(" · ")));
 const badges=el("div","sw-card-labels");
 if(card.unreleased)badges.append(el("span","sw-card-badge is-preview","UNRELEASED PREVIEW"));
 else if(card.commander_legal)badges.append(el("span","sw-card-badge","COMMANDER LEGAL"));
 if(card.commander_candidate)badges.append(el("span","sw-card-badge","LEGENDARY WATCH"));
 article.append(badges);
 const sources=el("div","sw-card-links");
 const onScryfall=el("a","","VIEW CARD ↗");onScryfall.href=safeLink(card.url);onScryfall.target="_blank";onScryfall.rel="noopener noreferrer";sources.append(onScryfall);
 if(card.preview_source_uri){
  const p=el("a","","PREVIEW SOURCE ↗");p.href=safeLink(card.preview_source_uri,safeLink(card.url),true);p.target="_blank";p.rel="noopener noreferrer";sources.append(p);
 }
 article.append(sources);return article;
}
function visibleCards(){return state.focus==="legendary"?state.cards.filter(c=>c.commander_candidate):state.cards}
function redrawCards(){
 const grid=$("swCards"),status=$("swCardStatus"),more=$("swLoadMore");
 if(!grid)return;
 grid.replaceChildren();
 const list=visibleCards();const limit=Math.min(state.shown,list.length);
 for(const c of list.slice(0,limit))grid.append(cardTile(c));
 if(!limit){
  grid.append(el("p","sw-error",state.loading?"Loading preview cards…":state.error|| (state.focus==="legendary"?"No legendary cards indexed in the pages loaded. Use Show More to check additional cards." :"No revealed cards indexed for this set yet. The page will update when Scryfall adds previews.")));
 }
 if(status)status.textContent=(limit?limit+" displayed · ":"")+(state.total||0)+" currently indexed"+(state.focus==="legendary"?" · legendary filter":"");
 if(more){more.hidden=!(limit<list.length||state.more);more.disabled=state.loading;more.textContent=state.loading?"FETCHING REVEALS…":"SHOW MORE REVEALED CARDS ↓"}
}
async function getPage(code,number,token){
 state.loading=true;state.error="";redrawCards();
 try{
  const response=await api("?set="+encodeURIComponent(code)+"&page="+number);
  if(token!==state.seq)return;
  state.cards.push(...(response.cards||[]));state.page=number;state.more=!!response.has_more;
  state.total=response.total_known||0;
  if(state.selected&&$("swKnownCount"))$("swKnownCount").textContent=String(state.total);
 }catch(e){if(token===state.seq){state.more=false;state.error=e.message||"Could not load preview cards."}}
 finally{if(token===state.seq){state.loading=false;redrawCards()}}
}
async function openSet(code,scroll=false){
 const found=state.sets.find(x=>x.code===code);if(!found)return;
 const token=++state.seq;
 state.selected=found;state.cards=[];state.page=0;state.more=false;state.shown=24;state.total=0;state.error="";
 reflectSelection();
 const title=$("swSelectedName"),info=$("swSelectedInfo"),grid=$("swCards");
 if(title)title.textContent=found.name;
 if(info)info.textContent=found.upcoming?"RELEASE: "+fmtDate(found.released_at)+" · Upcoming, cards shown before launch are previews.":"RELEASED: "+fmtDate(found.released_at)+" · Catch up on the indexed card list.";
 if($("swKnownCount"))$("swKnownCount").textContent="…";
 if(grid)grid.replaceChildren(el("p","sw-loading","Opening the case file…"));
 try{history.replaceState(null,"",location.pathname+"?set="+encodeURIComponent(code)+"#reveals")}catch{}
 if(scroll)document.getElementById("reveals")?.scrollIntoView({behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth",block:"start"});
 await getPage(code,1,token);
}
async function moreCards(){
 if(state.loading||!state.selected)return;
 const list=visibleCards();
 if(state.shown<list.length){state.shown+=24;redrawCards();return}
 if(state.more){const token=state.seq;state.shown+=24;await getPage(state.selected.code,state.page+1,token)}
}
function initHome(data){
 const dest=$("setWatchHome");if(!dest)return;
 dest.replaceChildren();
 const upcoming=(data.upcoming||[]).slice(0,3);
 if(!upcoming.length){dest.append(el("span","sw-loading","New set announcements will appear here automatically."));return}
 for(const s of upcoming){
  const a=el("a","",s.name+" · "+fmtDate(s.released_at));
  a.href="/set-watch.html?set="+encodeURIComponent(s.code)+"#reveals";
  dest.append(a);
 }
}
async function init(){
 try{
  const data=await api("");
  if(home)initHome(data);
  if(!page)return;
  state.sets=[...(data.upcoming||[]),...(data.recent||[])];
  showSets(data);
  const query=new URL(location.href).searchParams.get("set");
  const preferred=state.sets.find(s=>s.code===query)||data.upcoming?.find(s=>s.cards_indexed>0)||state.sets[0];
  if(preferred)await openSet(preferred.code);
  else{$("swCards").replaceChildren(el("p","sw-error","No sets available within the tracking window."))}
 }catch(e){
  if(home)$("setWatchHome").textContent="Set Watch is temporarily offline. Open the full release desk to retry.";
  if(page){$("swUpcoming").replaceChildren(el("p","sw-error",e.message));$("swRecent").replaceChildren();$("swCardStatus").textContent="Could not load current releases."}
 }
}
if(page){
 $("swLoadMore")?.addEventListener("click",moreCards);
 for(const b of document.querySelectorAll("[data-watch-filter]")){
  b.addEventListener("click",()=>{state.focus=b.dataset.watchFilter;state.shown=24;
   for(const btn of document.querySelectorAll("[data-watch-filter]")){const active=btn===b;btn.classList.toggle("is-active",active);btn.setAttribute("aria-pressed",String(active))}
   redrawCards();
  });
 }
}
if(home||page)init();
