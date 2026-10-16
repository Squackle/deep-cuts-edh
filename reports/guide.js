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
 // Real community evidence is already moderated and tied to published case slugs.
 // Place it near the end, collapsed by default. Never request the full evidence
 // list until the visitor explicitly opens the disclosure.
 const allowedCases=new Set(["chainer-dementia-master","alena-and-gilanra","commander-mustard","ekthi-contaminator-priest"]);
 const slug=location.pathname.split("/").pop()?.replace(/\.html$/,"")||"";
 if(allowedCases.has(slug)){
  const anchor=document.querySelector(".report-references")||document.querySelector(".report-next");
  const container=document.querySelector(".report-content");
  if(container&&!document.getElementById("reportCommunityFindings")){
   const fold=document.createElement("details");fold.id="reportCommunityFindings";fold.className="report-community-fold";
   const title=document.createElement("summary");title.textContent="COMMUNITY FINDINGS & CASE DISCUSSION";
   const content=document.createElement("div");content.className="report-community-content";
   const notice=document.createElement("p");notice.textContent="Open to see what other investigators have found.";
   const results=document.createElement("div");results.className="report-community-results";results.setAttribute("aria-live","polite");
   const actions=document.createElement("div");actions.className="report-community-actions";
   const all=document.createElement("a");all.href="../community?case="+encodeURIComponent(slug)+"&evidence=1";all.textContent="VIEW ALL FINDINGS ↗";
   const follow=document.createElement("a");follow.href="../community?case="+encodeURIComponent(slug);follow.textContent="FOLLOW / DISCUSS THIS CASE ↗";
   actions.append(all,follow);
   content.append(notice,results,actions);fold.append(title,content);
   if(anchor)anchor.before(fold);else container.append(fold);
   let loaded=false,pending=false;
   fold.addEventListener("toggle",async()=>{
    if(!fold.open||loaded||pending)return;
    pending=true;notice.textContent="Checking the Evidence Board…";
    try{
     const u=new URL("/api/field-expansion",location.origin);
     u.searchParams.set("action","evidence");u.searchParams.set("case",slug);
     const response=await fetch(u,{headers:{Accept:"application/json"},credentials:"same-origin",cache:"no-store"});
     if(!response.ok)throw Error("Evidence Board unavailable");
     const data=await response.json();
     if(!Array.isArray(data.items))throw Error("Unexpected evidence response");
     loaded=true;results.replaceChildren();
     if(!data.items.length){notice.textContent="No community findings yet. You can file the first one through the Community Evidence Board.";return}
     notice.textContent=data.items.length+" public "+(data.items.length===1?"finding":"findings")+". A few highlights:";
     for(const item of data.items.slice(0,3)){
      if(typeof item.title!=="string"||typeof item.body!=="string"||!/^[a-f0-9]{32}$/.test(item.id||""))continue;
      const row=document.createElement("div");row.className="report-community-item";
      const h=document.createElement("strong");h.textContent=item.title.slice(0,100);
      const body=document.createElement("p");body.textContent=item.body.slice(0,180)+(item.body.length>180?"…":"");
      const meta=document.createElement("span");meta.textContent="Filed by @"+String(item.handle||"investigator").slice(0,30)+(item.status==="featured"?" · Editor featured":"");
      const read=document.createElement("a");read.href="../community?case="+encodeURIComponent(slug)+"&evidence="+item.id;read.textContent="OPEN FINDING ↗";
      row.append(h,body,meta,read);results.append(row);
     }
    }catch{notice.textContent="The Evidence Board is temporarily unavailable. You can still open Community to contribute."}
    finally{pending=false}
   });
  }
 }
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

})();
