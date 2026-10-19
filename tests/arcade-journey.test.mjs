import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read=x=>fs.readFileSync(x,"utf8");
const GAME_FILES=["games.html","games/cold-case.html","games/obscurity-ladder.html","games/arcane-cipher.html","games/conspiracy-board.html"];
test("Arcade journey is loaded on hub and four puzzles without changing global navigation",()=>{
 for(const file of GAME_FILES)assert.match(read(file),/src="\/arcade-journey\.js"/,file);
 const html=read("games.html");
 assert.equal((html.match(/class="games-feature"/g)||[]).length,5);
 assert.match(html,/href="\/games\/stackbreaker"/);
 assert.doesNotMatch(read("index.html"),/arcade-journey\.js/,"No new homepage script");
});
test("Completion hooks use the server's finished and score response and preserve original score systems",()=>{
 const daily=read("daily-games.js"),arcane=read("arcane-games.js");
 for(const x of [daily,arcane]){
  assert.match(x,/DeepCutsArcade\?\.record/);
  assert.match(x,/score:state\.score/);
  assert.match(x,/finished:!!state\.finished/);
 }
 assert.match(daily,/renderCold\(\);updateArcadeJourney\(\)/);
 assert.match(daily,/renderLadder\(\);updateArcadeJourney\(\)/);
 assert.match(arcane,/render\(\);updateArcadeJourney\(\)/);
 assert.doesNotMatch(read("arcade-journey.js"),/\/api\/|fetch\(|Authorization|profileKey|document\.cookie/);
});
test("Untrusted local-history rows cannot smuggle navigation URLs or fabricated achievements",()=>{
 const code=read("arcade-journey.js");
 assert.match(code,/const GAMES=Object\.freeze/);
 assert.match(code,/\.slice\(-80\)/);
 assert.match(code,/seed>=1&&x\.seed<=999999999/);
 assert.match(code,/practice and daily results stay separate/);
 assert.doesNotMatch(code,/innerHTML|insertAdjacentHTML|localStorage\.clear|sendBeacon/);
});
test("Device-only progress engine handles repeat completions, separate seeds and corrupt storage",()=>{
 const code=read("arcade-journey.js");
 const store=new Map(), elements=[];
 const localStorage={getItem:key=>store.get(key)||null,setItem:(key,v)=>store.set(key,v)};
 const window={};
 const document={
  readyState:"loading",addEventListener:()=>{},
  querySelector:()=>null,
  createElement(tag){
   const node={tag,textContent:"",className:"",children:[],setAttribute(){},append(...x){this.children.push(...x)},querySelector(){return null}};
   elements.push(node);return node;
  }
 };
 const sandbox={window,document,localStorage,Intl,Date,Math,Number,Object,JSON,String,Array,Set};
 vm.createContext(sandbox);vm.runInContext(code, sandbox);
 const record=window.DeepCutsArcade.record;
 record("cold",{mode:"practice",seed:123,day:"2026-10-15",progress:2,finished:false});
 record("cold",{mode:"practice",seed:123,day:"2026-10-15",progress:5,finished:true,score:75});
 record("cold",{mode:"practice",seed:123,day:"2026-10-15",progress:5,finished:true,score:75});
 record("cold",{mode:"practice",seed:456,day:"2026-10-15",progress:5,finished:true,score:90});
 record("cold",{mode:"daily",day:"2026-10-15",progress:5,finished:true,score:80});
 const data=JSON.parse(store.get("deepcuts:arcade-journey:v1"));
 assert.equal(data.results.length,3);
 assert.deepEqual(data.results.map(x=>x.score),[75,90,80]);
 assert.deepEqual(data.results.map(x=>x.mode),["practice","practice","daily"]);
 assert.equal(data.entries["cold:practice:123"].finished,true);
 assert.ok(!JSON.stringify(data).includes("email"));
 store.set("deepcuts:arcade-journey:v1","{broken json");
 record("board",{mode:"practice",seed:8,day:"2026-10-15",progress:1,finished:false});
 assert.equal(JSON.parse(store.get("deepcuts:arcade-journey:v1")).entries["board:practice:8"].progress,1);
 record("cipher",{mode:"practice",seed:0,day:"2026-10-15",finished:true,score:100});
 assert.equal(Object.keys(JSON.parse(store.get("deepcuts:arcade-journey:v1")).entries).length,1);
});

test("Arcade hero copy and CTA keep the hierarchy clean and motion optional",()=>{
 const html=read("games.html"),css=read("games.css"),js=read("arcade-journey.js"),hub=read("daily-games.js");
 assert.match(html,/class="games-masthead arcade-hub-masthead"/);
 assert.match(html,/Daily puzzles\. Endless adventures/);
 assert.match(html,/Pick your next case/);
 assert.match(html,/Fresh puzzles daily/);
 assert.match(html,/class="arcade-hero-how"/);
 assert.match(hub,/NEW PUZZLES EVERY DAY/,"Existing game client remains untouched for the security workstream");
 assert.match(js,/status\.replaceChildren\("Fresh puzzles daily "/,"Arcade journey owns the final hub copy");
 assert.match(js,/Continue last game ↗/);
 assert.match(js,/arcade-continue-note/);
 assert.match(js,/g\.name\+" · "\+context/);
 assert.match(css,/@keyframes arcade-continue-halo/);
 assert.match(css, /prefers-reduced-motion:reduce/);
 assert.match(css, /arcade-continue-button:focus-visible/);
 assert.doesNotMatch(read("index.html"),/arcade-hub-masthead/);
});
