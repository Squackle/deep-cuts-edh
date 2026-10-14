/* Arcane Cipher / Conspiracy Board. Text-only DOM construction: no raw card
   names in innerHTML and no input-controlled markup. */
(()=>{"use strict";
 const $=id=>document.getElementById(id);
 const game=document.body.dataset.arcaneGame;
 if(!["cipher","board"].includes(game))return;
 const query=new URL(location.href).searchParams,practice=query.has("practice");
 const seed=practice?Math.max(1,Math.min(999999999,Number(query.get("practice"))||1)):0;
 const name=game==="cipher"?"Arcane Cipher":"Conspiracy Board";
 let state=null,entry="",selected=new Set(),working=false,displayOrder=[];
 const node=(tag,cls="",text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e};
 const link=(name,url,cls="")=>{const a=node("a",cls,name);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a};
 const exactCard=name=>"https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"');
 const centralDay=()=>{const d=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const part=k=>d.find(p=>p.type===k)?.value||"";return part("year")+"-"+part("month")+"-"+part("day")};
 const memoryKey=day=>"deepcuts:arcane:"+game+":"+(practice?"practice:"+seed:day);
 const readLocal=day=>{try{const x=JSON.parse(localStorage.getItem(memoryKey(day))||"[]");return Array.isArray(x)?x:[]}catch{return []}};
 const writeLocal=(day,history)=>{try{localStorage.setItem(memoryKey(day),JSON.stringify(history))}catch{}};
 const status=(text,bad=false)=>{const e=$("arcaneMessage");e.textContent=text;e.dataset.kind=bad?"error":"info"};
 const setBusy=busy=>{working=busy;const t=$("arcaneGame");if(t)t.setAttribute("aria-busy",String(busy))};
 function profileKey(){try{const c=sessionStorage.getItem("dc-profile-key")||localStorage.getItem("dc-profile-key")||"";return /^dcprofile1_[a-f0-9]{32}_[a-f0-9]{64}$/.test(c)?c:""}catch{return ""}}
 async function request(method,action,data={}){
  const url=new URL("/api/arcane-games",location.origin),key=profileKey();
  const opts={method,credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}};
  if(key)opts.headers.Authorization="Bearer "+key;
  if(method==="GET"){url.searchParams.set("action",action);url.searchParams.set("game",game);url.searchParams.set("mode",practice?"practice":"daily");url.searchParams.set("seed",String(seed));
   for(const [k,v] of Object.entries(data))url.searchParams.set(k,typeof v==="string"?v:JSON.stringify(v));
  }else{opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify({action,game,mode:practice?"practice":"daily",seed,day:state?.day,...data})}
  let res=await fetch(url,opts);
  if(res.status===401&&key){delete opts.headers.Authorization;res=await fetch(url,opts)}
  let result;try{result=await res.json()}catch{throw Error("Puzzle server returned an unexpected response. Refresh and retry.")}
  if(!res.ok)throw Error(result.error||"The puzzle could not be reached.");
  return result;
 }
 function buildHistory(){return practice||!state?.authenticated?readLocal(state?.day||centralDay()):[]}
 function iconLegend(){
  const row=node("div","arcane-hint-legend");
  for(const [name,type] of [["Right spot","correct"],["Wrong spot","present"],["Not in word","absent"]]){
   const label=node("span");label.append(node("i","arcane-mini "+type),document.createTextNode(name));row.append(label);
  }
  return row;
 }
 function progress(current,total){
  const rail=node("div","arcane-progress-rail"),fill=node("span");fill.style.width=Math.min(100,Math.round(current/total*100))+"%";rail.append(fill);return rail;
 }
 function title(text,subtitle){
  const h=node("div","arcane-panel-heading");h.append(node("h2","",text),node("p","",subtitle));return h;
 }
 function cipherColorPriority(x){return x==="correct"?3:x==="present"?2:x==="absent"?1:0}
 function renderCipher(root){
  const length=Number(state.wordLength)||5,pattern=state.pattern||"_".repeat(length);
  root.append(title("THE LETTER ARCHIVE",length+" letters to uncover · six guesses."),progress(state.attempts,6));
  const board=node("div","arcane-word-grid");
  board.style.setProperty("--cipher-columns",String(pattern.length));
  board.setAttribute("aria-label","Six rows of "+length+"-letter guesses; punctuation is prefilled");
  const known=new Map();
  for(let i=0;i<6;i++){
   const row=node("div","arcane-word-row"),guess=state.guesses[i],letters=guess?guess.guess:(i===state.attempts&&!state.finished?entry:"");
   let letter=0;
   for(const symbol of pattern){
    if(symbol!=="_"){
     const mark=node("span","arcane-letter arcane-separator",symbol);
     mark.setAttribute("aria-label",symbol===" "?"space":symbol==="-"?"hyphen":"apostrophe");
     row.append(mark);continue;
    }
    const char=letters[letter]||"",grade=guess?.feedback[letter]||"",tile=node("span","arcane-letter"+(char?" filled":"")+(grade?" "+grade:""),char);
    tile.setAttribute("aria-label",guess?char+", "+(grade==="correct"?"correct position":grade==="present"?"wrong position":"not in answer"):char||"empty");
    row.append(tile);
    if(guess){const prior=known.get(char)||"";if(cipherColorPriority(grade)>cipherColorPriority(prior))known.set(char,grade);}
    letter++;
   }
   board.append(row);
  }
  root.append(board,iconLegend());
  if(!state.finished){
   const kb=node("div","arcane-keyboard");kb.setAttribute("aria-label","On-screen letter keyboard");
   for(const line of ["QWERTYUIOP","ASDFGHJKL","↵ZXCVBNM⌫"]){
    const r=node("div","arcane-key-row");
    const chars=line.startsWith("↵")?["ENTER",..."ZXCVBNM","BACKSPACE"]:[...line];
    for(const char of chars){
     const action=char==="ENTER"?"enter":char==="BACKSPACE"?"backspace":char;
     const key=node("button","arcane-key"+(char.length>1?" special":"")+(known.get(char)?" "+known.get(char):""),char==="BACKSPACE"?"⌫":char==="ENTER"?"ENTER":char);
     key.type="button";key.setAttribute("aria-label",char==="BACKSPACE"?"Delete last letter":char==="ENTER"?"Submit guess":char);
     key.addEventListener("click",()=>inputKey(action));r.append(key);
    }kb.append(r);
   }root.append(kb);
   const note=node("p","games-muted","Enter "+length+" letters with the onscreen or physical keyboard. Spaces, hyphens and apostrophes are filled in for you; any letter combination is accepted.");note.style.textAlign="center";root.append(note);
  }
  if(state.finished)root.append(reveal());
 }
 function solvedBlock(group,index){
  const section=node("div","arcane-solved-group");
  section.append(node("h3","",group.title),node("p","",group.description));
  const cards=node("div","arcane-solved-cards");
  for(const name of group.cards)cards.append(node("span","",name));
  section.append(cards);return section;
 }
 function renderBoard(root){
  root.append(title("THE CONNECTIONS BOARD","Choose four cards with one shared secret."));
  const counter=node("div","arcane-counter");counter.append(node("strong","",state.solved.length+" OF 4 CONNECTIONS"));
  const markers=node("div","arcane-attempts");markers.setAttribute("aria-label",state.remaining+" mistakes remaining");
  for(let i=0;i<4;i++)markers.append(node("span",i<state.remaining?"":"spent"));counter.append(markers);
  root.append(counter,progress(state.solved.length,4));
  if(state.solved.length){
   const completed=node("div","arcane-solved");
   state.solved.forEach((g,i)=>completed.append(solvedBlock(g,i)));root.append(completed);
  }
  const solvedNames=new Set(state.solved.flatMap(g=>g.cards));
  const remain=(displayOrder.length?displayOrder:state.tiles).filter(n=>!solvedNames.has(n));
  if(!state.finished){
   const grid=node("div","arcane-board-grid");grid.setAttribute("aria-label","Select four Magic card names that belong together");
   for(const card of remain){
    const item=node("div","arcane-card"+(selected.has(card)?" selected":""));
    const b=node("button","",card);b.type="button";b.setAttribute("aria-pressed",String(selected.has(card)));
    b.addEventListener("click",()=>toggleCard(card));
    const cardLink=link("VIEW CARD ↗",exactCard(card));
    cardLink.setAttribute("aria-label","View "+card+" on Scryfall (new tab)");
    item.append(b,cardLink);grid.append(item);
   }root.append(grid);
   const actions=node("div","arcane-game-actions");
   const send=node("button","arcane-action primary","SUBMIT GROUP · "+selected.size+"/4");send.type="button";send.disabled=selected.size!==4||working;
   send.addEventListener("click",submitBoard);actions.append(send);
   const shuffle=node("button","arcane-action secondary","SHUFFLE");shuffle.type="button";shuffle.addEventListener("click",()=>{
    const list=[...remain];for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
    displayOrder=[...state.tiles.filter(n=>solvedNames.has(n)),...list];render();
   });actions.append(shuffle);
   const clear=node("button","arcane-action secondary","CLEAR");clear.type="button";clear.disabled=!selected.size;
   clear.addEventListener("click",()=>{selected.clear();render()});actions.append(clear);root.append(actions);
   root.append(node("p","games-muted","Mistakes remaining: "+state.remaining+". Card links open separately and do not select a tile."));
  }else{if(!state.won&&state.answerGroups){
   const lost=node("div","arcane-solved");
   lost.append(node("p","games-muted","The undiscovered connections:"));
   state.answerGroups.filter(g=>!state.solved.some(s=>s.title===g.title)).forEach((g,i)=>lost.append(solvedBlock(g,i)));
   root.append(lost);
  }root.append(reveal());}
 }
 function reveal(){
  const section=node("section","arcane-reveal");
  section.append(node("span","arcane-seal",state.won?"✓ CASE CLEARED":"CASE FILE CLOSED"));
  if(game==="cipher"){
   section.append(node("h3","",state.answer?.word||"Cipher closed"));
   section.append(node("div","arcane-result-score",state.score+" / 100 POINTS"));
   section.append(node("p","",state.answer?.definition||""));
   if(state.answer?.scryfall)section.append(link(state.answer.isCreatureType?"BROWSE "+state.answer.word+" CREATURES ON SCRYFALL ↗":"EXPLORE "+state.answer.example.toUpperCase()+" ON SCRYFALL ↗",state.answer.scryfall));
  }else{
   section.append(node("h3","",state.won?"All four connections found!":"The evidence is complete."));
   section.append(node("div","arcane-result-score",state.score+" / 100 POINTS"));
   section.append(node("p","",state.won?"Solved in "+state.attempts+" group selections with "+state.mistakes+" mistake"+(state.mistakes===1?"":"s")+".":"You discovered "+state.solved.length+" of four connections before your fourth mistake."));
  }
  const actions=node("div","arcane-game-actions");
  const copy=node("button","arcane-copy","COPY SPOILER-FREE RESULT ↗");copy.type="button";copy.addEventListener("click",share);actions.append(copy);
  const other=node("a","arcane-action secondary",game==="cipher"?"TRY CONSPIRACY BOARD ↗":"TRY ARCANE CIPHER ↗");
  other.href=game==="cipher"?"/games/conspiracy-board.html":"/games/arcane-cipher.html";actions.append(other);
  section.append(actions);return section;
 }
 function render(){
  if(!state)return;
  const host=$("arcaneGame");host.replaceChildren();
  if(game==="cipher")renderCipher(host);else renderBoard(host);
  $("arcaneDay").textContent=(practice?"PRACTICE CASE":"TODAY'S FILE")+" · "+state.day+" CENTRAL";
  $("arcaneProgress").textContent=state.finished?"CASE COMPLETE":game==="cipher"?"GUESS "+(state.attempts+1)+" / 6":"GROUPS "+state.solved.length+" / 4";
  const banner=$("arcaneAccount");
  if(practice)banner.textContent="PRACTICE · No scores, badges, or leaderboard entries are saved.";
  else if(state.authenticated)banner.textContent="✓ Investigator signed in · daily scores and badges saved to your profile";
  else {banner.replaceChildren();banner.append(link("Sign in to your profile","/profile#account"),document.createTextNode(" to save daily scores and trophies. Playing without an account is free."));banner.querySelector("a").target="_self";}
  const awards=$("arcaneAwards");awards.replaceChildren();
  if(state.newBadges?.length)for(const b of state.newBadges){const wrap=node("div","arcane-new-badge");wrap.append(node("strong","",b.title),node("span","",b.detail));awards.append(wrap);}
  if(state.finished){const existing=state.badges||[];if(existing.length){const wrap=node("div","arcane-new-badge");wrap.append(node("strong","","Your investigator trophies"));wrap.append(node("span","",existing.map(x=>x.title).join(" · ")));awards.append(wrap)}}
 }
 function inputKey(key){
  if(working||!state||state.finished||game!=="cipher")return;
  if(key==="enter"){submitCipher();return}
  if(key==="backspace")entry=entry.slice(0,-1);
  else if(/^[A-Za-z]$/.test(key)&&entry.length<(state.wordLength||5))entry+=key.toUpperCase();
  else return;
  status("");render();
 }
 function toggleCard(card){
  if(working||state?.finished||game!=="board")return;
  if(selected.has(card))selected.delete(card);
  else if(selected.size<4)selected.add(card);
  else {status("Four cards maximum. Submit or deselect one first.",true);return}
  status("");render();
 }
 async function move(action,payload){
  if(working||!state||state.finished)return;setBusy(true);
  try{
   const before=buildHistory();
   const updated=await request("POST",action,{...payload,...((practice||!state.authenticated)?{history:before}:{})});
   state={...state,...updated};
   if(practice||!state.authenticated)writeLocal(state.day,[...before,game==="cipher"?payload.guess:payload.cards]);
   selected.clear();entry="";render();
   if(state.finished){status(state.won?"Case solved. Outstanding investigation!":"Case closed. Review the revealed answer below.");loadLeaderboard();}
   else if(game==="board")status(state.oneAway?"One away! Three of those cards share an unsolved connection.":state.solved.length?"Correct group filed. Keep investigating.":"Not quite. Review the four cards and try again.",!state.oneAway&&state.remaining<4);
   else status("Guess recorded. The next line is ready.");
  }catch(e){status(e.message,true);if(/another tab|already finished|changed|submitted/i.test(e.message))load();}
  finally{setBusy(false)}
 }
 function submitCipher(){
  if(entry.length!==(state?.wordLength||5)){status("Enter exactly "+(state?.wordLength||5)+" letters before submitting.",true);return}
  if(state?.guesses?.some(g=>g.guess===entry)){status("You have already tried that word.",true);return}
  move("guess",{guess:entry});
 }
 function submitBoard(){
  if(selected.size!==4){status("Select exactly four cards.",true);return}
  move("group",{cards:[...selected]});
 }
 async function loadLeaderboard(){
  if(practice){$("arcaneBoard").replaceChildren(node("p","games-muted","Practice mode has no leaderboard."));return;}
  const host=$("arcaneBoard");
  try{
   const data=await request("GET","board");host.replaceChildren();
   if(!data.leaders?.length){host.append(node("p","games-muted","Be the first investigator to file a completed case today."));return}
   data.leaders.forEach((r,i)=>{const row=node("div","arcane-leader-row");
    row.append(node("span","",String(i+1).padStart(2,"0")+" · "+r.handle),node("strong","",r.score+" PTS"));host.append(row)});
  }catch{host.replaceChildren(node("p","games-muted","Investigator board is temporarily unavailable."))}
 }
 async function load(){
  if(working)return;
  setBusy(true);status("");
  const host=$("arcaneGame");host.replaceChildren(node("p","games-loading","Unsealing today's puzzle…"));
  try{
   const history=(practice||!profileKey())?readLocal(centralDay()):[];
   const data=await request("GET","state",{history});
   state=data;entry="";selected.clear();displayOrder=[...(data.tiles||[])];render();
   setBusy(false); // The puzzle is playable even if leaderboard retrieval is slow.
   await loadLeaderboard();
  }catch(e){status(e.message,true);host.replaceChildren(node("p","games-muted","The case cannot be opened yet. Please try again shortly."))}
  finally{setBusy(false)}
 }
 function share(){
  if(!state?.finished)return;
  const marks=game==="cipher"?state.guesses.map(g=>g.feedback.map(x=>x==="correct"?"🟩":x==="present"?"🟨":"⬛").join("")).join("\n"):
   "🧩 "+state.solved.length+"/4 groups · "+state.mistakes+" mistakes";
  const score=state.won?state.score+"/100":"X/100";
  const url=location.origin+(game==="cipher"?"/games/arcane-cipher.html":"/games/conspiracy-board.html");
  const text=name+" · "+state.day+"\n"+(practice?"PRACTICE · ":"")+score+"\n"+marks+"\n"+url;
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>status("Spoiler-free result copied.")).catch(()=>copyFallback(text));
  else copyFallback(text);
 }
 function copyFallback(text){
  const area=node("textarea");area.value=text;area.style.width="100%";area.rows=5;$("arcaneAwards").replaceChildren(area);area.select();status("Select and copy the result shown below.");
 }
 function beginPractice(){
  let n;try{const x=new Uint32Array(1);crypto.getRandomValues(x);n=(x[0]%999999998)+1}catch{n=(Math.floor(Math.random()*999999998)+1)}
  location.href=location.pathname+"?practice="+n;
 }
 function setup(){
  $("arcanePractice").addEventListener("click",beginPractice);
  if(practice){$("arcaneReturn").hidden=false;$("arcanePracticeNote").hidden=false;}
  window.addEventListener("keydown",e=>{
   if(game!=="cipher"||!state||state.finished||e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA|SELECT|BUTTON|A/.test(e.target?.tagName||""))return;
   if(e.key==="Enter"){e.preventDefault();inputKey("enter")}
   else if(e.key==="Backspace"){e.preventDefault();inputKey("backspace")}
   else if(/^[A-Za-z]$/.test(e.key)){e.preventDefault();inputKey(e.key)}
  });
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&!practice&&state&&centralDay()!==state.day)load()});
  window.addEventListener("deepcuts:profile-change",()=>{if(!practice&&!working)load()});
  load();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});else setup();
})();
