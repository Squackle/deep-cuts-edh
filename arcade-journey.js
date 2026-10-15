/* Deep Cuts Arcade journey: optional, device-only navigation and personal results.
 * Never a scoreboard source, never sends analytics, identities or local history. */
(()=>{"use strict";
 const KEY="deepcuts:arcade-journey:v1";
 const GAMES=Object.freeze({
  cold:{name:"Cold Case",slug:"cold-case",time:"2–5 min",level:"Beginner",unit:"guesses",max:5},
  ladder:{name:"Obscurity Ladder",slug:"obscurity-ladder",time:"3–5 min",level:"Intermediate",unit:"steps",max:1},
  cipher:{name:"Arcane Cipher",slug:"arcane-cipher",time:"2–6 min",level:"Beginner",unit:"guesses",max:6},
  board:{name:"Conspiracy Board",slug:"conspiracy-board",time:"4–8 min",level:"Intermediate",unit:"groups",max:4},
  hive:{name:"Hive Run",slug:"hive-run/",time:"5–15+ min",level:"Variable",unit:"",max:0}
 });
 const validDay=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
 const inRange=(x,max)=>Number.isFinite(Number(x))?Math.max(0,Math.min(max,Math.floor(Number(x)))):0;
 const centralDay=()=>{
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=k=>parts.find(p=>p.type===k)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day");
 };
 const pathFor=(game,mode,seed)=>{
  const p="/games/"+GAMES[game].slug;
  return mode==="practice"?p+"?practice="+seed:p;
 };
 const EMPTY=()=>({version:1,entries:{},results:[]});
 function load(){
  try{
   const data=JSON.parse(localStorage.getItem(KEY)||"null");
   if(!data||data.version!==1||typeof data.entries!=="object"||!Array.isArray(data.results))return EMPTY();
   // Treat stored content as untrusted: validate every identifier before display.
   const entries={};
   for(const [key,x] of Object.entries(data.entries).slice(0,160)){
    if(!x||!Object.hasOwn(GAMES,x.game)||x.game==="hive"||!["daily","practice"].includes(x.mode))continue;
    if(!validDay(x.day)||x.mode==="practice"&&(!Number.isInteger(x.seed)||x.seed<1||x.seed>999999999))continue;
    if(key!==identity(x.game,x.mode,x.day,x.seed))continue;
    if(!Number.isFinite(x.updated)||x.updated>Date.now()+86400000||Date.now()-x.updated>30*86400000)continue;
    entries[key]={game:x.game,mode:x.mode,day:x.day,seed:x.mode==="practice"?x.seed:0,
     progress:inRange(x.progress,8),finished:!!x.finished,updated:x.updated};
   }
   const results=data.results.filter(x=>x&&Object.hasOwn(GAMES,x.game)&&x.game!=="hive"&&["daily","practice"].includes(x.mode)&&
    validDay(x.day)&&typeof x.id==="string"&&x.id===identity(x.game,x.mode,x.day,x.seed)&&
    (x.mode==="daily"||(Number.isInteger(x.seed)&&x.seed>=1&&x.seed<=999999999))&&
    Number.isFinite(x.completedAt)&&x.completedAt<=Date.now()+86400000&&Date.now()-x.completedAt<180*86400000&&
    Number.isFinite(x.score)&&x.score>=0&&x.score<=100).slice(-80).map(x=>({
      id:x.id,game:x.game,mode:x.mode,day:x.day,seed:x.mode==="practice"?x.seed:0,score:inRange(x.score,100),completedAt:x.completedAt
    }));
   return {version:1,entries,results};
  }catch{return EMPTY()}
 }
 function save(data){try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}
 function identity(game,mode,day,seed){return mode==="practice"?game+":practice:"+seed:game+":daily:"+day}
 function make(tag,text,className){
  const n=document.createElement(tag);if(text!==undefined)n.textContent=text;
  if(className)n.className=className;return n;
 }
 function shortDay(mode){return mode==="daily"?"Daily":"Practice"}
 function resultsFor(data,game,mode){return data.results.filter(x=>x.game===game&&x.mode===mode).sort((a,b)=>a.completedAt-b.completedAt)}
 function recap(game,raw,data,id){
  if(!raw.finished)return;
  const root=document.querySelector(game==="cipher"||game==="board"?"#arcaneGame .arcane-reveal":"#gameArea .games-reveal");
  if(!root||root.querySelector(".arcade-personal-recap"))return;
  const track=resultsFor(data,game,raw.mode);
  const best=track.length?Math.max(...track.map(x=>x.score)):inRange(raw.score,100);
  const index=track.findIndex(x=>x.id===id);
  const prior=index>=0?track.slice(0,index).at(-1):track.at(-1);
  const section=make("section",undefined,"arcade-personal-recap");
  section.setAttribute("aria-label","Personal progress on this device");
  section.append(make("h3","YOUR PROGRESS","arcade-personal-title"));
  const grid=make("div",undefined,"arcade-personal-metrics");
  const current=make("div",undefined,"arcade-personal-metric");
  current.append(make("strong",inRange(raw.score,100)+" / 100"),make("span",shortDay(raw.mode)+" result"));
  const record=make("div",undefined,"arcade-personal-metric");
  record.append(make("strong",best+" / 100"),make("span",shortDay(raw.mode)+" personal best"));
  grid.append(current,record);section.append(grid);
  let comparison="First recorded "+shortDay(raw.mode).toLowerCase()+" finish on this browser.";
  if(prior){
   const change=inRange(raw.score,100)-prior.score;
   comparison=change>0?"Up "+change+" points from your previous "+shortDay(raw.mode).toLowerCase()+" result.":
    change<0?"Down "+Math.abs(change)+" points from your previous "+shortDay(raw.mode).toLowerCase()+" result.":
    "Matched your previous "+shortDay(raw.mode).toLowerCase()+" result.";
  }
  section.append(make("p",comparison,"arcade-personal-comparison"));
  section.append(make("small","Saved on this browser only · practice and daily results stay separate.","arcade-personal-note"));
  const actions=root.querySelector(".games-result-actions,.arcane-game-actions");
  if(actions)actions.before(section);else root.append(section);
 }
 function record(game,raw){
  if(!Object.hasOwn(GAMES,game)||game==="hive"||!raw||!validDay(raw.day))return;
  const mode=raw.mode==="practice"?"practice":"daily";
  const seed=mode==="practice"?Number(raw.seed):0;
  if(mode==="practice"&&(!Number.isInteger(seed)||seed<1||seed>999999999))return;
  const data=load(),id=identity(game,mode,raw.day,seed),old=data.entries[id];
  const previous=old?.progress||0,progress=inRange(raw.progress,8);
  const finished=!!raw.finished,now=Date.now();
  data.entries[id]={game,mode,day:raw.day,seed,finished,progress:Math.max(previous,progress),updated:now};
  if(finished&&!data.results.some(x=>x.id===id)&&Number.isFinite(Number(raw.score))){
   data.results.push({id,game,mode,day:raw.day,seed,score:inRange(raw.score,100),completedAt:now});
  }
  data.results=data.results.sort((a,b)=>a.completedAt-b.completedAt).slice(-80);
  const entries=Object.entries(data.entries).sort((a,b)=>b[1].updated-a[1].updated).slice(0,80);
  data.entries=Object.fromEntries(entries);
  save(data);
  recap(game,{...raw,mode},data,id);
 }
 function showContinue(){
  const host=document.querySelector(".games-masthead .games-page-links");
  if(!host||document.querySelector(".arcade-continue"))return;
  const today=centralDay(),time=Date.now();
  const options=Object.values(load().entries).filter(x=>!x.finished&&
   (x.mode==="practice"||x.day===today)&&time-x.updated<14*86400000);
  options.sort((a,b)=>b.updated-a.updated);
  const item=options[0];if(!item)return;
  const g=GAMES[item.game],context=item.mode==="practice"?"Practice round":"Today's puzzle";
  const wrap=make("div",undefined,"arcade-continue-wrap");
  const a=make("a","Continue last game ↗","arcade-continue arcade-continue-button");
  a.href=pathFor(item.game,item.mode,item.seed);
  a.setAttribute("aria-label","Continue last game: "+g.name+", "+context.toLowerCase());
  a.title="Return to "+g.name+" · "+context+(item.progress?" · "+item.progress+" recorded actions":"");
  const note=make("span",g.name+" · "+context,"arcade-continue-note");
  wrap.append(a,note);
  host.append(wrap);
 }
 function labelFor(game){
  const g=GAMES[game];if(!g)return null;
  const n=make("span","≈ "+g.time+" · "+g.level,"arcade-session-facts");
  n.title="Estimated session length and suggested difficulty; actual play time varies.";
  return n;
 }
 function showLabels(){
  for(const card of document.querySelectorAll(".games-hub-grid .games-feature")){
   const href=card.querySelector('a[href^="/games/"]')?.getAttribute("href")||"";
   const game=Object.keys(GAMES).find(k=>k!=="hive"&&href.includes(GAMES[k].slug));
   if(game&&!card.querySelector(".arcade-session-facts")){
    const label=labelFor(game),h=card.querySelector("h2");
    if(h&&label)h.after(label);
   }
  }
  const featured=document.querySelector(".games-hive-feature .games-game-meta");
  if(featured&&!featured.querySelector(".arcade-session-facts")){
   const x=labelFor("hive");x.classList.add("arcade-session-dark");featured.append(x);
  }
  const code=document.body.dataset.dailyGame||document.body.dataset.arcaneGame;
  if(code&&GAMES[code]&&code!=="hive"&&document.querySelector(".games-masthead .games-page-links")){
   const facts=labelFor(code);facts.classList.add("arcade-session-detail");
   document.querySelector(".games-masthead .games-page-links").append(facts);
  }
 }
 function init(){showLabels();if(document.body.dataset.dailyGame==="hub")showContinue()}
 window.DeepCutsArcade=Object.freeze({record});
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
