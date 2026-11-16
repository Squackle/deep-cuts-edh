/* Arcane Cipher + Conspiracy Board. The server alone validates and scores
   daily moves, stores authenticated progress, and freezes dated puzzles. */
import {send,fail,auth,body,originOK,quota,safe} from "../../src/community-core.js";
import {buildArcanePuzzle,cipherFeedback,cipherLetters,cipherPattern,gameHash,gameShuffle,boardMatch,boardOneAway,chicagoDate,nextBoardPracticeSeed,BOARD_CATEGORIES} from "../../src/arcane-game-data.js";
const GAMES=new Set(["cipher","board"]);
export const ARCANE_BADGES={
 cipher_solved:{title:"🔐 Cipher Breaker",detail:"Solve a daily Arcane Cipher."},
 cipher_perfect:{title:"✨ First-Try Cipher",detail:"Solve Arcane Cipher on the first guess."},
 board_solved:{title:"🧩 Conspiracy Cracker",detail:"Solve a daily Conspiracy Board."},
 board_perfect:{title:"🎯 Flawless Connections",detail:"Solve Conspiracy Board with no mistakes."},
 arcane_duo:{title:"🏛️ Double Dossier",detail:"Complete both new daily mysteries on one day."}
};
const validSeed=n=>Number.isSafeInteger(n)&&n>=0&&n<=999999999;
const normalizeMode=x=>x==="practice"?"practice":"daily";
const exactCardUrl=name=>"https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"');
const parseHistory=s=>{try{const x=typeof s==="string"?JSON.parse(s):s;return Array.isArray(x)?x:null}catch{return null}};
function normalizeGame(u){
 const game=u.searchParams.get("game"),mode=normalizeMode(u.searchParams.get("mode"));
 const seed=Number(u.searchParams.get("seed")||0);
 if(!GAMES.has(game)||!validSeed(seed))return null;
 return {game,mode,seed,day:chicagoDate()};
}
async function puzzleFor(db,params){
 const {game,mode,seed,day}=params;
 if(mode==="practice")return buildArcanePuzzle(game,"practice",mode,seed); // Stable for this seed across dates and sessions.
 const existing=await db.prepare("SELECT payload FROM daily_arcane_puzzles WHERE game=? AND day=?").bind(game,day).first();
 if(existing?.payload){
  const frozen=JSON.parse(existing.payload);
  // One-time editorial replacement for Oct 22 only. Old puzzles are otherwise
  // immutable. Never reset any signed-in run, score or badge: replacement is
  // atomic and is rejected if even an unstarted run already exists.
  if(game==="board"&&day==="2026-10-22"&&frozen.edition==="hand-curated-v1"){
   const fresh=buildArcanePuzzle(game,day);
   await db.prepare("UPDATE daily_arcane_puzzles SET payload=? WHERE game=? AND day=? AND json_extract(payload,'$.edition')='hand-curated-v1' AND NOT EXISTS (SELECT 1 FROM daily_arcane_runs WHERE game=? AND day=?)")
    .bind(JSON.stringify(fresh),game,day,game,day).run();
   const selected=await db.prepare("SELECT payload FROM daily_arcane_puzzles WHERE game=? AND day=?").bind(game,day).first();
   if(!selected?.payload)throw Error("Daily puzzle snapshot unavailable");
   return JSON.parse(selected.payload);
  }
  return frozen;
 }
 const chosen=buildArcanePuzzle(game,day);
 await db.prepare("INSERT OR IGNORE INTO daily_arcane_puzzles(game,day,payload) VALUES(?,?,?)").bind(game,day,JSON.stringify(chosen)).run();
 const frozen=await db.prepare("SELECT payload FROM daily_arcane_puzzles WHERE game=? AND day=?").bind(game,day).first();
 if(!frozen?.payload)throw Error("Puzzle snapshot unavailable");
 return JSON.parse(frozen.payload);
}
// Hints are recorded as a server-validated turn, never as caller-supplied
// positions or letters. Replaying the same history reconstructs the reveal.
const HINT_TURN="!HINT";
const maxHints=2;
const hintSize=length=>length<=5?1:length<=9?2:3;
function cipherState(puzzle,history){
 const target=cipherLetters(puzzle.word),wordLength=target.length;
 const pattern=cipherPattern(puzzle.word);
 const guesses=[],seen=new Set(),knownPositions=new Set(),hintPositions=new Set();
 let hintCount=0,won=false;
 if(!Array.isArray(history)||history.length>6||wordLength<2||wordLength>24)return null;
 const priority=gameShuffle(Array.from({length:wordLength},(_,i)=>i),gameHash("cipher-hints-v1:"+puzzle.word));
 for(const raw of history){
  if(won)return null;
  if(raw===HINT_TURN){
   // A hint must leave a playable guess and reveal at least one new tile.
   if(hintCount>=maxHints||guesses.length>=5)return null;
   const fresh=priority.filter(i=>!knownPositions.has(i)).slice(0,hintSize(wordLength));
   if(!fresh.length)return null;
   for(const index of fresh){knownPositions.add(index);hintPositions.add(index);}
   hintCount++;
   guesses.push({hint:true,guess:"",feedback:Array(wordLength).fill(""),revealed:fresh,
    locked:[...hintPositions].sort((a,b)=>a-b)});
   continue;
  }
  if(typeof raw!=="string"||!/^[A-Z]+$/.test(raw)||raw.length!==wordLength||
     seen.has(raw))return null;
  if([...hintPositions].some(i=>raw[i]!==target[i]))return null;
  seen.add(raw);
  const feedback=cipherFeedback(raw,target);
  feedback.forEach((color,i)=>{if(color==="correct")knownPositions.add(i)});
  guesses.push({guess:raw,feedback,locked:[...hintPositions].sort((a,b)=>a-b)});
  if(raw===target)won=true;
 }
 const finished=won||guesses.length===6;
 const hintLetters=[...hintPositions].sort((a,b)=>a-b).map(index=>({index,letter:target[index]}));
 const hintAvailable=!finished&&hintCount<maxHints&&guesses.length<5&&knownPositions.size<wordLength;
 const score=finished&&won?100-(guesses.length-1)*15:0;
 return {game:"cipher",wordLength,pattern,guesses,attempts:guesses.length,
  attemptsLeft:6-guesses.length,hintCount,maxHints,hintLetters,
  hintRevealCount:hintAvailable?Math.min(hintSize(wordLength),wordLength-knownPositions.size):0,
  hintAvailable,assisted:hintCount>0,won,finished,score,
  ...(finished?{answer:{word:puzzle.word,definition:puzzle.definition,
   ...(String(puzzle.edition).startsWith("creature-types-")?{isCreatureType:true,scryfall:"https://scryfall.com/search?q="+encodeURIComponent('t:creature t:"'+puzzle.word+'"')}
    :{example:puzzle.example,scryfall:exactCardUrl(puzzle.example)})}}:{})};
}

function boardState(puzzle,history){
 if(!Array.isArray(history)||history.length>8)return null;
 const solved=[],attempts=[],attemptKeys=new Set();let mistakes=0,lastOneAway=false;
 for(const four of history){
  if(!Array.isArray(four)||four.length!==4||four.some(x=>typeof x!=="string")||new Set(four).size!==4||four.some(x=>!puzzle.tiles.includes(x)))return null;
  if(mistakes>=4||solved.length>=4||four.some(x=>solved.some(group=>group.cards.includes(x))))return null;
  const key=[...four].sort().join("|");
  if(attemptKeys.has(key))return null;
  attemptKeys.add(key);
  const match=boardMatch(puzzle,four);
  if(match){
   if(solved.some(g=>g.title===match.title))return null;
   solved.push(match);lastOneAway=false;
  }else{mistakes++;lastOneAway=boardOneAway(puzzle,four,solved.map(g=>g.title));}
  attempts.push(four);
 }
 const won=solved.length===4,finished=won||mistakes===4;
 const score=finished?(won?100-mistakes*15:Math.max(0,solved.length*20-mistakes*5)):0;
 return {game:"board",tiles:puzzle.tiles,solved:solved.map((g,i)=>({...g,color:i%4})),
  mistakes,remaining:4-mistakes,attempts:attempts.length,finished,won,score,oneAway:lastOneAway&&!finished,
  ...(finished?{answerGroups:puzzle.groups}:{})};
}
const stateFor=(puzzle,game,history)=>game==="cipher"?cipherState(puzzle,history):boardState(puzzle,history);
async function runFor(db,id,game,day){return db.prepare("SELECT progress,score,won,finished_at FROM daily_arcane_runs WHERE profile_id=? AND game=? AND day=?").bind(id,game,day).first();}
async function profileBadges(db,id){
 const r=await db.prepare("SELECT badge,awarded_at FROM daily_arcane_badges WHERE profile_id=? ORDER BY awarded_at DESC").bind(id).all();
 return (r.results||[]).filter(x=>ARCANE_BADGES[x.badge]).map(x=>({id:x.badge,...ARCANE_BADGES[x.badge],awardedAt:x.awarded_at}));
}
async function grantBadges(db,profileId,game,day,state){
 if(!state.finished)return [];
 const toGrant=[];
 if(game==="cipher"&&state.won)toGrant.push("cipher_solved");
 if(game==="cipher"&&state.won&&!state.assisted&&state.attempts===1)toGrant.push("cipher_perfect");
 if(game==="board"&&state.won)toGrant.push("board_solved");
 if(game==="board"&&state.won&&state.mistakes===0)toGrant.push("board_perfect");
 const both=await db.prepare("SELECT COUNT(DISTINCT game) AS n FROM daily_arcane_runs WHERE profile_id=? AND day=? AND finished_at IS NOT NULL").bind(profileId,day).first();
 if(Number(both?.n)===2)toGrant.push("arcane_duo");
 const results=[];
 for(const badge of toGrant){
  const r=await db.prepare("INSERT OR IGNORE INTO daily_arcane_badges(profile_id,badge) VALUES(?,?)").bind(profileId,badge).run();
  if(r.meta?.changes)results.push({id:badge,...ARCANE_BADGES[badge]});
 }
 return results;
}
async function loadState(request,env,p,historyOverride=null){
 const a=await auth(request,env.DB);
 const puzzle=await puzzleFor(env.DB,p);
 const run=a&&p.mode==="daily"?await runFor(env.DB,a.id,p.game,p.day):null;
 const history=a&&p.mode==="daily"?(run?parseHistory(run.progress):[]):(historyOverride??[]);
 const state=stateFor(puzzle,p.game,history);
 if(!state)return null; // Invalid guest/practice history is a bad request, not an outage.
 return {...state,day:p.day,mode:p.mode,seed:p.seed,authenticated:!!a,
  ...(a?{badges:await profileBadges(env.DB,a.id)}:{badges:[]})};
}
export async function onRequestGet({request,env}){
 if(!env.DB)return fail("Game storage is not available.",503);
 try{
  const url=new URL(request.url),action=url.searchParams.get("action")||"state";
  if(action==="badges"){
   const handle=safe(url.searchParams.get("handle"),24);
   if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle))return fail("Invalid investigator handle.");
   const profile=await env.DB.prepare("SELECT id FROM community_profiles WHERE handle=? COLLATE NOCASE").bind(handle).first();
   if(!profile)return fail("Investigator not found.",404);
   return send({badges:await profileBadges(env.DB,profile.id)});
  }
  const p=normalizeGame(url);if(!p)return fail("Unknown daily game.",400);
  if(action==="new-practice"){
   if(p.game!=="board")return fail("Practice selection unavailable for this game.",400);
   let previous=[];
   try{previous=JSON.parse(url.searchParams.get("previousTiles")||"[]")}catch{return fail("Invalid previous practice tiles.",400)}
   const catalog=new Set(BOARD_CATEGORIES.flatMap(group=>group[2]));
   if(!Array.isArray(previous)||!(previous.length===0||previous.length===16)||
    previous.some(name=>typeof name!=="string"||!catalog.has(name))||
    new Set(previous).size!==previous.length)return fail("Invalid previous practice tiles.",400);
   const priorSeed=p.mode==="practice"?p.seed:0;
   return send({game:"board",mode:"practice",seed:nextBoardPracticeSeed(previous,priorSeed)});
  }
  if(action==="board"){
   const r=await env.DB.prepare("SELECT p.handle,r.score,r.won,r.finished_at,r.progress FROM daily_arcane_runs r JOIN community_profiles p ON p.id=r.profile_id WHERE r.game=? AND r.day=? AND r.finished_at IS NOT NULL ORDER BY r.score DESC,r.finished_at ASC LIMIT 12").bind(p.game,p.day).all();
   return send({game:p.game,day:p.day,leaders:(r.results||[]).map(({progress,...row})=>({
    ...row,assisted:p.game==="cipher"&&(parseHistory(progress)||[]).includes(HINT_TURN)
   }))});
  }
  if(action!=="state")return fail("Unknown game action.",404);
  const history=parseHistory(url.searchParams.get("history")||"[]");
  if(!history)return fail("Invalid game history.",400);
  // Anonymous browser history is non-authoritative and never produces awards.
  const data=await loadState(request,env,p,history);
  if(!data)return fail("Invalid game history.",400);
  // Ignore caller-provided history for signed-in daily play.
  if(!data.authenticated&&history.length){
   const puzzle=await puzzleFor(env.DB,p),state=stateFor(puzzle,p.game,history);
   if(!state)return fail("Invalid game history.",400);
   return send({...data,...state});
  }
  return send(data);
 }catch(e){console.error("Arcane game GET:",String(e?.name||"error"));return fail("Could not load today's puzzle.",503)}
}
export async function onRequestPost({request,env}){
 if(!env.DB)return fail("Game storage is not available.",503);
 if(!request.headers.get("Origin")||!originOK(request))return fail("Origin not allowed.",403);
 let d;try{d=await body(request)}catch{return fail("Invalid game request.",400)}
 const game=String(d.game||""),mode=normalizeMode(d.mode),day=chicagoDate(),seed=Number(d.seed||0);
 if(!GAMES.has(game)||!validSeed(seed))return fail("Unknown daily game.",400);
 if(mode==="daily"&&d.day!==day)return fail("The daily puzzle has changed. Refresh to continue.",409);
 if(!["guess","hint","group"].includes(d.action)||(game==="cipher"&&!["guess","hint"].includes(d.action))||(game==="board"&&d.action!=="group"))return fail("Unsupported move.",400);
 const a=await auth(request,env.DB),p={game,mode,seed,day};
 if(!await quota(env.DB,env,request,"arcane-"+game,120,a||undefined))return fail("Daily request limit reached. Try again tomorrow.",429);
 try{
  const puzzle=await puzzleFor(env.DB,p);
  let run=a&&mode==="daily"?await runFor(env.DB,a.id,game,day):null;
  if(run?.finished_at){
   const existing=stateFor(puzzle,game,parseHistory(run.progress));
   return send({...existing,game,day,mode,seed,authenticated:true,alreadySubmitted:true,badges:await profileBadges(env.DB,a.id)});
  }
  // Signed-in daily play trusts only stored progress, including on the first move.
  // An unstarted daily run always begins empty; never seed it from client history.
  const prior=a&&mode==="daily"?(run?parseHistory(run.progress):[]):parseHistory(d.history||[]);
  if(!prior)return fail("Invalid move history.",400);
  const before=stateFor(puzzle,game,prior);
  if(!before||before.finished)return fail("This game is already finished.",409);
  if(game==="cipher"&&d.action==="hint"&&!before.hintAvailable)return fail("No hints available for this puzzle.",400);
  const move=game==="cipher"?(d.action==="hint"?HINT_TURN:String(d.guess||"").trim().toUpperCase()):d.cards;
  if(game==="cipher"&&d.action==="guess"&&(!/^[A-Z]+$/.test(move)||move.length!==cipherLetters(puzzle.word).length))return fail("Enter exactly "+cipherLetters(puzzle.word).length+" letters.",400);
  if(game==="board"&&(!Array.isArray(move)||move.length!==4||new Set(move).size!==4))return fail("Select exactly four different cards.",400);
  const next=[...prior,move],state=stateFor(puzzle,game,next);
  if(!state)return fail(game==="cipher"?"That guess has already been used.":"That group was already tried or includes solved cards.",400);
  let newBadges=[];
  if(a&&mode==="daily"){
   await env.DB.prepare("INSERT OR IGNORE INTO daily_arcane_runs(profile_id,game,day) VALUES(?,?,?)").bind(a.id,game,day).run();
   const old=run?.progress||"[]",now=state.finished?Math.floor(Date.now()/1000):null;
   const saved=await env.DB.prepare("UPDATE daily_arcane_runs SET progress=?,score=?,won=?,finished_at=?,updated_at=unixepoch() WHERE profile_id=? AND game=? AND day=? AND progress=? AND finished_at IS NULL")
    .bind(JSON.stringify(next),state.score,state.won?1:0,now,a.id,game,day,old).run();
   if(saved.meta?.changes!==1)return fail("This puzzle changed in another tab. Refresh it to continue.",409);
   if(state.finished)newBadges=await grantBadges(env.DB,a.id,game,day,state);
  }
  return send({...state,day,mode,seed,authenticated:!!a,newBadges});
 }catch(e){console.error("Arcane game POST:",String(e?.name||"error"));return fail("Could not save your move. Please try again.",503)}
}
