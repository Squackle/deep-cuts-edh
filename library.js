
import {addCard,cardImage,scryfall} from "./shared.js";
import {facetTerms,isFaceted,resetFacets,initFacets,shareURL,clearManaChips} from "./library-facets.js";
import {compileLibraryQuery,libraryResultSummary} from "./library-query.js";
const $=id=>document.getElementById(id);
const form=$("librarySearch"),gallery=$("cardGallery"),status=$("libraryStatus"),
  more=$("loadMore"),pageStats=$("pageStats"),detail=$("cardDetail");
let nextPage=null,loading=false,lastRequest=0,shown=0,searchToken=0,cards=new Map(),controller=null;
const cache=new Map();
const inclusionRequests=new Map();
let inclusionChain=Promise.resolve();
// Genuine EDHREC inclusion = number of decks with the card / eligible decks.
// Requests are paced and fail closed; the printed Magic rarity facet is separate.
function checkInclusion(card,tile){
 const name=String(card.name||"");
 if(!name||name.length>110||name.includes("//"))return;
 if(!inclusionRequests.has(name)){
  const pending=inclusionChain.then(()=>new Promise(resolve=>setTimeout(resolve,600))).then(async()=>{
   const r=await fetch("/api/card-inclusion?name="+encodeURIComponent(name),{credentials:"omit"});
   if(!r.ok)return null;
   const d=await r.json();
   return d.available===true&&Number.isFinite(d.percent)?d:null;
  }).catch(()=>null);
  inclusionRequests.set(name,pending);
  inclusionChain=pending.then(()=>{},()=>{});
 }
 inclusionRequests.get(name).then(info=>{
  if(!tile.isConnected||!info)return;
  tile.title="EDHREC: "+info.percent+"% inclusion in "+info.potential_decks.toLocaleString()+" eligible Commander decks";
  if(!info.underplayed||tile.querySelector(".dc-inclusion-note"))return;
  tile.classList.add("dc-usage-gem");
  const percent=info.percent<.01?"<0.01":info.percent<1?info.percent.toFixed(2):info.percent.toFixed(1);
  const tag=create("a","dc-inclusion-note","✦ UNDERPLAYED · "+percent+"% included");
  tag.href=info.url;tag.target="_blank";tag.rel="noopener noreferrer";
  tag.title="EDHREC reports "+info.num_decks.toLocaleString()+" of "+info.potential_decks.toLocaleString()+" eligible decks. Not printed rarity.";
  const meta=tile.querySelector(".meta");meta?.after(tag);
 });
}
const label=o=>String(o||"").replaceAll("_"," ");
function create(tag,className,txt){const e=document.createElement(tag);if(className)e.className=className;if(txt!==undefined)e.textContent=txt;return e}
const sortOptions={
 "edhrec-asc":["edhrec","asc"],"edhrec-desc":["edhrec","desc"],
 "usd-asc":["usd","asc"],"usd-desc":["usd","desc"],
 "name-asc":["name","asc"],"name-desc":["name","desc"],
 "cmc-asc":["cmc","asc"],"cmc-desc":["cmc","desc"],
 "released-desc":["released","desc"],"released-asc":["released","asc"],
 "rarity-asc":["rarity","asc"],"rarity-desc":["rarity","desc"],
 "power-desc":["power","desc"],"toughness-desc":["toughness","desc"],
 "color-asc":["color","asc"],"artist-asc":["artist","asc"],"set-desc":["set","desc"]
};
function buildQuery(){
 const v=id=>$(id).value.trim();
 return compileLibraryQuery({search:v("cardQuery"),format:v("formatFilter"),
  facetTerms:facetTerms(),faceted:isFaceted(),maxMana:v("maxMana"),
  minPrice:v("minPrice"),maxPrice:v("maxPrice")});
}
function currentSort(){return sortOptions[$("sortFilter").value]||sortOptions["edhrec-asc"]}
function currentUnique(){return ["cards","prints","art"].includes($("printingFilter").value)?$("printingFilter").value:"cards"}
function updateScryfallLink(){
 const out=$("openScryfallSearch");if(!out)return;
 try{
  const url=new URL("https://scryfall.com/search");
  url.searchParams.set("q",buildQuery());
  url.searchParams.set("unique",currentUnique());
  const [order,dir]=currentSort();
  url.searchParams.set("order",order);url.searchParams.set("dir",dir);
  out.href=url.toString();
 }catch{out.href="https://scryfall.com/advanced"}
}
function entry(card){
 const box=create("article","library-card");window.DeepCutsGuide?.registerCardNames([card.name]);
 box.addEventListener("pointerenter",()=>checkInclusion(card,box),{once:true});
 box.addEventListener("focusin",()=>checkInclusion(card,box),{once:true});
 const img=create("img");img.alt=card.name+" card illustration";img.loading="lazy";img.decoding="async";img.src=cardImage(card)||"assets/favicon.svg";
 const title=create("h3");const cardLink=create("a","dc-card-link",card.name);
 cardLink.href=card.scryfall_uri||window.DeepCutsGuide?.scryfallUrl(card.name)||("https://scryfall.com/search?q="+encodeURIComponent('!"'+card.name+'"'));
 cardLink.target="_blank";cardLink.rel="noopener noreferrer";cardLink.title="View "+card.name+" on Scryfall";
 title.append(cardLink);
 const meta=create("p","meta",(card.type_line||"")+" · "+(card.prices?.usd?"$"+card.prices.usd:"Price N/A") );
 const buttons=create("div","card-controls");
 const info=create("button","","DETAILS");info.type="button";info.addEventListener("click",()=>showDetail(card));
 const add=create("button","primary","+ ADD TO DECK");add.type="button";add.addEventListener("click",()=>{if(addCard(card)){try{localStorage.setItem("deepcuts-workbench-tab","deck")}catch{}add.textContent="✓ ADDED";setTimeout(()=>{add.textContent="+ ADD TO DECK"},1400)}});
 const shop=create("a","shop-card-link","TCGplayer ↗");shop.href="https://www.tcgplayer.com/search/magic/product?productLineName=magic&q="+encodeURIComponent(card.name)+"&view=grid";shop.target="_blank";shop.rel="noopener noreferrer";shop.setAttribute("aria-label","Find "+card.name+" on TCGplayer");buttons.append(info,add);box.append(img,title,meta,buttons,shop);
 if(card.set&&card.collector_number){
  const tagger=create("a","shop-card-link library-tagger-card-link","Tagger ↗");
  tagger.href="https://tagger.scryfall.com/card/"+encodeURIComponent(card.set)+"/"+encodeURIComponent(card.collector_number);
  tagger.target="_blank";tagger.rel="noopener noreferrer";
  tagger.setAttribute("aria-label","Explore art and gameplay tags for "+card.name);
  box.append(tagger);
 }
 return box;
}
function showDetail(c){
 const root=$("cardDetailBody");root.replaceChildren();
 window.DeepCutsGuide?.registerCardNames([c.name]);
 const h=create("h2");const cardNameLink=create("a","dc-card-link",c.name);
 cardNameLink.href=c.scryfall_uri||window.DeepCutsGuide?.scryfallUrl(c.name)||"https://scryfall.com";
 cardNameLink.target="_blank";cardNameLink.rel="noopener noreferrer";h.append(cardNameLink);
 const p=create("p","",c.type_line||"");
 const img=create("img");img.src=cardImage(c)||"assets/favicon.svg";img.alt=c.name;img.style="max-width:230px;float:left;margin:0 20px 15px 0;border-radius:10px";
 const oracle=create("p","",(c.oracle_text||c.card_faces?.map(x=>x.oracle_text||"").join("\n//\n")||"").replaceAll("{","[").replaceAll("}","]"));oracle.style.whiteSpace="pre-line";
 const legal=create("p","","Legality: "+Object.entries(c.legalities||{}).filter(([k,v])=>v==="legal").slice(0,12).map(([k])=>label(k)).join(", "));
 const price=create("p","","USD price: "+(c.prices?.usd?"$"+c.prices.usd:"Unavailable"));
 const add=create("button","retro-button","+ ADD TO DECK");add.addEventListener("click",()=>{if(addCard(c))add.textContent="✓ ADDED"});
 const outbound=create("a","text-link","VIEW ON SCRYFALL ↗");outbound.href=c.scryfall_uri||"https://scryfall.com";outbound.target="_blank";outbound.rel="noopener noreferrer";outbound.style.marginLeft="15px";
 const shop=create("a","text-link","TCGplayer ↗");shop.href="https://www.tcgplayer.com/search/magic/product?productLineName=magic&q="+encodeURIComponent(c.name)+"&view=grid";shop.target="_blank";shop.rel="noopener noreferrer";shop.style.marginLeft="12px";root.append(h,img,p,oracle,legal,price,add,outbound,shop);
 if(c.set&&c.collector_number){
  const tagger=create("a","text-link","SCRYFALL TAGGER ↗");
  tagger.href="https://tagger.scryfall.com/card/"+encodeURIComponent(c.set)+"/"+encodeURIComponent(c.collector_number);
  tagger.target="_blank";tagger.rel="noopener noreferrer";tagger.style.marginLeft="12px";
  root.append(tagger);
 }
 detail.showModal();
}
async function load(clear=false){
 if(loading&&!clear)return;
 let builtQuery="";
 if(clear){
  try{builtQuery=buildQuery()}catch(err){
   if(controller)controller.abort();searchToken++;loading=false;nextPage=null;shown=0;
   cards.clear();gallery.replaceChildren();more.hidden=true;more.disabled=true;
   status.textContent=err.message;pageStats.textContent="Correct the filter values and search again.";
   updateScryfallLink();return;
  }
  updateScryfallLink();
  try{
   const target=new URL(shareURL());
   history.replaceState(null,"",target.pathname+target.search);
  }catch{}
 }
 if(clear){if(controller)controller.abort();searchToken++;nextPage=null;shown=0;cards.clear();gallery.replaceChildren();more.hidden=true;pageStats.textContent="";more.disabled=true}
 controller=new AbortController();
 if(!clear&&!nextPage)return;
 const current=searchToken;loading=true;
 status.textContent="Searching the archive…";more.disabled=true;
 const url=clear?new URL("https://api.scryfall.com/cards/search"):new URL(nextPage);
 if(clear){
  url.searchParams.set("q",builtQuery);
  url.searchParams.set("unique",currentUnique());
  const [order,dir]=currentSort();
  url.searchParams.set("order",order);url.searchParams.set("dir",dir);
 }
 // Never request an arbitrary third-party URL from an untrusted next_page value.
 if(url.hostname!=="api.scryfall.com"||url.protocol!=="https:"){loading=false;more.disabled=false;status.textContent="Invalid pagination link. Restart your search.";return}
 try {
  const elapsed=Date.now()-lastRequest;if(elapsed<160)await new Promise(r=>setTimeout(r,160-elapsed));
  lastRequest=Date.now();
  let data=cache.get(url.toString());
  if(!data){data=await scryfall(url.toString(),{signal:controller.signal});cache.set(url.toString(),data);if(cache.size>8)cache.delete(cache.keys().next().value)}
  if(current!==searchToken)return;
  for(const c of data.data||[]){const id=currentUnique()==="prints"?c.id:(c.oracle_id||c.id);if(!cards.has(id)){cards.set(id,c);const tile=entry(c);gallery.append(tile);if(shown<6)checkInclusion(c,tile);shown++}}
  nextPage=data.has_more?data.next_page:null;
  more.hidden=!nextPage;status.textContent=libraryResultSummary(shown,data.total_cards);
  pageStats.textContent=nextPage?"Load more results for this search.":"End of search results.";
 }catch(err){if(current!==searchToken||err.name==="AbortError")return;status.textContent=err.message;pageStats.textContent="Try a more specific card name or fewer filters."}
 finally{if(current===searchToken){loading=false;more.disabled=false}}
}
// Facets update results automatically, while free-text searches submit on Enter
// to keep network traffic reasonable for Scryfall.
let facetTimer=null;
function scheduleSearch(){
 clearTimeout(facetTimer);
 facetTimer=setTimeout(()=>load(true),320);
 updateScryfallLink();
}
initFacets(scheduleSearch);
form.addEventListener("submit",e=>{e.preventDefault();clearTimeout(facetTimer);load(true)});
$("libraryReset").addEventListener("click",()=>{clearTimeout(facetTimer);form.reset();resetFacets();load(true)});
more.addEventListener("click",()=>load(false));
$("browseAll").addEventListener("click",()=>{clearTimeout(facetTimer);resetFacets();$("cardQuery").value="game:paper";$("formatFilter").value="";$("maxMana").value="";$("minPrice").value="";$("maxPrice").value="";load(true)});
$("closeCard").addEventListener("click",()=>detail.close());
detail.addEventListener("click",e=>{if(e.target===detail)detail.close()});
const params=new URL(location.href).searchParams;
if(params.get("q"))$("cardQuery").value=params.get("q").slice(0,250);
form.addEventListener("input",updateScryfallLink);
form.addEventListener("change",e=>{
 updateScryfallLink();
 if(["formatFilter","printingFilter","maxMana","minPrice","maxPrice"].includes(e.target.id))scheduleSearch();
});
form.addEventListener("input",e=>{
 if(e.target.id==="maxMana"&&e.target.value.trim()){clearManaChips();scheduleSearch()}
});
updateScryfallLink();
load(true);
