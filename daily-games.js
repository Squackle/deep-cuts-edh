/* The two Deep Cuts EDH daily puzzles. Server owns the correct answers;
   localStorage only remembers anonymous play, never earns profile trophies. */
const $=id=>document.getElementById(id);
const game=document.body.dataset.dailyGame||"hub";
const gameNames={cold:"Cold Case",ladder:"Obscurity Ladder"};
let state=null,selected="",list=[],working=false,played=false;
const query=new URL(location.href).searchParams;
const practice=query.has("practice");
const seed=practice?Number(query.get("practice"))||1:0;
const storageKey=(name,day)=>"deepcuts:daily:"+name+":"+day+(practice?":p"+seed:"");
const el=(tag,cls,content)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;if(content!==undefined)n.textContent=String(content);
 return n;
};
const small=(value)=>el("span","games-muted",value);
function announce(message,bad=false){
 const host=$("gameMessage");if(!host)return;
 host.textContent=message;host.dataset.kind=bad?"error":"info";
}
function tryStorage(key){
 try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}
}
function saveStorage(key,data){
 try{localStorage.setItem(key,JSON.stringify(data))}catch{}
}
const encoded=x=>encodeURIComponent(x);
function image(name){
 const img=el("img","games-card-art");
 img.alt="Card art: "+name;img.loading="lazy";img.decoding="async";
 img.referrerPolicy="no-referrer";
 img.src="https://api.scryfall.com/cards/named?exact="+encoded(name)+"&format=image&version=art_crop";
 img.addEventListener("error",()=>{img.hidden=true;img.parentElement.classList.add("games-no-art")});
 return img;
}
function appendLink(host,title,url){
 const link=el("a","games-link",title);link.href=url;link.target="_blank";link.rel="noopener noreferrer";host.append(link);return link;
}
function fullUrl(){
 return location.origin+(game==="cold"?"/games/cold-case.html":"/games/obscurity-ladder.html");
}
async function request(method,action,params={}){
 let url=new URL("/api/daily-games",location.origin);
 const opts={method,credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}};
 // Match the Field Network's optional temporary login, not only its
 // 90-day HttpOnly device cookie. Never persist a new credential.
 let profileKey="";
 try{
  const candidate=sessionStorage.getItem("dc-profile-key")||localStorage.getItem("dc-profile-key")||"";
  if(/^dcprofile1_[a-f0-9]{32}_[a-f0-9]{64}$/.test(candidate))profileKey=candidate;
 }catch{}
 if(profileKey)opts.headers.Authorization="Bearer "+profileKey;
 if(method==="GET"){
  url.searchParams.set("action",action);
  for(const [key,value] of Object.entries(params)){
   url.searchParams.set(key,typeof value==="object"?JSON.stringify(value):String(value));
  }
 }else{
  opts.headers["Content-Type"]="application/json";
  opts.body=JSON.stringify({action,game,mode:practice?"practice":"daily",seed,day:state?.day,...params});
 }
 let r=await fetch(url,opts);
 // An expired old browser key must not mask a still-valid secure device cookie.
 // The first 401 cannot have completed a game move.
 if(r.status===401&&profileKey){
  delete opts.headers.Authorization;
  r=await fetch(url,opts);
 }
 let v;try{v=await r.json()}catch{throw Error("The puzzle server returned an unexpected response. Try refreshing.")}
 if(!r.ok)throw Error(v.error||"Couldn't reach today's game. Try again.");
 return v;
}
function panelStatus(status){
 const banner=$("gamesAccountStatus");if(!banner)return;
 if(status?.authenticated)banner.textContent="✓ Investigator signed in · daily scores and badges save to your profile";
 else banner.innerHTML='<a href="/community.html#account">Sign in to the Field Network</a> to save achievements. You can still play free without an account.';
}
function renderAwards(awards){
 const holder=$("gameAwards");if(!holder)return;
 holder.replaceChildren();
 if(!awards?.length)return;
 holder.append(el("h3","games-awards-title","Your investigation credentials"));
 for(const award of awards.slice(0,8)){
  const badge=el("span","games-achievement",award.title);badge.title=award.detail||"";holder.append(badge);
 }
}
async function loadGame(){
 working=true;const host=$("gameArea");
 if(host)host.replaceChildren(el("p","games-loading","Opening today's case files…"));
 announce("");
 try{
  const params={game,mode:practice?"practice":"daily",seed};
  let old=null;
  if(!practice){
   // Previous anonymous progress only affects what this browser sees.
   const day = dateChicago();
   old=tryStorage(storageKey(game,day));
  }else old=tryStorage(storageKey(game,"practice"));
  if(game==="cold"&&old?.attempts?.length)params.history=old.attempts;
  const data=await request("GET","state",params);
  state=data;
  if(game==="ladder"&&!data.authenticated&&old?.finished&&old.day===data.day){
   state={...data,...old,authenticated:false};
  }
  panelStatus(state);renderAwards(state.awards||[]);
  const label=$("dailyDateLabel");if(label)label.textContent=practice?"PRACTICE CASE · NO BADGES":"TODAY'S FILE · "+state.day+" (CENTRAL)";
  const counter=$("gamesProgress");if(counter){
   counter.textContent=game==="cold"?(state.finished?"CASE CLOSED":"GUESS "+Math.min(5,(state.attempts?.length||0)+1)+" OF 5"):
    state.finished?"VERDICT FILED":"SORT 5 COMMANDERS";
  }
  if(game==="cold")renderCold();else if(game==="ladder")renderLadder();
  await loadBoard();
 }catch(e){
  announce(e.message,true);
  if(host)host.replaceChildren(el("p","games-muted","Unable to load the daily case. Try again shortly."));
 }finally{working=false}
}
function dateChicago(){
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const find=k=>parts.find(p=>p.type===k)?.value||"";
 return find("year")+"-"+find("month")+"-"+find("day");
}
function shareText(){
 const name=gameNames[game],done=state.finished;
 if(!done)return "";
 const score=game==="cold"?(state.won?(state.attempts||[]).length+"/5":"X/5"):(state.score||0)+"/100";
 const icons=game==="cold"?(state.attempts||[]).map(n=>state.solution?.name===n?"🟩":"🟨").join(""):"🪜 "+Math.round((state.score||0)/10)+"/10";
 return "Deep Cuts EDH — "+name+"\n"+(practice?"PRACTICE · ":"")+state.day+" · "+score+"\n"+icons+"\n"+fullUrl();
}
function resultActions(){
 const footer=el("div","games-result-actions");
 const share=el("button","games-button games-button-primary","COPY SPOILER-FREE RESULT");
 share.type="button";share.addEventListener("click",async()=>{
  const value=shareText();
  try{
   await navigator.clipboard.writeText(value);
   announce("Copied! Share your result without revealing the answer.");
  }catch{
   const area=el("textarea","games-copy-fallback");area.value=value;
   footer.append(area);area.select();announce("Select and copy your result from the text box.");
  }
 });
 footer.append(share);
 const play=el("button","games-button games-button-quiet","TRY A PRACTICE PUZZLE ↗");
 play.type="button";play.addEventListener("click",startPractice);footer.append(play);
 const other=el("a","games-link",game==="cold"?"TRY OBSCURITY LADDER ↗":"TRY COLD CASE ↗");
 other.href=game==="cold"?"/games/obscurity-ladder.html":"/games/cold-case.html";footer.append(other);
 return footer;
}
function revealBadges(host){
 if(!state.newAwards?.length)return;
 const wrap=el("div","games-new-awards");
 wrap.append(el("h3","","🏆 New achievement unlocked!"));
 state.newAwards.forEach(a=>{
  const row=el("div","games-award-popup");
  row.append(el("strong","",a.title),el("p","",a.detail));
  wrap.append(row);
 });
 if(!state.authenticated)wrap.append(el("p","games-muted","Save your achievements by signing in."));
 host.append(wrap);
}
function renderCold(){
 const host=$("gameArea");host.replaceChildren();
 const archive=el("div","games-dossier-head");
 archive.append(el("span","games-file-id","CASE ID · "+state.day),el("span","games-incident","UNKNOWN COMMANDER"));
 host.append(archive);
 const board=el("ol","games-clue-list");
 for(let index=0;index<5;index++){
  const clue=state.clues?.[index],item=el("li","games-clue"+(clue?" games-clue-open":" games-clue-locked"));
  item.append(el("span","games-clue-number",String(index+1).padStart(2,"0")));
  const info=el("div","games-clue-info");
  info.append(el("strong","",clue?.label||"SEALED EVIDENCE"),
   el("p","",clue?.text||"Unseal after the next incorrect guess."));
  item.append(info);board.append(item);
 }
 host.append(board);
 if(state.attempts?.length){
  const previous=el("div","games-guess-history");
  previous.append(el("p","games-overline","YOUR EARLIER SUSPECTS"));
  for(const g of state.attempts)previous.append(el("span","games-guess-chip"+(g===state.solution?.name?" games-guess-right":""),g));
  host.append(previous);
 }
 if(state.finished){
  const result=el("section","games-reveal");
  result.append(el("p","games-overline",state.won?"✓ CASE SOLVED":"CASE CLOSED · ANSWER REVEALED"));
  result.append(el("h2","",state.solution.name));
  result.append(el("p","games-reveal-score",state.won?"Solved in "+state.attempts.length+" of 5 guesses · "+state.score+" points":"The commander evaded all five guesses."));
  const media=el("div","games-reveal-card");
  const art=el("div","games-art-frame");art.append(image(state.solution.name));
  media.append(art);
  const desc=el("div");desc.append(el("p","games-muted","Meet today's forgotten commander."));
  appendLink(desc,"VIEW CARD ON SCRYFALL ↗",state.solution.scryfall);
  appendLink(desc,"DISCOVER ITS EDHREC DECKS ↗",state.solution.edhrec);
  media.append(desc);result.append(media);
  result.append(resultActions());host.append(result);revealBadges(host);return;
 }
 const choose=el("section","games-choose-suspect");
 choose.append(el("h2","","Name your suspect"));
 choose.append(el("p","games-muted","Pick one commander. A wrong guess unseals the next clue."));
 const grid=el("div","games-suspect-grid");selected="";
 const tried=new Set(state.attempts||[]);
 for(const name of state.choices||[]){
  const option=el("button","games-suspect",name);option.type="button";
  if(tried.has(name)){
   option.disabled=true;option.classList.add("games-suspect-tried");
   option.title="Already questioned";
  }else option.addEventListener("click",()=>{
   selected=name;
   for(const b of grid.querySelectorAll("button"))b.setAttribute("aria-pressed",b===option?"true":"false");
   submit.disabled=false;submit.textContent="SUBMIT "+name.toUpperCase()+" ↗";
  });
  option.setAttribute("aria-pressed","false");grid.append(option);
 }
 choose.append(grid);
 const submit=el("button","games-button games-button-primary","SELECT A SUSPECT TO CONTINUE");
 submit.type="button";submit.disabled=true;
 submit.addEventListener("click",async()=>{
  if(!selected||working)return;working=true;submit.disabled=true;
  announce("Checking the evidence…");
  try{
   const previous=state.attempts||[];
   const r=await request("POST","guess",{guess:selected,history:previous});
   state={...state,...r};
   if(!state.authenticated)saveStorage(storageKey("cold",practice?"practice":state.day),{day:state.day,attempts:state.attempts});
   announce(state.won?"That's our suspect! Case closed.":state.finished?"All leads exhausted. The real suspect is revealed.":"Not quite. Another clue has been unsealed.");
   renderCold();if(state.finished)await loadBoard();
  }catch(e){announce(e.message,true);submit.disabled=false}
  finally{working=false}
 });
 choose.append(submit);host.append(choose);
}
function move(listIndex,change){
 const other=listIndex+change;
 if(other<0||other>=list.length)return;
 [list[listIndex],list[other]]=[list[other],list[listIndex]];
 renderLadder();const row=$("ladderRow"+other);
 row?.querySelector("button")?.focus();
}
function renderLadder(){
 const host=$("gameArea");host.replaceChildren();
 const intro=el("div","games-dossier-head");
 intro.append(el("span","games-file-id","EVIDENCE ORDER · "+state.day),el("span","games-incident","OBSCURITY LADDER"));
 host.append(intro);
 host.append(el("h2","","Least played → most played"));
 host.append(el("p","games-muted","Use ↑ and ↓ to move commanders. Put the fewest EDHREC-listed Commander decks at the top."));
 if(state.finished){
  const result=el("section","games-reveal");
  result.append(el("p","games-overline",state.won?"✓ PERFECT ORDER":"VERDICT DELIVERED"));
  result.append(el("h2","",state.score+"/100 POINTS"));
  result.append(el("p","games-muted",(state.correctPairs??Math.round(state.score/10))+" of 10 commander pairs in the right relative order. Deck counts are from the "+state.snapshot+" snapshot, not live rankings."));
  const ordered=el("ol","games-reveal-order");
  for(const c of state.solution||[]){
   const row=el("li","games-rank-reveal");
   const frame=el("span","games-small-art");frame.append(image(c.name));
   const text=el("div");text.append(el("strong","",c.name),el("span","games-muted",c.decks.toLocaleString()+" EDHREC decks"));
   row.append(frame,text);
   appendLink(row,"SOURCE ↗",c.edhrec);ordered.append(row);
  }
  result.append(ordered,resultActions());host.append(result);revealBadges(host);return;
 }
 if(!list.length)list=[...(state.cards||[])];
 const current=new Map((state.cards||[]).map(x=>[x.name,x]));
 list=list.filter(x=>current.has(x.name));
 if(list.length!==5)list=[...(state.cards||[])];
 const ordered=el("ol","games-ladder-list");
 for(let index=0;index<list.length;index++){
  const c=list[index],row=el("li","games-ladder-row");row.id="ladderRow"+index;
  const num=el("span","games-ladder-position",index===0?"LEAST":index===4?"MOST":String(index+1));
  const art=el("span","games-small-art");art.append(image(c.name));
  const desc=el("div","games-ladder-name");desc.append(el("strong","",c.name));
  desc.append(el("span","games-muted","Commander"));
  const controls=el("div","games-move-buttons");
  for(const [label,direction] of [["↑",-1],["↓",1]]){
   const btn=el("button","games-move",label);btn.type="button";
   btn.disabled=index+direction<0||index+direction>=list.length;
   btn.setAttribute("aria-label","Move "+c.name+(direction<0?" up":" down"));
   btn.addEventListener("click",()=>move(index,direction));controls.append(btn);
  }
  row.append(num,art,desc,controls);ordered.append(row);
 }
 host.append(ordered);
 const submit=el("button","games-button games-button-primary","FILE MY FINAL ORDER ↗");
 submit.type="button";submit.addEventListener("click",async()=>{
  if(working)return;working=true;submit.disabled=true;
  try{
   const r=await request("POST","submit",{order:list.map(x=>x.name)});
   state={...state,...r};
   if(!state.authenticated)saveStorage(storageKey("ladder",practice?"practice":state.day),state);
   announce(state.won?"Perfect line-up! You're a true investigator.":"Verdict filed. Check the official popularity order below.");
   renderLadder();await loadBoard();
  }catch(e){announce(e.message,true);submit.disabled=false}
  finally{working=false}
 });host.append(submit);
}
async function loadBoard(){
 const host=$("gamesLeaderboard");if(!host)return;
 if(practice){host.replaceChildren(el("p","games-muted","Practice scores do not appear on the daily board."));return}
 try{
  const result=await request("GET","board",{game});
  host.replaceChildren();
  if(!result.leaders?.length)return host.append(el("p","games-muted","Be the first signed-in investigator on today's board."));
  for(let i=0;i<result.leaders.length;i++){
   const entry=result.leaders[i],row=el("div","games-board-row");
   row.append(el("span","",String(i+1).padStart(2,"0")));
   const profile=el("a","", "@"+entry.handle);
   profile.href="/community.html?profile="+encoded(entry.handle);
   row.append(profile,el("strong","",String(entry.score)+" pts"));
   host.append(row);
  }
 }catch{host.replaceChildren(el("p","games-muted","The daily investigator board is temporarily unavailable."))}
}
function startPractice(){
 const rand=new Uint32Array(1);crypto.getRandomValues(rand);
 location.href=location.pathname+"?practice="+((rand[0]%999999998)+1);
}
function setupHub(){
 const status=$("hubDay");
 if(status)status.textContent="NEW PUZZLES EVERY DAY · MIDNIGHT CENTRAL";
 const buttons=document.querySelectorAll("[data-random-practice]");
 for(const button of buttons){
  button.addEventListener("click",()=>{
   const kind=button.dataset.randomPractice==="cold"?"cold-case":"obscurity-ladder";
   const n=new Uint32Array(1);crypto.getRandomValues(n);
   location.href="/games/"+kind+".html?practice="+(n[0]%999999998+1);
  });
 }
}
function setup(){
 if(game==="hub")return setupHub();
 $("newPractice")?.addEventListener("click",startPractice);
 if(practice){
  const back=$("dailyReturn");if(back){back.hidden=false;back.href=location.pathname}
  const message=$("practiceNote");if(message)message.hidden=false;
 }
 loadGame();
 // Refresh after midnight or another tab signs in/out.
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden&&state&&dateChicago()!==state.day&&!practice)loadGame();
 });
 window.addEventListener("deepcuts:profile-change",()=>{if(!working)loadGame()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
else setup();
