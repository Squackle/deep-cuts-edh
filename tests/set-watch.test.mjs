import test from "node:test";
import assert from "node:assert/strict";
import {relevantSets,publicPreview,validCode,isoDay} from "../src/set-watch.js";
import {onRequestGet} from "../functions/api/set-previews.js";
const today=new Date(),day=86400000,iso=ms=>new Date(ms).toISOString().slice(0,10);
const yesterday=iso(today.getTime()-day),tomorrow=iso(today.getTime()+day*35);
const tooOld=iso(today.getTime()-day*100),tooFar=iso(today.getTime()+day*700);
const releases=[
 {code:"trk",name:"Star Trek",set_type:"expansion",released_at:tomorrow,digital:false,card_count:91},
 {code:"trc",name:"Star Trek Commander",set_type:"commander",released_at:tomorrow,digital:false,card_count:22},
 {code:"tok",name:"Tokens",set_type:"token",released_at:tomorrow,digital:false,card_count:99},
 {code:"dig",name:"Digital Expansion",set_type:"expansion",released_at:tomorrow,digital:true,card_count:4},
 {code:"old",name:"Old",set_type:"expansion",released_at:tooOld,digital:false},
 {code:"fut",name:"Way Later",set_type:"expansion",released_at:tooFar,digital:false},
 {code:"cur",name:"Recent release",set_type:"expansion",released_at:yesterday,digital:false,card_count:0}
];
const card={id:"c1",name:"Preview Legend",set:"trk",released_at:tomorrow,type_line:"Legendary Creature — Human",rarity:"rare",legalities:{commander:"legal"},image_uris:{normal:"https://cards.scryfall.io/normal/front/preview.jpg"},scryfall_uri:"https://scryfall.com/card/trk/1",preview:{source:"Wizards",source_uri:"https://magic.wizards.com/en/news",previewed_at:yesterday}};
test("known sets are sorted and tokens, digital, old and far-future products are omitted",()=>{
 const out=relevantSets(releases,today);
 assert.deepEqual(out.map(x=>x.code),["cur","trk","trc"]);
 assert.equal(out[1].upcoming,true);
 assert.equal(out[0].upcoming,false);
});
test("no arbitrary set codes or unsafe paths",()=>{
 for(const valid of ["trk","trc","mdd","mbc"])assert.equal(validCode(valid),true);
 for(const invalid of ["", "../x","trk;", "http", "BAD_CODE","t".repeat(7)])assert.equal(validCode(invalid),false);
});
test("unreleased legendary remains a preview, not asserted legal",()=>{
 const x=publicPreview(card,isoDay(today));
 assert.equal(x.unreleased,true);assert.equal(x.commander_legal,false);
 assert.equal(x.commander_candidate,true);assert.ok(x.image.startsWith("https://cards.scryfall.io/"));
 assert.equal(x.preview_source,"Wizards");assert.equal(x.preview_source_uri,"https://magic.wizards.com/en/news");
});
test("spoiler cards may not have images or preview-source info yet",()=>{
 const x=publicPreview({name:"Hidden Future",set:"trk",released_at:tomorrow,card_faces:[{name:"Hidden Future"}]},isoDay(today));
 assert.equal(x.image,null);assert.equal(x.preview_source_uri,null);
 assert.equal(x.unreleased,true);
});
test("set endpoint serves upcoming and recently released, using fixed upstream hosts",async()=>{
 const prior=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));return new Response(JSON.stringify({data:releases}),{status:200,headers:{"Content-Type":"application/json"}})};
 try{
  const r=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/set-previews")});
  assert.equal(r.status,200);const j=await r.json();
  assert.deepEqual(j.upcoming.map(s=>s.code),["trk","trc"]);assert.deepEqual(j.recent.map(s=>s.code),["cur"]);
  assert.deepEqual(urls,["https://api.scryfall.com/sets"]);
 }finally{globalThis.fetch=prior}
});
test("set cards endpoint returns indexed preview list and clear legal status",async()=>{
 const prior=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));if(urls.length===1)return new Response(JSON.stringify({data:releases}));return new Response(JSON.stringify({data:[card],total_cards:1,has_more:false}))};
 try{
  const r=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/set-previews?set=trk&page=1")});
  assert.equal(r.status,200);const j=await r.json();
  assert.equal(j.cards.length,1);assert.equal(j.cards[0].unreleased,true);assert.equal(j.cards[0].commander_legal,false);
  assert.equal(j.total_known,1);assert.equal(j.has_more,false);
  assert.ok(urls[1].startsWith("https://api.scryfall.com/cards/search?"));
  assert.ok(new URL(urls[1]).searchParams.get("q")==="set:trk");
 }finally{globalThis.fetch=prior}
});
test("no preview cards returns empty list rather than an invented teaser",async()=>{
 const prior=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>new Response(++count===1?JSON.stringify({data:releases}):"",{status:count===1?200:404});
 try{const r=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/set-previews?set=trk")});const data=await r.json();assert.equal(r.status,200);assert.deepEqual(data.cards,[]);assert.equal(data.has_more,false)}finally{globalThis.fetch=prior}
});
test("invalid set and page inputs stop before any upstream fetch",async()=>{
 const prior=globalThis.fetch;
 globalThis.fetch=()=>{throw Error("Unexpected fetch")};
 try{
  for(const query of ["?set=%2e%2e%2fsecret","?set=trk&page=0","?set=trk&page=99","?page=2"]){
   const r=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/set-previews"+query)});
   assert.equal(r.status,400,query);
  }
 }finally{globalThis.fetch=prior}
});
