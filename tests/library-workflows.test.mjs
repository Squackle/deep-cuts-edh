import test from "node:test";
import assert from "node:assert/strict";
import {readDeck,saveDeck,addCard,cardImage,compactCard} from "../shared.js";
import {readFileSync} from "node:fs";
const map=new Map();globalThis.localStorage={getItem:key=>map.get(key)??null,setItem:(key,v)=>map.set(key,v),removeItem:key=>map.delete(key)};
test("library Add to Deck saves and increments duplicate cards",()=>{
 map.clear();const card={name:"Razor Boomerang",type_line:"Artifact",prices:{usd:"0.14"},image_uris:{normal:"https://cards.scryfall.io/normal/front/example.jpg"}};
 assert.equal(addCard(card),true);assert.equal(readDeck().cards[0].qty,1);
 assert.equal(addCard(card),true);assert.equal(readDeck().cards[0].qty,2);
 assert.equal(readDeck().cards.length,1);assert.equal(readDeck().cards[0].name,card.name);
 assert.equal(readDeck().cards[0].card.prices.usd,"0.14");
 assert.equal(cardImage(card),card.image_uris.normal);
});
test("bad cards don't save and invalid stored decks recover safely",()=>{
 map.clear();assert.equal(addCard({name:""}),false);assert.equal(readDeck().cards.length,0);
 map.set("deepcuts-deck-v1","broken");assert.equal(readDeck().cards.length,0);
});
test("Library card-details and external links are wired",()=>{
 const source=readFileSync(new URL("../library.js",import.meta.url),"utf8");
 for(const marker of ["cardDetailBody","detail.showModal()","closeCard","addCard(card)","addCard(c)","card.scryfall_uri","TCGplayer","SCRYFALL TAGGER","loadMore","browseAll","libraryReset","openScryfallSearch"])
  assert.ok(source.includes(marker),"Missing "+marker);
 const facets=readFileSync(new URL("../library-facets.js",import.meta.url),"utf8");
 assert.ok(facets.includes("librarySaveSearch"),"Missing share search handler");
});
test("HTML presents sort presets, facets, decimal inputs, and accessible results",()=>{
 const html=readFileSync(new URL("../library.html",import.meta.url),"utf8");
 const sortValues=[...html.matchAll(/<option value="([a-z-]+)">/g)].map(m=>m[1]);
 for(const v of ["usd-asc","usd-desc","rarity-desc","edhrec-desc","name-asc","cmc-asc","released-desc"])assert.ok(sortValues.includes(v),"Missing sort "+v);
 for(const group of ["colors","type","role","mana","rarity","trait"])assert.ok(html.includes('data-facet="'+group+'"'),"Missing facet "+group);
 for(const id of ["minPrice","maxPrice"])assert.match(html,new RegExp('id="'+id+'"[^>]*type="text"'));
 assert.match(html,/id="cardGallery"[^>]+aria-live="polite"/);
 assert.match(html,/id="libraryFacetPanel"/);
 assert.match(html,/id="libraryPriceHelp"/);
});
