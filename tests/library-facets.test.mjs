import test from "node:test";
import assert from "node:assert/strict";
import {facetTerms,setFacet,resetFacets,clearManaChips,clearFacet,activeFacetCount,shareURL,initFacets,facetSelections} from "../library-facets.js";
const fields=new Map();
function element(id,tagName="INPUT"){
 const events={};const el={id,tagName,value:"",checked:false,hidden:false,textContent:"",children:[],dataset:{},options:[],classList:{toggle(){},add(){},remove(){}},setAttribute(){},replaceChildren(...children){this.children=children},addEventListener(type,fn){(events[type]??=[]).push(fn)},fire(type){for(const fn of events[type]||[])fn({target:this})}};
 fields.set(id,el);return el;
}
for(const id of ["identityExact","maxMana","minPrice","maxPrice","cardQuery","activeFacetCount","libraryFilterCount","libraryFacetSummary","libraryFilterEmpty","activeFilterChips","libraryFacetPanel","libraryToggleFilters","librarySearch","libraryReset","browseAll","librarySaveSearch","libraryShareFallback","openScryfallSearch"])element(id);
for(const id of ["formatFilter","sortFilter","printingFilter"]){const e=element(id,"SELECT");e.options=["commander","standard","modern","edhrec-asc","edhrec-desc","usd-asc","usd-desc","cards","prints","art"].map(value=>({value}))}
fields.get("formatFilter").value="commander";fields.get("sortFilter").value="edhrec-asc";fields.get("printingFilter").value="cards";
globalThis.document={getElementById:id=>fields.get(id)||null,querySelectorAll:selector=>selector==="[data-facet]"?[facetButton]:selector==="[data-quick-sort]"?[sortButton]:selector==="[data-library-preset]"?[presetButton]:[]};
globalThis.location={href:"https://deep-cuts-edh.pages.dev/library.html",origin:"https://deep-cuts-edh.pages.dev"};
globalThis.window={matchMedia:()=>({matches:false})};
globalThis.sessionStorage={getItem:()=>null,setItem(){}};
const facetButton=element("facet","BUTTON");facetButton.dataset={facet:"colors",value:"G"};
const sortButton=element("quick","BUTTON");sortButton.dataset={quickSort:"usd-asc"};
const presetButton=element("preset","BUTTON");presetButton.dataset={libraryPreset:"deepcuts"};
const terms=()=>facetTerms().join(" ");
test("identity chips, exact colors and colorless are mutually consistent",()=>{
 resetFacets();setFacet("colors","B");setFacet("colors","R");assert.equal(terms(),"id<=br");
 fields.get("identityExact").checked=true;assert.equal(terms(),"id=br");
 setFacet("colors","C");assert.equal(terms(),"id:c");assert.equal(fields.get("identityExact").checked,false);
 setFacet("colors","W");assert.equal(terms(),"id<=w");
});
test("card types, rarities, mechanics and traits compile to valid grouped search",()=>{
 resetFacets();setFacet("type","creature");setFacet("type","artifact");setFacet("rarity","rare");setFacet("rarity","mythic");setFacet("role","treasure");setFacet("trait","gamechanger");
 assert.equal(terms(),"(t:creature or t:artifact) o:treasure (r:rare or r:mythic) is:gamechanger");
 clearFacet("type","creature");assert.equal(terms(),"t:artifact o:treasure (r:rare or r:mythic) is:gamechanger");
});
test("mana chips override max mana and allow only one mana chip",()=>{
 resetFacets();fields.get("maxMana").value="4";
 setFacet("mana","6+");assert.equal(terms(),"mv>=6");assert.equal(fields.get("maxMana").value,"");
 setFacet("mana","2");assert.equal(terms(),"mv=2");clearManaChips();assert.equal(terms(),"");
});
test("shareable searches preserve decimals, settings and chosen facets",()=>{
 resetFacets();fields.get("cardQuery").value="goblin";fields.get("minPrice").value=".50";fields.get("maxPrice").value="2.75";
 fields.get("sortFilter").value="usd-desc";setFacet("colors","R");setFacet("type","creature");
 const u=new URL(shareURL());assert.equal(u.searchParams.get("min"),".50");assert.equal(u.searchParams.get("max"),"2.75");
 assert.equal(u.searchParams.get("sort"),"usd-desc");assert.equal(u.searchParams.get("colors"),"R");assert.equal(u.searchParams.get("type"),"creature");
});
test("filter button, sort button, preset and URL restore initialize without errors",()=>{
 resetFacets();let calls=0;initFacets(()=>calls++);
 facetButton.fire("click");assert.ok(facetSelections().colors.includes("G"));
 sortButton.fire("click");assert.equal(fields.get("sortFilter").value,"usd-asc");
 presetButton.fire("click");assert.equal(fields.get("cardQuery").value,"t:legendary t:creature");
 assert.equal(fields.get("sortFilter").value,"edhrec-desc");assert.ok(calls>=3);
});
test("reset clears facets while advanced controls remain independently editable",()=>{
 resetFacets();fields.get("maxMana").value="4";assert.equal(activeFacetCount(),1);
 fields.get("maxMana").value="";fields.get("minPrice").value="";fields.get("maxPrice").value="";
 fields.get("cardQuery").value="";fields.get("sortFilter").value="edhrec-asc";assert.equal(activeFacetCount(),0);
});
