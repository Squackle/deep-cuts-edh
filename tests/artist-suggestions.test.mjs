import test from "node:test";
import assert from "node:assert/strict";
import {artistSuggestions,foldArtist} from "../src/artist-search.js";
import {onRequestGet} from "../functions/api/artist-suggest.js";
const catalog=["John Avon","Jane Avon","Rebecca Guay","rk post","Igor Kieryluk",
 ...Array.from({length:150},(_,i)=>"Artist "+String(i+1).padStart(3,"0"))];
test("Artist matching is accent-insensitive, surname-aware and forgives short typos",()=>{
 assert.equal(foldArtist(" José García "), "jose garcia");
 assert.deepEqual(artistSuggestions(catalog,"john avon").slice(0,1),["John Avon"]);
 assert.ok(artistSuggestions(catalog,"avon").includes("John Avon"));
 assert.equal(artistSuggestions(catalog,"jon avon")[0],"John Avon");
 assert.equal(artistSuggestions(catalog,"rebeca guay")[0],"Rebecca Guay");
 assert.deepEqual(artistSuggestions(catalog,"a"),[]);
 assert.ok(artistSuggestions(catalog,"ar").length<=8);
 assert.deepEqual(artistSuggestions(catalog,"zzzqq"),[]);
});
test("Artist API validates input and caches the remote catalog across successive keystrokes",async()=>{
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async(url)=>{
  assert.equal(url,"https://api.scryfall.com/catalog/artist-names");
  calls++;
  return new Response(JSON.stringify({object:"catalog",data:catalog}),{headers:{"Content-Type":"application/json"}});
 };
 try{
  const send=async query=>{
   const r=await onRequestGet({request:new Request("https://deep-cuts-edh.pages.dev/api/artist-suggest?q="+encodeURIComponent(query))});
   return {status:r.status,body:await r.json(),headers:r.headers};
  };
  const short=await send("J");
  assert.deepEqual(short.body,{suggestions:[]});assert.equal(calls,0);
  const long=await send("X".repeat(81));assert.equal(long.status,400);assert.equal(calls,0);
  const first=await send("jon avon");
  assert.equal(first.status,200);
  assert.equal(first.body.suggestions[0],"John Avon");
  assert.ok(first.body.suggestions.length>=1&&first.body.suggestions.length<=8);
  assert.equal(first.headers.get("Content-Type"),"application/json; charset=utf-8");
  const second=await send("av");
  assert.ok(second.body.suggestions.length<=8);
  assert.equal(calls,1,"Catalog must not fetch again per keystroke");
  assert.equal("data" in second.body,false,"Do not expose whole catalog to visitors");
 }finally{globalThis.fetch=original}
});
