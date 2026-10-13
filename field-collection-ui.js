import {$,state,el,api,msg,link} from "./community.js";
import {fieldGet,fieldPost,norm,currency,emptyNotice,showFieldError,requireProfile} from "./field-client.js";
let owned=[],publicDecks=[],busy=false;
function parseCSV(raw){
 const rows=[],row=[];let cell="",quoted=false;
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='"'){
   if(quoted&&raw[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
  }else if(c===","&&!quoted){row.push(cell);cell=""}
  else if((c==="\n"||c==="\r")&&!quoted){
   if(c==="\r"&&raw[i+1]==="\n")i++;
   row.push(cell);if(row.some(x=>x.trim()))rows.push([...row]);row.length=0;cell="";
  }else cell+=c;
 }
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
function parseImport(raw){
 if(typeof raw!=="string"||raw.length>260000)throw Error("Collection import must be under 260 KB.");
 const lines=parseCSV(raw);if(!lines.length)throw Error("Paste a collection list or choose a CSV.");
 const labels=lines[0].map(x=>x.toLowerCase().replace(/[^a-z]/g,""));
 let headerName=labels.findIndex(x=>["name","card","cardname","cardtitle"].includes(x));
 let headerQty=labels.findIndex(x=>["quantity","qty","count","owned","amount"].includes(x));
 const header=headerName>=0&&headerQty>=0;
 if(header&&headerName===headerQty)throw Error("CSV header must include both card name and quantity.");
 const counts=new Map();
 for(const row of (header?lines.slice(1):lines)){
  let name="",qty=1;
  if(header){name=(row[headerName]||"").trim();qty=Number((row[headerQty]||"").trim())}
  else if(row.length>=2&&/^\d+$/.test(row[0].trim())){qty=Number(row[0].trim());name=row[1].trim()}
  else if(row.length>=2&&/^\d+$/.test(row[1].trim())){name=row[0].trim();qty=Number(row[1].trim())}
  else {
   const line=row.join(",").trim().replace(/^["']|["']$/g,"");
   const matched=/^(\d+)\s*[xX]?\s+(.+)$/.exec(line);
   if(matched){qty=Number(matched[1]);name=matched[2].trim()}
   else{name=line;qty=1}
  }
  if(!name)continue;
  if(!Number.isInteger(qty)||qty<1||qty>999||name.length<2||name.length>130)throw Error("Invalid name/quantity: "+name.slice(0,60));
  const key=norm(name);if(!key)throw Error("Invalid card name: "+name.slice(0,60));
  const old=counts.get(key);const sum=qty+(old?.quantity||0);
  if(sum>999)throw Error("More than 999 copies of "+name);
  counts.set(key,{name,quantity:sum});
  if(counts.size>2500)throw Error("You can track up to 2,500 different cards.");
 }
 if(!counts.size)throw Error("No card entries detected.");
 return [...counts.values()];
}
function localDeck(){
 try{
  const d=JSON.parse(localStorage.getItem("deepcuts-deck-v1")||"null");
  if(!Array.isArray(d?.cards))return null;
  return {name:"My local Workshop deck",commanders:d.commanders||[],cards:d.cards};
 }catch{return null}
}
export async function fetchDeck(id){
 if(id==="workshop"){
  const d=localDeck();if(!d)throw Error("No saved Workshop deck found in this browser.");
  return d;
 }
 if(!/^[a-f0-9]{32}$/.test(id||""))throw Error("Choose a published deck.");
 const d=await api("deck",{id});
 return {name:d.deck.title,commanders:d.deck.content.commanders||[],cards:d.deck.content.cards||[],handle:d.deck.handle};
}
function allDeckCards(deck){
 const found=new Map();
 for(const c of [...(deck.commanders||[]).map(name=>({name,qty:1})),...(deck.cards||[])]){
  const name=String(c.name||"").trim(),key=norm(name),qty=Number(c.qty??c.quantity??1);
  if(!key||!Number.isInteger(qty)||qty<1)continue;
  const old=found.get(key);
  found.set(key,{name,qty:qty+(old?.qty||0)});
 }
 return found;
}
function renderInventory(){
 const host=$("collectionItems");host.replaceChildren();
 const filter=$("collectionSearch").value.toLowerCase().trim();
 const matches=owned.filter(item=>item.name.toLowerCase().includes(filter)).slice(0,180);
 if(!matches.length)return emptyNotice(host,filter?"No matching cards in your inventory.":"Your collection is empty. Add your first card above.");
 const header=el("p",filter?"Showing "+matches.length+" matching entries":"Showing "+matches.length+" of "+owned.length+" saved card names","cm-note");
 host.append(header);
 for(const c of matches){
  const row=el("div",null,"field-inventory-row");
  row.append(el("strong",c.quantity+"× "+c.name));
  const controls=el("div",null,"cm-actions");
  for(const [label,qty] of [["−",c.quantity-1],["+",c.quantity+1],["REMOVE",0]]){
   const btn=el("button",label,"cm-btn cm-outline");btn.type="button";btn.title=(qty===0?"Remove ":"Set quantity for ")+c.name;
   btn.addEventListener("click",async()=>{
    btn.disabled=true;try{await fieldPost("collection_edit",{name:c.name,quantity:qty});await loadCollection()}
    catch(e){msg(e.message,true);btn.disabled=false}
   });controls.append(btn);
  }
  row.append(controls);host.append(row);
 }
}
export async function loadCollection(){
 const host=$("collectionItems"),summary=$("collectionSummary");
 if(!state.me){owned=[];summary.textContent="Sign in to access your private collection.";return emptyNotice(host,"Your saved cards will appear after sign-in.")}
 try{
  const data=await fieldGet("collection");owned=data.cards||[];
  summary.textContent=(data.summary?.distinct_cards||0)+" distinct cards · "+(data.summary?.total_cards||0)+" physical copies saved privately to @"+state.me.handle;
  renderInventory();
 }catch(e){showFieldError(summary,e)}
}
export async function loadAvailableDecks(){
 try{
  const r=await api("decks");publicDecks=r.decks||[];
  for(const id of ["collectionDeckSelect","compareDeckA","compareDeckB"]){
   const select=$(id);if(!select)continue;
   const old=select.value;
   select.replaceChildren();
   const isB=id==="compareDeckB";
   const choose=el("option",isB?"Choose a published deck":"My local Deck Workshop list");
   choose.value=isB?"":"workshop";select.append(choose);
   for(const d of publicDecks){const option=el("option",d.title+" · @"+d.handle);option.value=d.id;select.append(option)}
   if([...select.options].some(x=>x.value===old))select.value=old;
  }
 }catch(e){msg("Could not refresh public deck selection: "+e.message,true)}
}
export async function assessCompletion(){
 const host=$("collectionCostResult");host.replaceChildren(el("p","Analyzing missing cards and Scryfall prices…","cm-note"));
 try{
  requireProfile();
  const deck=await fetchDeck($("collectionDeckSelect").value),requested=allDeckCards(deck);
  if(!requested.size)throw Error("This deck does not contain any cards.");
  const own=new Map(owned.map(c=>[norm(c.name),Number(c.quantity)]));
  const missing=[];
  let totalRequired=0,available=0;
  for(const [key,item] of requested){
   const have=own.get(key)||0,need=Math.max(0,item.qty-have);
   totalRequired+=item.qty;available+=Math.min(have,item.qty);
   if(need)missing.push({...item,need});
  }
  host.replaceChildren();
  host.append(el("h3",deck.name+" — collection coverage"));
  host.append(el("p",available+" of "+totalRequired+" required card copies owned · "+missing.length+" missing card names","field-stat"));
  if(!missing.length){host.append(el("p","You own enough copies of every listed card. No additional purchases needed."));return}
  const priceMap=new Map(),names=missing.map(x=>x.name);
  let pricingError="";
  try{
   for(let i=0;i<names.length;i+=150){
    if(i)await new Promise(resolve=>setTimeout(resolve,650));
    const priceData=await fieldPost("prices",{names:names.slice(i,i+150)});
    for(const card of priceData.cards||[])priceMap.set(norm(card.name),card);
   }
  }catch(err){pricingError=err.message}
  let estimate=0,unpriced=0;const priced=missing.map(c=>{
   const unit=priceMap.get(norm(c.name))?.price;
   if(unit===null||unit===undefined){unpriced++;return {...c,price:null}}
   const value=unit*c.need;estimate+=value;return {...c,price:value,unit}
  }).sort((a,b)=>(b.price||0)-(a.price||0));
  host.append(el("p",(pricingError?"Price lookup unavailable — missing-card list still shown. ":"Estimated additional purchase cost: "+currency(estimate)+". ")+(unpriced?unpriced+" unpriced/unknown card names. ":""),"field-stat"));
  if(pricingError)host.append(el("p",pricingError,"cm-note"));
  host.append(el("p","Based on one reference printing per card, excluding tax, shipping and unpriced cards. Your actual purchase cost may differ.","cm-note"));
  const list=el("div",null,"field-scroll-list");
  for(const c of priced){
   const line=el("div",null,"field-inventory-row");
   const info=el("span",c.need+"× "+c.name);
   line.append(info,el("strong",c.price===null?"PRICE UNKNOWN":currency(c.price)));
   list.append(line);
  }
  host.append(list);
 }catch(e){showFieldError(host,e)}
}
export function initCollection(){
 $("collectionSearch").addEventListener("input",renderInventory);
 $("collectionAddForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget;
  try{requireProfile();await fieldPost("collection_edit",{name:f.elements.name.value,quantity:Number(f.elements.quantity.value)});
   f.reset();f.elements.quantity.value="1";await loadCollection();msg("Collection updated.")}
  catch(err){msg(err.message,true)}
 });
 $("collectionImportButton").addEventListener("click",async()=>{
  if(busy)return;busy=true;const button=$("collectionImportButton"),status=$("collectionImportStatus");
  button.disabled=true;
  try{
   requireProfile();
   const file=$("collectionCsvFile").files[0];
   if(file&&file.size>260000)throw Error("CSV file is too large (260 KB limit).");
   const raw=file?await file.text():$("collectionImportText").value;
   const records=parseImport(raw);
   if(records.length>2500)throw Error("2,500-card maximum.");
   if(!confirm("Import "+records.length+" unique card names? Matching quantities will be updated; all other saved cards stay as they are."))return;
   for(let i=0;i<records.length;i+=100){
    status.textContent="Importing "+Math.min(i+100,records.length)+" of "+records.length+" cards…";
    await fieldPost("collection_import",{mode:"merge",cards:records.slice(i,i+100)});
   }
   status.textContent="Import completed: "+records.length+" unique card names.";
   $("collectionImportText").value="";$("collectionCsvFile").value="";
   await loadCollection();
  }catch(e){status.textContent="Import stopped: "+e.message+". Previously completed batches remain saved."}
  finally{busy=false;button.disabled=false}
 });
 $("collectionClearButton").addEventListener("click",async()=>{
  try{
   requireProfile();if(prompt("This deletes ALL cards in your private collection. Type ERASE COLLECTION to confirm:")!=="ERASE COLLECTION")return;
   await fieldPost("collection_clear",{confirm:"ERASE COLLECTION"});await loadCollection();msg("Your saved card collection was cleared.");
  }catch(e){msg(e.message,true)}
 });
 $("collectionCostButton").addEventListener("click",assessCompletion);
}
