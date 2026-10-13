import test from "node:test";
import assert from "node:assert/strict";
import {dollarCents,manaLimit,compileLibraryQuery,libraryResultSummary} from "../library-query.js";
test("decimal prices including cents shorthand",()=>{
 for(const [input,expected] of [[".50",50],["0.50",50],["2.5",250],["$1.25",125],["0.01",1],["0",0],["100000",10000000],["$100000.00",10000000],[" 1.75 ",175]])assert.equal(dollarCents(input),expected,input);
 assert.equal(dollarCents(""),null);
});
test("bad money input fails loudly",()=>{
 for(const input of ["-1",".","$","1,25","abc","2.005","0.001","100000.01","100001","1e3","1.2.5","NaN"])assert.throws(()=>dollarCents(input),undefined,input);
});
test("maximum mana value numeric limits",()=>{
 for(const n of ["0","1","5","10","99"])assert.equal(manaLimit(n),Number(n));
 assert.equal(manaLimit(""),null);
 for(const n of ["-1","100","1.5","abc","1e1"])assert.throws(()=>manaLimit(n));
});
test("price boundaries compile into Scryfall's USD syntax",()=>{
 assert.match(compileLibraryQuery({search:"t:creature",minPrice:".50",maxPrice:"2.75"}),/usd>=0\.50 usd<=2\.75/);
 assert.match(compileLibraryQuery({minPrice:"$0.01",maxPrice:"0.10"}),/usd>=0\.01 usd<=0\.10/);
 assert.match(compileLibraryQuery({minPrice:"0",maxPrice:"0"}),/usd>=0\.00 usd<=0\.00/);
 assert.throws(()=>compileLibraryQuery({minPrice:".75",maxPrice:".50"}),/minimum price cannot exceed/);
});
test("format, facets, and mana assemble together",()=>{
 assert.equal(compileLibraryQuery({search:"goblin",format:"modern",facetTerms:["id<=ur","(t:creature or t:instant)","r:rare"],faceted:true,maxMana:"3",maxPrice:"1.25"}),"goblin f:modern id<=ur (t:creature or t:instant) r:rare mv<=3 usd<=1.25");
 assert.equal(compileLibraryQuery(),"f:commander t:legendary");
 assert.equal(compileLibraryQuery({search:"game:paper",format:""}),"game:paper");
 assert.equal(compileLibraryQuery({format:"",faceted:true,facetTerms:["t:land"]}),"t:land");
});

test("singular, plural and zero card result messages",()=>{
 assert.equal(libraryResultSummary(1,1),"1 card loaded · 1 total match");
 assert.equal(libraryResultSummary(0,0),"0 cards loaded · 0 total matches");
 assert.equal(libraryResultSummary(175,4142),"175 cards loaded · 4142 total matches");
 assert.equal(libraryResultSummary(3,undefined),"3 cards loaded");
});
