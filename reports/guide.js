/* Deep Cuts Rescue Report starter-core actions; no server or account required. */
(() => {
 // Moxgate CTA safeguard: newly published guides using the shared report script
 // also receive the hero action if an editor omits the standard HTML block.
 const hero=document.querySelector(".report-hero");
 const card=hero?.querySelector(".report-hero-media");
 if(hero&&card&&!hero.querySelector(".report-moxgate-cta")){
  let right=card.closest(".report-hero-right");
  if(!right){
   right=document.createElement("div");
   right.className="report-hero-right";
   card.parentElement.insertBefore(right,card);
   right.append(card);
  }
  const cta=document.createElement("div");
  cta.className="report-moxgate-cta";
  const link=document.createElement("a");
  link.className="report-moxgate-button";
  link.href="https://www.moxgate.com/";
  link.target="_blank";
  link.rel="noopener noreferrer";
  link.textContent="PLAY FREE ON MOXGATE ↗";
  link.setAttribute("aria-label","Open Moxgate for free deckbuilding and play (new tab)");
  const caption=document.createElement("p");
  const preview=!!document.querySelector(".report-availability")||/"preview"\s*:\s*true/.test(document.getElementById("rescue-data")?.textContent||"");
  caption.textContent=preview?"Explore free browser deckbuilding and play. Check this preview card's release and Commander legality first.":"Build and play your own version of this Commander deck for free—solo or with friends.";
  cta.append(link,caption);
  right.append(cta);
 }
 const dataEl=document.getElementById("rescue-data");
 if(!dataEl)return;
 let data;try{data=JSON.parse(dataEl.textContent)}catch{return}
 const rows=document.getElementById("guideCoreRows");
 const $=id=>document.getElementById(id);
 if(rows){
  for(const entry of data.core){
   const tr=document.createElement("tr"),role=document.createElement("td"),name=document.createElement("td"),a=document.createElement("a");
   role.textContent=entry[0];a.textContent=entry[1];
   a.href="https://scryfall.com/search?q="+encodeURIComponent('!"'+entry[1]+'"');
   a.target="_blank";a.rel="noopener noreferrer";name.append(a);tr.append(role,name);rows.append(tr);
  }
 }
 const text=()=>{
  const groups=new Map();
  for(const [,name] of data.core){
   if(data.commanders.includes(name))continue;
   groups.set(name,(groups.get(name)||0)+1);
  }
  return "Commander\n"+data.commanders.map(n=>"1 "+n).join("\n")+"\n\n"+[...groups].map(([n,q])=>q+" "+n).join("\n");
 };
 const say=s=>{const msg=$("reportCopyFeedback");if(msg)msg.textContent=s};
 $("reportCopy")?.addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(text());say("Starter core copied, including commander(s).")}catch{say("Clipboard unavailable—select the cards from the table.")}
 });
 $("reportOpenWorkshop")?.addEventListener("click",()=>{
  if(data.preview){
   say("Pre-release card: copy the preview core and build after Commander legality begins.");
   return;
  }
  try{
   const current=JSON.parse(localStorage.getItem("deepcuts-deck-v1")||"null");
   if(current?.cards?.length&&!confirm("Replace your current Workshop deck with this incomplete starter core? Export or save your existing deck first."))return;
   const list=data.core.filter(([,name])=>!data.commanders.includes(name)).map(([,name])=>({name,qty:1,card:null}));
   const deck={commanders:data.commanders,cards:list,targetBracket:2};
   localStorage.setItem("deepcuts-deck-v1",JSON.stringify(deck));
   localStorage.setItem("deepcuts-workbench-tab","deck");
   location.href="../deck.html#deck";
  }catch(e){say("Browser storage was unavailable; copy the starter core instead.")}
 });
})();
