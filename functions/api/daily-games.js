/* Daily puzzles: immutable dated EDHREC counts, server-validated daily
 * achievements, optional anonymous play, and anti-repeat profile scores. */
import {send,fail,auth,body,originOK,quota,safe} from "../../src/community-core.js";
import {SNAPSHOT_DATE,todayChicago,previousDay} from "../../src/daily-games-data.js";
import {getPuzzle,getAutoStatus} from "../../src/automated-games.js";
const BADGES={
 case_closer:{title:"🕵️ Cold Case Closer",detail:"Solve your first Cold Case."},
 first_clue:{title:"🔍 First Clue Sleuth",detail:"Solve Cold Case on the first guess."},
 three_day_streak:{title:"🔥 Three-Day Trail",detail:"Solve Cold Case on three consecutive days."},
 case_archivist:{title:"📁 Case Archivist",detail:"Complete seven daily Cold Cases."},
 ladder_climber:{title:"🪜 Ladder Climber",detail:"Finish your first Obscurity Ladder."},
 perfect_ladder:{title:"🏆 Perfect Ladder",detail:"Place all five commanders in exactly the right order."},
 ladder_veteran:{title:"🏺 Obscurity Scholar",detail:"Complete seven daily Obscurity Ladders."},
 double_agent:{title:"⚡ Double Agent",detail:"Finish both daily games on the same day."}
};
const VALID_GAMES=new Set(["cold","ladder"]);
const MAX_COLD=5;
const photo=name=>"https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name)+"&format=image&version=art_crop";
const cardLink=name=>"https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"');
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const edhrec=x=>"https://edhrec.com/commanders/"+slug(x.name);
const compact=x=>({name:x.name,art:photo(x.name)});
const delta=(day,prev)=>previousDay(day)===prev;
const parseJSON=(str,fallback=[])=>{try{const v=JSON.parse(str);return Array.isArray(v)?v:fallback}catch{return fallback}};
function modeData(u){
 const game=u.searchParams.get("game")||"cold",mode=u.searchParams.get("mode")==="practice"?"practice":"daily";
 const seed=Number(u.searchParams.get("seed")||0);
 if(!VALID_GAMES.has(game)||!Number.isSafeInteger(seed)||seed<0||seed>999999999)return null;
 return {game,mode,seed,day:todayChicago()};
}
function resultCard(x,puzzle){
 return {name:x.name,art:photo(x.name),decks:x.decks??null,rank:x.rank??null,
  edhrec:edhrec(x),snapshot:puzzle?.snapshot||SNAPSHOT_DATE,scryfall:cardLink(x.name)};
}
async function runFor(db,profileId,game,day){
 return db.prepare("SELECT guesses,score,won,finished_at FROM daily_game_runs WHERE profile_id=? AND game=? AND day=?").bind(profileId,game,day).first();
}
async function awardsFor(db,id){
 const result=await db.prepare("SELECT badge,awarded_at FROM daily_game_achievements WHERE profile_id=? ORDER BY awarded_at DESC LIMIT 20").bind(id).all();
 return (result.results||[]).filter(row=>BADGES[row.badge]).map(row=>({id:row.badge,...BADGES[row.badge],awardedAt:row.awarded_at}));
}
async function award(db,id,badge){
 if(!BADGES[badge])return null;
 const r=await db.prepare("INSERT OR IGNORE INTO daily_game_achievements(profile_id,badge) VALUES(?,?)").bind(id,badge).run();
 return r.meta?.changes?{id:badge,...BADGES[badge]}:null;
}
async function checkAwards(db,id,game,day,score,won,attempts){
 const out=[],grant=async x=>{const r=await award(db,id,x);if(r)out.push(r)};
 if(game==="cold"){
  if(won)await grant("case_closer");
  if(won&&attempts===1)await grant("first_clue");
  const count=await db.prepare("SELECT COUNT(*) AS n FROM daily_game_runs WHERE profile_id=? AND game='cold' AND finished_at IS NOT NULL").bind(id).first();
  if(count?.n>=7)await grant("case_archivist");
  if(won){
   const r=await db.prepare("SELECT day FROM daily_game_runs WHERE profile_id=? AND game='cold' AND won=1 AND finished_at IS NOT NULL ORDER BY day DESC LIMIT 70").bind(id).all();
   const days=new Set((r.results||[]).map(x=>x.day));
   let cursor=day,streak=0;
   while(days.has(cursor)&&streak<70){streak++;cursor=previousDay(cursor)}
   if(streak>=3)await grant("three_day_streak");
  }
 }
 if(game==="ladder"){
  await grant("ladder_climber");
  if(score===100)await grant("perfect_ladder");
  const count=await db.prepare("SELECT COUNT(*) AS n FROM daily_game_runs WHERE profile_id=? AND game='ladder' AND finished_at IS NOT NULL").bind(id).first();
  if(count?.n>=7)await grant("ladder_veteran");
 }
 const both=await db.prepare("SELECT COUNT(DISTINCT game) AS n FROM daily_game_runs WHERE profile_id=? AND day=? AND finished_at IS NOT NULL").bind(id,day).first();
 if(both?.n===2)await grant("double_agent");
 return out;
}
function coldState(puzzle,attempts,finished=false){
 const list=Array.isArray(attempts)?attempts.filter(x=>typeof x==="string").slice(0,MAX_COLD):[];
 const right=list.includes(puzzle.answer.name),done=finished||right||list.length>=MAX_COLD;
 const result={game:"cold",choices:puzzle.choices,clues:puzzle.clues.slice(0,done?5:Math.min(MAX_COLD,list.length+1)),
  attempts:list,attemptsLeft:Math.max(0,MAX_COLD-list.length),finished:done,won:right,
  score:done&&right?Math.max(100,600-100*list.length):0};
 if(done)result.solution=resultCard(puzzle.answer,puzzle);
 return result;
}
function ladderState(puzzle,submitted=null){
 const rank=puzzle.metric==="rank";
 const data={game:"ladder",cards:puzzle.entries.map(compact),finished:!!submitted,
  metric:rank?"rank":"decks",snapshot:puzzle.snapshot||SNAPSHOT_DATE,
  sourceExplanation:puzzle.explanation||"EDHREC Commander deck counts from a dated, manually curated snapshot.",
  question:rank?
   "Arrange the legendary cards by their overall EDHREC card-usage rank, from the least to most popular. This is NOT commander deck count.":
   "Order these commanders from FEWEST to MOST EDHREC-listed Commander decks. This is a dated snapshot."};
 if(submitted){
  const byName=new Map(puzzle.entries.map(x=>[x.name,x]));
  const order=submitted.map(n=>byName.get(n));
  if(order.some(x=>!x))return data;
  let pairwise=0;
  for(let i=0;i<order.length;i++)for(let j=i+1;j<order.length;j++)if(rank?order[i].rank>order[j].rank:order[i].decks<order[j].decks)pairwise++;
  data.score=pairwise*10;
  data.won=pairwise===10;
  data.submitted=submitted;
  data.solution=puzzle.solution.map(x=>resultCard(x,puzzle));
  data.correctPairs=pairwise;
 }
 return data;
}
function normalizeHistory(history,options){
 if(!Array.isArray(history)||history.length>MAX_COLD)return [];
 const unique=new Set();
 for(const x of history){
  if(typeof x!=="string"||!options.includes(x)||unique.has(x))return [];
  unique.add(x);
 }
 return [...unique];
}
async function publicState(request,env,params){
 const a=await auth(request,env.DB);
 const puzzle=await getPuzzle(env.DB,params.game,params.day,params.mode,params.seed);
 const u=new URL(request.url);
 const saved=params.mode==="daily"&&a?await runFor(env.DB,a.id,params.game,params.day):null;
 let history=[];
 if(saved)history=parseJSON(saved.guesses);
 else if(!a||params.mode==="practice"){
  history=normalizeHistory(parseJSON(u.searchParams.get("history")),puzzle.choices||[]);
 }
 const state=params.game==="cold"?coldState(puzzle,history,!!saved?.finished_at):
  ladderState(puzzle,saved?.finished_at?parseJSON(saved.guesses):null);
 if(params.mode==="practice"&&params.game==="ladder")state.finished=false;
 if(saved?.finished_at){state.score=saved.score;state.won=!!saved.won}
 return {...state,day:params.day,mode:params.mode,seed:params.seed,authenticated:!!a,
  snapshot:puzzle.snapshot||SNAPSHOT_DATE,awards:a?await awardsFor(env.DB,a.id):[],
  note:"Daily results reset at midnight Central Time. Anonymous progress stays on your device."};
}
async function scoreboard(db,game,day){
 const r=await db.prepare("SELECT p.handle,g.score,g.won,g.finished_at FROM daily_game_runs g JOIN community_profiles p ON p.id=g.profile_id WHERE g.game=? AND g.day=? AND g.finished_at IS NOT NULL ORDER BY g.score DESC,g.finished_at ASC LIMIT 12").bind(game,day).all();
 const c=await db.prepare("SELECT COUNT(*) AS completions FROM daily_game_runs WHERE game=? AND day=? AND finished_at IS NOT NULL").bind(game,day).first();
 return {leaders:(r.results||[]).map(x=>({handle:x.handle,score:x.score,won:!!x.won})),completions:c?.completions||0};
}
export async function onRequestGet({request,env}){
 if(!env.DB)return fail("Daily games database unavailable.",503);
 try{
  const u=new URL(request.url),action=u.searchParams.get("action")||"state";
  if(action==="automation_status")return send(await getAutoStatus(env.DB,todayChicago()));
  if(action==="badges"){
   const handle=safe(u.searchParams.get("handle"),24);
   if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle))return fail("Invalid investigator.",400);
   const p=await env.DB.prepare("SELECT id FROM community_profiles WHERE handle=? COLLATE NOCASE").bind(handle).first();
   return p?send({badges:await awardsFor(env.DB,p.id)}):fail("Investigator not found.",404);
  }
  const params=modeData(u);
  if(!params)return fail("Choose Cold Case or Obscurity Ladder.",400);
  if(action==="board")return send({day:params.day,game:params.game,...await scoreboard(env.DB,params.game,params.day)});
  if(action!=="state")return fail("Unknown game request.",404);
  return send(await publicState(request,env,params));
 }catch(e){console.error("Daily game GET error",String(e?.name||"error"));return fail("Unable to open today's puzzle.",503)}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return fail("Daily games database unavailable.",503);
 if(!request.headers.get("Origin")||!originOK(request))return fail("Origin rejected.",403);
 let d;try{d=await body(request)}catch{return fail("Invalid game request.",400)}
 const game=String(d.game||""),mode=d.mode==="practice"?"practice":"daily",seed=Number(d.seed||0),day=todayChicago();
 if(!VALID_GAMES.has(game)||!Number.isSafeInteger(seed)||seed<0||seed>999999999||!["guess","submit"].includes(d.action))
  return fail("Invalid game selection.",400);
 if(mode==="daily"&&d.day!==day)return fail("The daily puzzle has changed. Refresh for today's case.",409);
 const a=await auth(request,env.DB);
 // Protect free, no-CAPTCHA gameplay from scripted abuse without requiring accounts.
 if(!await quota(env.DB,env,request,"daily-game",100,a||undefined))return fail("Too many requests today. Come back later.",429);
 try{
  const puzzle=await getPuzzle(env.DB,game,day,mode,seed);
  let run=null;
  if(a&&mode==="daily")run=await runFor(env.DB,a.id,game,day);
  if(run?.finished_at){
   const state=await publicState(request,env,{game,mode,day,seed});
   return send({...state,alreadySubmitted:true});
  }
  if(game==="cold"){
   if(d.action!=="guess"||!puzzle.choices.includes(d.guess))return fail("Choose one of the listed commanders.",400);
   const past=run?parseJSON(run.guesses):normalizeHistory(d.history,puzzle.choices);
   if(past.includes(puzzle.answer.name)||past.length>=MAX_COLD)return fail("Today's case is already closed.",409);
   if(past.includes(d.guess))return fail("You already questioned that suspect.",400);
   const next=[...past,d.guess],state=coldState(puzzle,next);
   const finished=state.finished,score=state.score,won=state.won;
   let fresh=[];
   if(a&&mode==="daily"){
    if(!run){
     await env.DB.prepare("INSERT OR IGNORE INTO daily_game_runs(profile_id,game,day) VALUES(?,'cold',?)").bind(a.id,day).run();
    }
    const old=run?run.guesses:"[]";
    const updated=await env.DB.prepare("UPDATE daily_game_runs SET guesses=?,score=?,won=?,finished_at=? WHERE profile_id=? AND game='cold' AND day=? AND guesses=? AND finished_at IS NULL")
     .bind(JSON.stringify(next),score,won?1:0,finished?Math.floor(Date.now()/1000):null,a.id,day,old).run();
    if(updated.meta?.changes!==1)return fail("Another game action just finished. Refresh the case.",409);
    if(finished)fresh=await checkAwards(env.DB,a.id,"cold",day,score,won,next.length);
   }
   return send({...state,day,mode,seed,authenticated:!!a,newAwards:fresh,snapshot:puzzle.snapshot||SNAPSHOT_DATE});
  }
  if(d.action!=="submit"||!Array.isArray(d.order)||d.order.length!==5)return fail("Arrange all five commanders.",400);
  const actual=puzzle.entries.map(x=>x.name);
  if(new Set(d.order).size!==5||d.order.some(x=>!actual.includes(x)))return fail("Your list must contain each displayed commander exactly once.",400);
  const state=ladderState(puzzle,d.order);
  let fresh=[];
  if(a&&mode==="daily"){
   const saved=await env.DB.prepare("INSERT OR IGNORE INTO daily_game_runs(profile_id,game,day,guesses,score,won,finished_at) VALUES(?,'ladder',?,?,?,?,?)")
    .bind(a.id,day,JSON.stringify(d.order),state.score,state.won?1:0,Math.floor(Date.now()/1000)).run();
   if(saved.meta?.changes!==1)return fail("Today's ladder has already been submitted. Refresh to see your result.",409);
   fresh=await checkAwards(env.DB,a.id,"ladder",day,state.score,state.won,1);
  }
  return send({...state,day,mode,seed,authenticated:!!a,newAwards:fresh});
 }catch(e){console.error("Daily game POST error",String(e?.name||"error"));return fail("Unable to save this game move. Please try again.",503)}
}
