
import {addCard,cardImage,scryfall} from "./shared.js";
const $=id=>document.getElementById(id);
const form=$("librarySearch"),gallery=$("cardGallery"),status=$("libraryStatus"),
  more=$("loadMore"),pageStats=$("pageStats"),detail=$("cardDetail");
let nextPage=null,loading=false,lastRequest=0,shown=0,searchToken=0,cards=new Map(),controller=null;
const cache=new Map();
const label=o=>String(o||"").replaceAll("_"," ");
function create(tag,className,txt){const e=document.createElement(tag);if(className)e.className=className;if(txt!==undefined)e.textContent=txt;return e}
function buildQuery(){
 const v=id=>$(id).value.trim(),terms=[];
 const raw=v("cardQuery");if(raw)terms.push(raw);
 if(v("formatFilter"))terms.push("f:"+v("formatFilter"));
 if(v("typeFilter"))terms.push("t:"+v("typeFilter"));
 if(v("identityFilter"))terms.push("id<="+v("identityFilter").toLowerCase());
 if(v("rarityFilter"))terms.push("r:"+v("rarityFilter"));
 if(v("maxMana"))terms.push("mv<="+v("maxMana"));
 if(v("maxPrice"))terms.push("usd<="+v("maxPrice"));
 if(!raw && !v("typeFilter") && !v("identityFilter") && !v("rarityFilter") && !v("maxMana") && !v("maxPrice")){
   terms.unshift("t:legendary");
 }
 return terms.join(" ");
}
function entry(card){
 const box=create("article","library-card");
 const img=create("img");img.alt=card.name+" card illustration";img.loading="lazy";img.decoding="async";img.src=cardImage(card)||"assets/favicon.svg";
 const title=create("h3","",card.name);
 const meta=create("p","meta",(card.type_line||"")+" · "+(card.prices?.usd?"$"+card.prices.usd:"Price N/A") );
 const buttons=create("div","card-controls");
 const info=create("button","","DETAILS");info.type="button";info.addEventListener("click",()=>showDetail(card));
 const add=create("button","primary","+ ADD TO DECK");add.type="button";add.addEventListener("click",()=>{if(addCard(card)){add.textContent="✓ ADDED";setTimeout(()=>{add.textContent="+ ADD TO DECK"},1400)}});
 buttons.append(info,add);box.append(img,title,meta,buttons);return box;
}
function showDetail(c){
 const root=$("cardDetailBody");root.replaceChildren();
 const h=create("h2","",c.name),p=create("p","",c.type_line||"");
 const img=create("img");img.src=cardImage(c)||"assets/favicon.svg";img.alt=c.name;img.style="max-width:230px;float:left;margin:0 20px 15px 0;border-radius:10px";
 const oracle=create("p","",(c.oracle_text||c.card_faces?.map(x=>x.oracle_text||"").join("\n//\n")||"").replaceAll("{","[").replaceAll("}","]"));oracle.style.whiteSpace="pre-line";
 const legal=create("p","","Legality: "+Object.entries(c.legalities||{}).filter(([k,v])=>v==="legal").slice(0,12).map(([k])=>label(k)).join(", "));
 const price=create("p","","USD price: "+(c.prices?.usd?"$"+c.prices.usd:"Unavailable"));
 const add=create("button","retro-button","+ ADD TO DECK");add.addEventListener("click",()=>{if(addCard(c))add.textContent="✓ ADDED"});
 const outbound=create("a","text-link","VIEW ON SCRYFALL ↗");outbound.href=c.scryfall_uri||"https://scryfall.com";outbound.target="_blank";outbound.rel="noopener noreferrer";outbound.style.marginLeft="15px";
 root.append(h,img,p,oracle,legal,price,add,outbound);
 detail.showModal();
}
async function load(clear=false){
 if(loading&&!clear)return;
 if(clear){if(controller)controller.abort();searchToken++;nextPage=null;shown=0;cards.clear();gallery.replaceChildren();more.hidden=true}
 controller=new AbortController();
 if(!clear&&!nextPage)return;
 const current=searchToken;loading=true;
 status.textContent="Searching the archive…";more.disabled=true;
 const url=clear?new URL("https://api.scryfall.com/cards/search"):new URL(nextPage);
 if(clear){
  url.searchParams.set("q",buildQuery());url.searchParams.set("unique","cards");
  const sort=$("sortFilter").value;
  url.searchParams.set("order",sort==="edhrec-desc"?"edhrec":sort);
  url.searchParams.set("dir",sort==="edhrec"?"asc":sort==="edhrec-desc"?"desc":"auto");
 }
 // Never request an arbitrary third-party URL from an untrusted next_page value.
 if(url.hostname!=="api.scryfall.com"||url.protocol!=="https:"){loading=false;return}
 try {
  const elapsed=Date.now()-lastRequest;if(elapsed<160)await new Promise(r=>setTimeout(r,160-elapsed));
  lastRequest=Date.now();
  let data=cache.get(url.toString());
  if(!data){data=await scryfall(url.toString(),{signal:controller.signal});cache.set(url.toString(),data);if(cache.size>8)cache.delete(cache.keys().next().value)}
  if(current!==searchToken)return;
  for(const c of data.data||[]){if(!cards.has(c.oracle_id||c.id)){cards.set(c.oracle_id||c.id,c);gallery.append(entry(c));shown++}}
  nextPage=data.has_more?data.next_page:null;
  more.hidden=!nextPage;status.textContent=shown+" cards loaded"+(data.total_cards?" · "+data.total_cards+" total matches":"");
  pageStats.textContent=nextPage?"Load more results for this search.":"End of search results.";
 }catch(err){if(current!==searchToken||err.name==="AbortError")return;status.textContent=err.message;pageStats.textContent="Try a more specific card name or fewer filters."}
 finally{if(current===searchToken){loading=false;more.disabled=false}}
}
form.addEventListener("submit",e=>{e.preventDefault();load(true)});
$("libraryReset").addEventListener("click",()=>{form.reset();load(true)});
more.addEventListener("click",()=>load(false));
$("browseAll").addEventListener("click",()=>{$("cardQuery").value="game:paper";$("formatFilter").value="";$("typeFilter").value="";$("identityFilter").value="";$("rarityFilter").value="";$("maxMana").value="";$("maxPrice").value="";load(true)});
$("closeCard").addEventListener("click",()=>detail.close());
detail.addEventListener("click",e=>{if(e.target===detail)detail.close()});
const params=new URL(location.href).searchParams;
if(params.get("q"))$("cardQuery").value=params.get("q").slice(0,250);
load(true);
