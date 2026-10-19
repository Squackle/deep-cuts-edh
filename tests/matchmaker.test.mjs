import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {IDEAS,THEMES,COLORS,validCandidate,selectIdeas} from "../matchmaker-core.js";
const legend=(name,identity=["B"],price="2.50",options={})=>({
 name,type_line:"Legendary Creature — Human",oracle_text:"",legalities:{commander:"legal"},
 color_identity:identity,prices:{usd:price},...options
});
test("Each editorial Commander seed is uniquely named and offers a nonempty concrete premise",()=>{
 assert.ok(IDEAS.length>=25);
 assert.equal(new Set(IDEAS.map(x=>x.name.toLocaleLowerCase())).size,IDEAS.length);
 for(const x of IDEAS){assert.ok(x.name.length>=4&&x.why.length>=30&&THEMES[x.theme],JSON.stringify(x))}
});
test("Never suggest banned, unverified, nonlegendary or unrecognized commanders",()=>{
 const legal=legend(IDEAS[0].name);
 assert.equal(validCandidate(legal),true);
 for(const c of [
  {...legal,legalities:{commander:"banned"}},
  {...legal,type_line:"Creature — Human"},
  {...legal,type_line:"Legendary Planeswalker — Jace",oracle_text:""},
  {...legal,name:""},
  {...legal,legalities:{commander:"not_legal"}}
 ])assert.equal(validCandidate(c),false);
 const result=selectIdeas([{...legal,legalities:{commander:"banned"}}],{theme:"any"},3);
 assert.equal(result.length,0,"Do not turn a banned card into a recommendation");
});
test("Personalization uses verified identities and actual commander-card prices",()=>{
 const ids={
  "Toshiro Umezawa":["B"],"Rionya, Fire Dancer":["R"],
  "Tameshi, Reality Architect":["W","U"],
  "The Council of Four":["W","U"],"Gretchen Titchwillow":["U","G"],
  "Ghen, Arcanum Weaver":["W","B","R"]
 };
 const pool=IDEAS.slice(0,6).map(x=>legend(x.name,ids[x.name],x.name==="Toshiro Umezawa"?"9.25":"3.15"));
 const cheapBlack=selectIdeas(pool,{color:"B",max:"5"},4);
 assert.deepEqual(cheapBlack.map(x=>x.name),["Ghen, Arcanum Weaver"]);
 const budget=selectIdeas(pool,{color:"B",max:"15"},4);
 assert.ok(budget.some(x=>x.name==="Toshiro Umezawa"));
 const white=selectIdeas(pool,{color:"W",max:"any"},4);
 assert.ok(white.every(x=>x.card.color_identity.includes("W")));
 const mono=selectIdeas(pool,{color:"mono"},4);
 assert.ok(mono.every(x=>x.card.color_identity.length===1));
 const multi=selectIdeas(pool,{color:"multi"},4);
 assert.ok(multi.every(x=>x.card.color_identity.length>=2));
 const unavailable=pool.map(x=>({...x,prices:{usd:null}}));
 assert.equal(selectIdeas(unavailable,{max:"5"}).length,0,"Unknown price is not falsely presented as under $5");
});
test("Surprise and curated archetypes remain distinct, consistent and repeatable for share URLs",()=>{
 const cards=IDEAS.map(x=>legend(x.name));
 const a=selectIdeas(cards,{theme:"spells"},9231,5);
 assert.equal(a.length,5);assert.equal(a[0].theme,"spells");
 assert.deepEqual(a.map(x=>x.name),selectIdeas(cards,{theme:"spells"},9231,5).map(x=>x.name));
 assert.equal(new Set(a.map(x=>x.name)).size,5);
 assert.ok(a.every(x=>x.card.legalities.commander==="legal"));
 assert.notDeepEqual(selectIdeas(cards,{theme:"any"},1,5).map(x=>x.name),selectIdeas(cards,{theme:"any"},125,5).map(x=>x.name));
});
test("Discovery is a new independent public page linking to existing tools without editing the Card Library",()=>{
 const html=fs.readFileSync("matchmaker.html","utf8");
 assert.match(html,/rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/matchmaker"/);
 assert.equal((html.match(/<h1\b/g)||[]).length,1);
 for(const id of ["mmTheme","mmColor","mmBudget","mmSurprise","mmMatch","mmResults"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/href="\/release-polish\.css"/);
 assert.match(html,/src="\/header-profile\.js"/);
 assert.match(html,/href="\/library"/);
 assert.match(fs.readFileSync("index.html","utf8"),/href="\/matchmaker"/);
 const client=fs.readFileSync("matchmaker.js","utf8");
 assert.match(client,/fetch\("\/api\/tool-cards"/);
 assert.match(client,/validCard|selectIdeas/);
 assert.doesNotMatch(client,/innerHTML|eval\(/);
 assert.match(fs.readFileSync("sitemap.xml","utf8"),/<loc>https:\/\/deep-cuts-edh\.pages\.dev\/matchmaker<\/loc>/);
});
