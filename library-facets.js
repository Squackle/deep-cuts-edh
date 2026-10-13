/* Deep Cuts EDH Card Library: accessible, shareable, card-appropriate facets.
 * All filtering compiles to documented Scryfall search syntax. No fake counts,
 * no new account requirements, and no deck-level bracket labels on single cards.
 */
const VALID={
 colors:["W","U","B","R","G","C"],
 type:["creature","instant","sorcery","artifact","enchantment","land","planeswalker","legendary","battle"],
 role:["ramp","draw","removal","boardwipe","tokens","treasure","graveyard","blink","counters","sacrifice","tutors","protection","lifegain","spellslinger"],
 mana:["0","1","2","3","4","5","6+"],
 rarity:["common","uncommon","rare","mythic"],
 trait:["commander","gamechanger","reserved","reprint"]
};
const OP={
 ramp:"otag:ramp",
 draw:'(o:"draw a card" or o:"draw two cards" or o:"draw three cards")',
 removal:'(o:"destroy target" or o:"exile target")',
 boardwipe:'(o:"destroy all" or o:"exile all")',
 tokens:'(o:create o:token)',
 treasure:'o:treasure',
 graveyard:'o:graveyard',
 blink:'(o:"exile target" o:return o:battlefield)',
 counters:'o:"+1/+1 counter"',
 sacrifice:'o:sacrifice',
 tutors:'o:"search your library"',
 protection:'(kw:hexproof or kw:indestructible or o:"protection from")',
 lifegain:'(o:"gain life" or kw:lifelink)',
 spellslinger:'(o:"instant or sorcery" or o:"noncreature spell")'
};
const TRAITS={commander:"is:commander",gamechanger:"is:gamechanger",reserved:"is:reserved",reprint:"is:reprint"};
const labels={W:"White",U:"Blue",B:"Black",R:"Red",G:"Green",C:"Colorless",creature:"Creature",instant:"Instant",sorcery:"Sorcery",artifact:"Artifact",enchantment:"Enchantment",land:"Land",planeswalker:"Planeswalker",legendary:"Legendary",battle:"Battle",ramp:"Ramp",draw:"Card draw",removal:"Removal",boardwipe:"Board wipes",tokens:"Tokens",treasure:"Treasure",graveyard:"Graveyard",blink:"Blink",counters:"+1/+1 counters",sacrifice:"Sacrifice",tutors:"Tutors",protection:"Protection",lifegain:"Life gain",spellslinger:"Spellslinger",common:"Common",uncommon:"Uncommon",rare:"Rare",mythic:"Mythic",commander:"Can command",gamechanger:"Game Changer",reserved:"Reserved List",reprint:"Reprint","0":"0 MV","1":"1 MV","2":"2 MV","3":"3 MV","4":"4 MV","5":"5 MV","6+":"6+ MV"};
const state={colors:new Set(),type:new Set(),role:new Set(),mana:new Set(),rarity:new Set(),trait:new Set()};
let callback=null;
const $=id=>document.getElementById(id);
function code(group,value){return VALID[group]?.includes(value)}
function choices(group){return [...state[group]]}
function uniqueOr(terms){return terms.length===1?terms[0]:terms.length?"("+terms.join(" or ")+")":""}
function term(group,selected){
 if(group==="type")return uniqueOr(selected.map(x=>"t:"+x));
 if(group==="rarity")return uniqueOr(selected.map(x=>"r:"+x));
 if(group==="role")return uniqueOr(selected.map(x=>OP[x]).filter(Boolean));
 if(group==="trait")return selected.map(x=>TRAITS[x]).filter(Boolean).join(" ");
 return "";
}
export function facetTerms(){
 const terms=[];
 const colors=choices("colors");
 if(colors.includes("C"))terms.push("id:c");
 else if(colors.length){
  const letters=["W","U","B","R","G"].filter(x=>colors.includes(x)).join("").toLowerCase();
  const exact=$("identityExact")?.checked;
  terms.push("id"+(exact?"=":"<=")+letters);
 }
 for(const group of ["type","role","rarity","trait"]){const t=term(group,choices(group));if(t)terms.push(t)}
 const mv=choices("mana")[0];
 if(mv)terms.push("mv"+(mv==="6+"?">=":"=")+(mv==="6+"?"6":mv));
 return terms;
}
const EXTRA={minPrice:"Min price",maxPrice:"Max price",maxMana:"Max mana",formatFilter:"Format",printingFilter:"Printings"};
function advancedActive(){
 const result=[];
 for(const [id,title] of Object.entries(EXTRA)){
  const v=$(id)?.value?.trim()||"";
  if(!v||(id==="formatFilter"&&v==="commander")||(id==="printingFilter"&&v==="cards"))continue;
  result.push({group:"advanced",value:id,title:title+": "+(id==="minPrice"||id==="maxPrice"?"$":"")+v});
 }
 return result;
}
export function activeFacetCount(){
 const exact=$("identityExact")?.checked&&state.colors.size>0&&!state.colors.has("C");
 return Object.values(state).reduce((n,set)=>n+set.size,0)+(exact?1:0)+advancedActive().length;
}
export function isFaceted(){return Object.values(state).some(x=>x.size>0)}
export function resetFacets(){
 for(const set of Object.values(state))set.clear();
 if($("identityExact"))$("identityExact").checked=false;
 updateVisuals();
}
export function setFacet(group,value,enabled=true){
 if(!code(group,value))return;
 const set=state[group];
 if(group==="mana"){
  set.clear();
  if(enabled&&$("maxMana"))$("maxMana").value="";
 }
 if(group==="colors"&&value==="C"&&enabled){
  set.clear();
  if($("identityExact"))$("identityExact").checked=false;
 }
 if(group==="colors"&&value!=="C"&&enabled)set.delete("C");
 if(enabled)set.add(value);else set.delete(value);
 updateVisuals();
}
export function clearFacet(group,value){
 if(group==="exact"&&$("identityExact"))$("identityExact").checked=false;
 else if(group==="advanced"&&EXTRA[value]){
  $(value).value=value==="formatFilter"?"commander":value==="printingFilter"?"cards":"";
 }else if(state[group]&&code(group,value))state[group].delete(value);
 updateVisuals();signal();
}
export function clearManaChips(){
 if(state.mana.size){state.mana.clear();updateVisuals()}
}
export function facetSelections(){return Object.fromEntries(Object.keys(state).map(k=>[k,choices(k)]))}
function updateVisuals(){
 for(const btn of document.querySelectorAll("[data-facet]")){
  const on=state[btn.dataset.facet]?.has(btn.dataset.value)||false;
  btn.setAttribute("aria-pressed",String(on));
  btn.classList.toggle("is-active",on);
 }
 const count=activeFacetCount();
 const out=$("activeFacetCount");if(out)out.textContent=count?String(count):"";
 const badge=$("libraryFilterCount");if(badge){badge.hidden=count===0;badge.textContent=count}
 const tags=$("activeFilterChips");
 if(tags){
  tags.replaceChildren();
  const all=[];
  for(const [group,values] of Object.entries(state)){
   for(const value of values)all.push({group,value,title:labels[value]||value});
  }
  if($("identityExact")?.checked&&state.colors.size>0&&!state.colors.has("C"))all.push({group:"exact",value:"exact",title:"Exact colors"});
  all.push(...advancedActive());
  for(const entry of all){
   const chip=document.createElement("button");
   chip.type="button";chip.className="dc-active-chip";
   chip.textContent=entry.title+" ×";
   chip.setAttribute("aria-label","Remove "+entry.title+" filter");
   chip.addEventListener("click",()=>clearFacet(entry.group,entry.value));
   tags.append(chip);
  }
 }
 const empty=$("libraryFilterEmpty");if(empty)empty.hidden=count>0;
 const sort=$("sortFilter")?.value;
 for(const btn of document.querySelectorAll("[data-quick-sort]")){
  const on=btn.dataset.quickSort===sort;
  btn.classList.toggle("is-active",on);
  btn.setAttribute("aria-pressed",String(on));
 }
 const summary=$("libraryFacetSummary");
 if(summary)summary.textContent=count?count+" active filter"+(count===1?"":"s"):"All colors and card types";
}
function signal(){if(typeof callback==="function")callback()}
function togglePanel(open){
 const panel=$("libraryFacetPanel"),btn=$("libraryToggleFilters");
 if(!panel||!btn)return;
 panel.hidden=!open;
 btn.setAttribute("aria-expanded",String(open));
 btn.classList.toggle("is-open",open);
 try{sessionStorage.setItem("dc-library-filters-open",open?"1":"0")}catch{}
}
function restore(){
 const u=new URL(location.href).searchParams;
 for(const key of Object.keys(state)){
  const raw=u.get(key)||"";
  for(const value of raw.split(","))if(code(key,value))setFacet(key,value,true);
 }
 if(u.get("exact")==="1"&&$("identityExact"))$("identityExact").checked=true;
 const select=(id,param)=>{const v=u.get(param),input=$(id);if(!v||!input)return;
  if(input.tagName==="SELECT"&&[...input.options].some(x=>x.value===v))input.value=v;
  else if(input.tagName==="INPUT")input.value=v.slice(0,32)};
 select("formatFilter","format");select("sortFilter","sort");select("printingFilter","print");
 select("minPrice","min");select("maxPrice","max");select("maxMana","maxmv");
 if(u.get("q")&&$("cardQuery"))$("cardQuery").value=u.get("q").slice(0,250);
 updateVisuals();
}
export function shareURL(){
 const u=new URL("/library.html",location.origin);
 const query=$("cardQuery")?.value.trim();if(query)u.searchParams.set("q",query.slice(0,250));
 for(const [key,set] of Object.entries(state))if(set.size)u.searchParams.set(key,choices(key).join(","));
 if($("identityExact")?.checked)u.searchParams.set("exact","1");
 for(const [id,k] of [["formatFilter","format"],["sortFilter","sort"],["printingFilter","print"],["minPrice","min"],["maxPrice","max"],["maxMana","maxmv"]]){
  const v=$(id)?.value?.trim();
  if(v&&!(id==="formatFilter"&&v==="commander")&&!(id==="sortFilter"&&v==="edhrec-asc")&&!(id==="printingFilter"&&v==="cards"))u.searchParams.set(k,v);
 }
 return u.toString();
}
export function initFacets(onChange){
 callback=onChange;
 restore();
 for(const btn of document.querySelectorAll("[data-facet]")){
  const group=btn.dataset.facet,value=btn.dataset.value;
  if(!code(group,value))continue;
  btn.addEventListener("click",()=>{
   setFacet(group,value,!state[group].has(value));
   signal();
  });
 }
 $("identityExact")?.addEventListener("change",()=>{updateVisuals();signal()});
 for(const b of document.querySelectorAll("[data-quick-sort]")){
  b.addEventListener("click",()=>{
   $("sortFilter").value=b.dataset.quickSort;
   updateVisuals();signal();
  });
 }
 const panel=$("libraryFacetPanel"),toggle=$("libraryToggleFilters");
 toggle?.addEventListener("click",()=>togglePanel(panel.hidden));
 let saved=null;try{saved=sessionStorage.getItem("dc-library-filters-open")}catch{}
 const mobile=window.matchMedia?.("(max-width: 780px)").matches;
 togglePanel(saved===null?!mobile:saved==="1");
 // Reset and Browse All are handled centrally by library.js to avoid duplicate API calls.
 $("browseAll")?.addEventListener("click",()=>{resetFacets()});
 $("sortFilter")?.addEventListener("change",()=>{updateVisuals();signal()});
 const adv=new Set(Object.keys(EXTRA));
 $("librarySearch")?.addEventListener("input",e=>{if(adv.has(e.target.id))updateVisuals()});
 $("librarySearch")?.addEventListener("change",e=>{if(adv.has(e.target.id))updateVisuals()});
 $("librarySaveSearch")?.addEventListener("click",async()=>{
  const url=shareURL(),status=$("libraryStatus");
  try{
   await navigator.clipboard.writeText(url);
   if(status)status.textContent="Search link copied — your filters can be shared.";
  }catch{
   const field=$("libraryShareFallback");if(field){field.value=url;field.hidden=false;field.focus();field.select()}
   if(status)status.textContent="Select the share link to copy it.";
  }
 });
 for(const preset of document.querySelectorAll("[data-library-preset]")){
  preset.addEventListener("click",()=>{
   resetFacets();
   $("cardQuery").value="";
   $("formatFilter").value="commander";
   $("sortFilter").value="edhrec-asc";
   $("minPrice").value="";$("maxPrice").value="";$("maxMana").value="";
   const name=preset.dataset.libraryPreset;
   if(name==="deepcuts"){$("cardQuery").value="t:legendary t:creature";$("sortFilter").value="edhrec-desc"}
   if(name==="budget"){setFacet("trait","commander");$("maxPrice").value="2"}
   if(name==="lands"){setFacet("type","land")}
   if(name==="treasures"){setFacet("role","treasure")}
   if(name==="vintage"){$("cardQuery").value="year<2000";$("sortFilter").value="released-asc"}
   updateVisuals();signal();
  });
 }
 updateVisuals();
}
