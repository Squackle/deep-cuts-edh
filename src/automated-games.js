/* Self-maintaining daily MTG puzzles for Cloudflare Pages + D1.
 * Every day's answer is snapshotted atomically: data refreshes cannot move the
 * goalposts after somebody has played. Card data comes from Scryfall.
 *
 * Data source distinction: edhrec_rank is a CARD inclusion/popularity rank,
 * NOT the number of decks led by a commander. The interface labels it that way.
 */
import {COMMANDERS,SNAPSHOT_DATE,coldCase,obscurityLadder,hashSeed,shuffle,previousDay} from "./daily-games-data.js";
export const AUTOMATION_START="2026-10-14"; // preserve Oct 13 launch puzzles
const CACHE_SECONDS=7*86400;
const RETRY_SECONDS=1800;
const CARD_QUERY="is:commander f:commander game:paper";
const SEARCHES=[
 ["edhrec","asc",1],["edhrec","asc",3],
 ["edhrec","desc",1],["edhrec","desc",3],
 ["released","desc",2],["name","asc",5]
];
const COLOR_NAMES={W:"white",U:"blue",B:"black",R:"red",G:"green"};
const freshTime=()=>Math.floor(Date.now()/1000);
const dayNumber=x=>Math.floor(Date.parse(x+"T00:00:00Z")/86400000);
const sqlSafeJson=(value)=>{try{return JSON.parse(value)}catch{return null}};
const hasRank=c=>Number.isInteger(c?.rank)&&c.rank>0;
const isValidName=n=>typeof n==="string"&&n.length>=3&&n.length<=100&&!n.includes(" // ");
const shortText=(text,max=155)=>String(text||"").replace(/\{[^}]+\}/g,"mana").replace(/\s+/g," ").trim().slice(0,max);
function colorsOf(cs){
 if(!Array.isArray(cs)||!cs.length)return "colorless";
 const names=cs.map(x=>COLOR_NAMES[x]).filter(Boolean);
 if(names.length===5)return "all five colors";
 if(names.length===1)return names[0];
 return names.slice(0,-1).join(", ")+" and "+names.at(-1);
}
function describeMechanic(c){
 const oracle=String(c?.oracle||"").toLowerCase(),type=String(c?.type||"").toLowerCase();
 const tags=[
 [/\bgraveyard\b|\breanimate\b|\breturn.*battlefield\b/,"graveyard recursion"],
 [/\bsacrifice\b|\bdies\b|\bwhen .* dies\b/,"sacrifice and death triggers"],
 [/\btreasure\b|\badd \{|\bman[a]a\b/,"mana acceleration"],
 [/\bproliferate\b|\b\+1\/\+1 counter\b|\b-1\/-1 counter\b/,"counter manipulation"],
 [/\bcreate .* token\b|\bcreature tokens?\b/,"creating creature tokens"],
 [/\bartifact\b/,"artifact synergies"],
 [/\benchantment\b/,"enchantment synergies"],
 [/\bspell\b|\binstant\b|\bsorcery\b/,"spellcasting synergies"],
 [/\bdraw .* card\b|\bscry\b/,"card selection and card advantage"],
 [/\bcombat damage\b|\bwhenever .* attacks\b|\battack\b/,"combat triggers"],
 [/\bequipment\b|\bequip\b/,"Equipment synergies"],
 [/\bcounter target\b/,"interactive spell control"],
 [/\bdiscard\b/,"discard strategies"],
 [/\bmill\b/,"library milling"],
 [/\bexile\b/,"exile-based strategies"]
 ];
 for(const [re,label] of tags)if(re.test(oracle))return label;
 if(type.includes("dragon"))return "Dragon strategies";
 return "unusual legendary-creature interactions";
}
function cardOf(raw){
 const front=raw.card_faces?.[0],type=raw.type_line||front?.type_line||"";
 const oracle=raw.oracle_text||front?.oracle_text||"";
 const rank=Number(raw.edhrec_rank);
 const name=raw.name;
 if(!type.includes("Legendary Creature")||!isValidName(name)||!Number.isInteger(rank)||rank<=0||!oracle||oracle.length<30)return null;
 if(!Array.isArray(raw.color_identity)||raw.color_identity.length>5)return null;
 const year=Number(String(raw.released_at||"").slice(0,4));
 if(!Number.isInteger(year)||year<1993||year>2100)return null;
 return {
  name,rank,year,colors:colorsOf(raw.color_identity),type:shortText(type,120),
  mana:shortText(raw.mana_cost||front?.mana_cost||"",65),
  oracle:shortText(oracle,600),
  theme:describeMechanic({oracle,type}),
  power:shortText(raw.power||front?.power||"",16),
  toughness:shortText(raw.toughness||front?.toughness||"",16)
 };
}
function safeCatalog(input){
 if(!Array.isArray(input))return [];
 const found=new Map();
 for(const x of input){
  if(!isValidName(x?.name)||!hasRank(x)||!Number.isInteger(x.year)||typeof x.oracle!=="string"||x.oracle.length<20)continue;
  found.set(x.name.toLowerCase(),x);
 }
 return [...found.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function closedDay(day){
 return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)&&Number.isFinite(Date.parse(day+"T00:00:00Z"));
}
async function fetchPool(){
 const collected=new Map();
 for(let i=0;i<SEARCHES.length;i++){
  const [order,dir,page]=SEARCHES[i];
  const u=new URL("https://api.scryfall.com/cards/search");
  u.searchParams.set("q",CARD_QUERY);
  u.searchParams.set("order",order);u.searchParams.set("dir",dir);
  u.searchParams.set("unique","cards");u.searchParams.set("page",String(page));
  try{
   const r=await fetch(u,{headers:{"Accept":"application/json","User-Agent":"DeepCutsEDH-DailyPuzzles/1.0 (https://deep-cuts-edh.pages.dev/games.html)"},signal:AbortSignal.timeout(10000)});
   if(r.ok){
    const raw=await r.json();
    for(const item of raw.data||[]){
     const c=cardOf(item);
     if(c)collected.set(c.name.toLowerCase(),c);
    }
   }else console.warn("Scryfall game source unavailable",r.status,order,dir,page);
  }catch(e){console.warn("Scryfall puzzle source error",String(e?.name||"fetch error"))}
  // Respect Scryfall's documented ~100ms+ spacing between API requests.
  if(i<SEARCHES.length-1)await new Promise(resolve=>setTimeout(resolve,180));
 }
 const list=safeCatalog([...collected.values()]);
 if(list.length<110)throw new Error("Source pool too small to safely rotate puzzles");
 return list;
}
async function getCachedCatalog(db){
 const now=freshTime();
 let row=await db.prepare("SELECT payload,updated_at,refresh_attempt_at FROM game_auto_catalog WHERE id=1").first();
 if(!row){
  await db.prepare("INSERT OR IGNORE INTO game_auto_catalog(id) VALUES(1)").run();
  row=await db.prepare("SELECT payload,updated_at,refresh_attempt_at FROM game_auto_catalog WHERE id=1").first();
 }
 const cached=safeCatalog(sqlSafeJson(row?.payload));
 const valid=cached.length>=110;
 if(valid&&row.updated_at>now-CACHE_SECONDS)return {pool:cached,updatedAt:row.updated_at,source:"scryfall"};
 // If a refresh is already in progress, return the last known snapshot safely.
 const locked=await db.prepare("UPDATE game_auto_catalog SET refresh_attempt_at=? WHERE id=1 AND refresh_attempt_at<? AND (updated_at<? OR length(payload)<5) RETURNING id")
  .bind(now,now-RETRY_SECONDS,now-CACHE_SECONDS).first();
 if(!locked)return {pool:cached,updatedAt:row?.updated_at||0,source:valid?"scryfall-stale":"curated"};
 try{
  const fresh=await fetchPool();
  // The value is saved *once per week*, not on every user page view.
  await db.prepare("UPDATE game_auto_catalog SET payload=?,updated_at=?,source='scryfall-edhrec-card-rank' WHERE id=1")
   .bind(JSON.stringify(fresh),now).run();
  return {pool:fresh,updatedAt:now,source:"scryfall"};
 }catch(e){
  console.warn("Automated puzzle refresh deferred",String(e?.message||"source error"));
  return {pool:cached,updatedAt:row?.updated_at||0,source:valid?"scryfall-stale":"curated"};
 }
}
function automaticCold(day,cards,recent,catalogAt){
 if(cards.length<110)return coldCase(day);
 const used=new Set((recent||[]).map(x=>x.answer?.name).filter(Boolean));
 const start=hashSeed("deepcuts-cold-"+day)%cards.length;
 const answer=Array.from({length:cards.length},(_,i)=>cards[(start+i)%cards.length])
  .find(c=>!used.has(c.name))||cards[start];
 const choices=shuffle([answer,...shuffle(cards.filter(c=>c.name!==answer.name),hashSeed(day+"-suspects")).slice(0,11)],hashSeed(day+"-choices"));
 const subtype=answer.type.replace(/^Legendary Creature\s*[—-]\s*/,"");
 const trailing=answer.power&&answer.toughness?" with printed stats "+answer.power+"/"+answer.toughness:"";
 // Prevent revealing the answer when a card name occurs in its own rules text.
 const excerptRaw=answer.oracle.split(/\n|(?<=\.)\s/)[0]||answer.oracle;
 const excerpt=excerptRaw.split(answer.name).join("this commander");
 const clues=[
  {label:"EVIDENCE 01 · COLOR IDENTITY",text:"This suspect's color identity is "+answer.colors+"."},
  {label:"EVIDENCE 02 · PAPER TRAIL",text:"A paper printing of this card was released in "+answer.year+"."},
  {label:"EVIDENCE 03 · THE MOTIVE",text:"The card's abilities suggest "+answer.theme+"."},
  {label:"EVIDENCE 04 · THE INTERROGATION",text:"A clue from its rules: "+shortText(excerpt,145)},
  {label:"EVIDENCE 05 · FINAL IDENTIFICATION",text:"Its type line includes "+subtype+trailing+". Mana cost: "+(answer.mana||"not printed")+"."}
 ];
 return {answer,choices:choices.map(x=>x.name),clues,origin:"scryfall",snapshot:new Date(catalogAt*1000).toISOString().slice(0,10)};
}
function automaticLadder(day,cards,catalogAt){
 const qualified=cards.filter(hasRank).sort((a,b)=>a.rank-b.rank);
 if(qualified.length<110)return obscurityLadder(day);
 // Five distinct popularity bands; avoid ties that would make grading unfair.
 const entries=[],seen=new Set(),n=qualified.length;
 for(let i=0;i<5;i++){
  const lower=Math.floor(i*n/5),upper=Math.floor((i+1)*n/5),bucket=qualified.slice(lower,upper);
  const start=hashSeed("ladder-"+day+"-"+i)%bucket.length;
  const picked=Array.from({length:bucket.length},(_,j)=>bucket[(start+j)%bucket.length]).find(c=>!seen.has(c.rank));
  if(!picked)return obscurityLadder(day);
  seen.add(picked.rank);entries.push(picked);
 }
 return {
  entries:shuffle(entries,hashSeed("ladder-order-"+day)),
  solution:[...entries].sort((a,b)=>b.rank-a.rank),
  metric:"rank",origin:"scryfall",snapshot:new Date(catalogAt*1000).toISOString().slice(0,10),
  explanation:"Higher Scryfall EDHREC rank = lower usage as a card in Commander decklists. This is NOT the count of decks led by each commander."
 };
}
function curated(game,day,mode,seed){
 const p=game==="cold"?coldCase(day,mode,seed):obscurityLadder(day,mode,seed);
 return {...p,metric:game==="ladder"?"decks":undefined,origin:"curated",snapshot:SNAPSHOT_DATE};
}
export async function getPuzzle(db,game,day,mode="daily",seed=0){
 if(!closedDay(day))throw new Error("Invalid game day");
 if(mode==="practice"||day<AUTOMATION_START)return curated(game,day,mode,seed);
 const existing=await db.prepare("SELECT payload FROM game_auto_puzzles WHERE game=? AND day=?").bind(game,day).first();
 const frozen=sqlSafeJson(existing?.payload);
 if(frozen&&frozen.answer||frozen&&frozen.entries)return frozen;
 const {pool,source,updatedAt}=await getCachedCatalog(db);
 let puzzle;
 if(pool.length>=110&&source!=="curated"){
  if(game==="cold"){
   const since=previousDay(day);
   const history=await db.prepare("SELECT payload FROM game_auto_puzzles WHERE game='cold' AND day>=? AND day<? ORDER BY day DESC LIMIT 90")
    .bind(new Date(Date.parse(day+"T00:00:00Z")-90*86400000).toISOString().slice(0,10),day).all();
   const recent=(history.results||[]).map(x=>sqlSafeJson(x.payload)).filter(Boolean);
   puzzle=automaticCold(day,pool,recent,updatedAt);
  }else puzzle=automaticLadder(day,pool,updatedAt);
 }else puzzle=curated(game,day,mode,seed);
 // Once selected, the daily puzzle is forever immutable for that date.
 await db.prepare("INSERT OR IGNORE INTO game_auto_puzzles(game,day,payload,source) VALUES(?,?,?,?)")
  .bind(game,day,JSON.stringify(puzzle),puzzle.origin||"curated").run();
 const row=await db.prepare("SELECT payload FROM game_auto_puzzles WHERE game=? AND day=?").bind(game,day).first();
 return sqlSafeJson(row?.payload)||puzzle;
}
export async function getAutoStatus(db,day){
 const row=await db.prepare("SELECT updated_at,refresh_attempt_at,length(payload) AS size FROM game_auto_catalog WHERE id=1").first();
 const puzzles=await db.prepare("SELECT game,source,created_at FROM game_auto_puzzles WHERE day=? ORDER BY game").bind(day).all();
 return {day,automatic:true,
  catalogUpdatedAt:row?.updated_at||null,catalogRefreshAttemptAt:row?.refresh_attempt_at||null,
  catalogBytes:row?.size||0,rotation:"midnight America/Chicago",
  catalogRefresh:"approximately every 7 days, requested automatically by Cloudflare",
  today:(puzzles.results||[]).map(x=>({game:x.game,source:x.source,generatedAt:x.created_at})),
  sourceNotes:"Scryfall EDHREC ranks are card-usage rankings, not the number of Commander decks led."};
}
