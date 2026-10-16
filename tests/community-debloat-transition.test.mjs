import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const community=fs.readFileSync("community.html","utf8");
const combos=fs.readFileSync("combos.html","utf8");

test("Legacy Community deck publishing stays accessible while Rescue Challenges require it",()=>{
  for(const id of ["deckForm","saveDeck","fromWorkshop","challengeDeck","enterChallenge","challengeEntries"])
    assert.ok(community.includes('id="'+id+'"'),"Required challenge or legacy deck control removed: "+id);
  for(const tab of ["decks","challenge","cases","network","evidence","reputation"])
    assert.ok(community.includes('data-panel="'+tab+'"'),"Required Community panel removed: "+tab);
  assert.match(community,/Rescue Challenges now also accept a pasted decklist directly/);
  for(const id of ["challengeSubmitForm","submitChallengeDeck"])assert.ok(community.includes('id="'+id+'"'));
  assert.match(community,/The Legacy Deck Archive/);
  assert.match(community,/IMPORT LEGACY LOCAL DECK/);
  assert.doesNotMatch(community,/Publish a deck from your Workshop/);
});

test("Community transitions to specialist deck, comparison and match resources transparently",()=>{
  for(const url of ["https://archidekt.com/","https://moxfield.com/","https://playgroup.gg/"])
    assert.ok(community.includes('href="'+url+'"'),"Missing specialist resource: "+url);
  assert.match(community,/do not automatically connect to this gallery/);
  assert.match(community,/Historic Deep Cuts reports are self-submitted/);
});

test("Standalone Combo Finder does not advertise the retired Workshop",()=>{
  assert.match(combos,/href="\/deck">TOOLS & RESOURCES ↗/);
  assert.doesNotMatch(combos,/OPEN DECK WORKSHOP/);
  for(const id of ["comboForm","comboCommander","comboInput","combosIncluded","combosMissing"])
    assert.ok(combos.includes('id="'+id+'"'),"Combo Finder form/results removed: "+id);
});
