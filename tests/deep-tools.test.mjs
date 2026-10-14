import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {parseCollection,validCommander,allowed,copyLimit,roleOf,draftFromOwned,key,CASES,synergySignal} from "../deep-tools-core.js";
import {onRequestPost} from "../functions/api/tool-cards.js";
const cmd={name:"Verdant Captain",type_line:"Legendary Creature — Elf",oracle_text:"",color_identity:["G"],legalities:{commander:"legal"}};
const card=(name,type_line="Creature",color_identity=["G"],oracle_text="")=>({name,type_line,color_identity,oracle_text,cmc:2,legalities:{commander:"legal"}});
test("CSV header imports quoted card names, quantities and deduplicates printings",()=>{
 const x=parseCollection('Name,Quantity,Set\n"Chainer, Dementia Master",2,TSB\n"Chainer, Dementia Master",3,DMR\n"Sol Ring",1,CMD');
 assert.deepEqual(x.cards,[{name:"Chainer, Dementia Master",quantity:5},{name:"Sol Ring",quantity:1}]);assert.equal(x.invalid.length,0);
});
test("Plain list supports Nx forms, rows without counts and duplicates",()=>{
 const x=parseCollection("4 Forest\nForest\n3x Island\n1,Sol Ring\n");
 assert.deepEqual(x.cards,[{name:"Forest",quantity:5},{name:"Island",quantity:3},{name:"Sol Ring",quantity:1}]);
});
test("Import rejects malformed CSV, unbounded copies, empty imports and overlarge files",()=>{
 assert.throws(()=>parseCollection('"Never closed,2'),/quote/);
 assert.throws(()=>parseCollection("9999 Forest"),/No valid/);
 assert.throws(()=>parseCollection(""),/Add card/);
 assert.throws(()=>parseCollection("x".repeat(260001)),/under 260 KB/);
});
test("Imported unknown rows are explicitly reported, not silently counted",()=>{
 const x=parseCollection("2 Sol Ring\n0 Forest\nW\n");assert.equal(x.cards.length,1);assert.equal(x.invalid.length,2);
});
test("Commander candidates require a legal commander and reject unsupported ordinary planeswalkers",()=>{
 assert.equal(validCommander(cmd),true);
 assert.equal(validCommander({...cmd,legalities:{commander:"banned"}}),false);
 assert.equal(validCommander({...cmd,type_line:"Planeswalker — Jace"}),false);
 assert.equal(validCommander({...cmd,type_line:"Legendary Planeswalker — Jace",oracle_text:"Jace can be your commander."}),true);
});
test("Color identity and Commander ban checks exclude illegal cards",()=>{
 assert.equal(allowed(card("Elvish Mystic"),cmd),true);
 assert.equal(allowed(card("Fireball","Sorcery",["R"]),cmd),false);
 assert.equal(allowed({...card("Banned Card"),legalities:{commander:"banned"}},cmd),false);
});
test("Singleton and special card copy limits are respected",()=>{
 assert.equal(copyLimit(card("Forest","Basic Land — Forest")),999);
 assert.equal(copyLimit(card("Dupe")),1);
 assert.equal(copyLimit(card("Seven Dwarves","Creature",["R"],"A deck can have up to seven cards named Seven Dwarves.")),7);
});
test("Owned-card draft reserves lands and has exactly 100 cards when available",()=>{
 const own=Array.from({length:140},(_,i)=>({name:"Spell "+i,quantity:2}));
 own.push({name:"Forest",quantity:36});
 const lookup=[...Array.from({length:140},(_,i)=>card("Spell "+i)),card("Forest","Basic Land — Forest")];
 const d=draftFromOwned(cmd,own,lookup);assert.equal(d.complete,true);assert.equal(d.cardCount,100);assert.equal(d.cards.reduce((n,c)=>n+c.qty,0),99);
 assert.equal(d.counts.land,36);assert.equal(d.cards.filter(x=>x.name.startsWith("Spell")).length,63);
 assert.ok(d.cards.every(x=>x.name==="Forest"||x.qty===1));
});
test("Insufficient owned cards are never presented as complete legal decks",()=>{
 const d=draftFromOwned(cmd,[{name:"Forest",quantity:6},{name:"Sol Ring",quantity:1}],[card("Forest","Basic Land — Forest"),card("Sol Ring","Artifact",[],"{T}: Add {C}.")]);
 assert.equal(d.complete,false);assert.equal(d.cardCount,8);assert.equal(d.missingSlots,92);assert.ok(d.warnings[0].includes("Incomplete"));
});
test("Illegal, off-identity and unverified cards are excluded rather than assumed legal",()=>{
 const own=[{name:"Fireball",quantity:1},{name:"Illegal Spell",quantity:1},{name:"Forest",quantity:2},{name:"Unknown",quantity:1}];
 const lookup=[card("Fireball","Sorcery",["R"]),{...card("Illegal Spell"),legalities:{commander:"banned"}},card("Forest","Basic Land — Forest")];
 const d=draftFromOwned(cmd,own,lookup);assert.equal(d.cardCount,3);assert.deepEqual(d.skip.outsideIdentity,["Fireball"]);assert.deepEqual(d.skip.illegal,["Illegal Spell"]);assert.deepEqual(d.skip.unknown,["Unknown"]);
});
test("Known editorial synergy is tagged, and generic candidates are explicitly provisional",()=>{
 assert.ok(CASES.commandermustard.cards.some(([name,why])=>name==="Raise the Alarm"&&why.includes("Soldiers")));
 assert.match(synergySignal({oracle_text:"Whenever you create a token, draw a card"}).explanation,/check|inspect/i);
});
test("Card-lookup server rejects requests from another origin and impossible batches",async()=>{
 const request=(body,origin)=>new Request("https://deep-cuts-edh.pages.dev/api/tool-cards",{method:"POST",headers:{"Content-Type":"application/json",...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 const env={DB:{},TURNSTILE_SECRET:"fixture"};
 const rejected=await onRequestPost({request:request({names:["Sol Ring"]},"https://elsewhere.example"),env});
 assert.equal(rejected.status,403);
 const noOrigin=await onRequestPost({request:request({names:["Sol Ring"]}),env});assert.equal(noOrigin.status,403);
 const huge=await onRequestPost({request:request({names:Array(76).fill("Sol Ring")},"https://deep-cuts-edh.pages.dev"),env});assert.equal(huge.status,400);
});
test("Finder, Binder, sitemap and Workshop integration routes are present",()=>{
 for(const p of ["deep-cut-finder.html","binder-to-brew.html","deep-tools.js","deep-tools.css","functions/api/tool-cards.js","deep-tools-core.js"])assert.ok(fs.existsSync(p),p+" missing");
 for(const [p,id] of [["deep-cut-finder.html","finderForm"],["binder-to-brew.html","binderBuildForm"]])assert.ok(fs.readFileSync(p,"utf8").includes('id="'+id+'"'));
 const sitemap=fs.readFileSync("sitemap.xml","utf8");for(const p of ["deep-cut-finder","binder-to-brew"])assert.ok(sitemap.includes("/"+p+"</loc>"));
 for(const p of ["index.html","library.html","deck.html","community.html"])assert.ok(fs.readFileSync(p,"utf8").includes("/binder-to-brew")||fs.readFileSync(p,"utf8").includes("/deep-cut-finder"),p+" missing discoverability link");
});
