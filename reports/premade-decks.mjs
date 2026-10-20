/* Editorial Commander decklists: progressive disclosure, no shopping, no tracking.
   Future standard Rescue Reports auto-inherit the display via guide.js.
   These drafts remain free; purchase readiness is managed separately. */
const make=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
};
const TIERS=[["budget","Budget"],["standard","Standard"],["no-limit","No Limit"]];
const BASICS=new Set(["plains","island","swamp","mountain","forest","wastes",
 "snow-covered plains","snow-covered island","snow-covered swamp",
 "snow-covered mountain","snow-covered forest"]);
const line=parse=>/^\s*(\d{1,3})\s+(\S.*?)\s*$/.exec(parse);
export function checkDraft(tier,commanders){
 if(!tier||!Array.isArray(tier.sections)||!Array.isArray(commanders)||!commanders.length)
  return {ok:false,count:0};
 const seen=new Set();let count=0;
 for(const section of tier.sections){
  if(typeof section.role!=="string"||!section.role||!Array.isArray(section.cards))return {ok:false,count};
  for(const entry of section.cards){
   if(typeof entry!=="string")return {ok:false,count};
   const match=line(entry);
   if(!match)return {ok:false,count};
   const qty=Number(match[1]),name=match[2].toLowerCase();
   if(qty<1||qty>100||seen.has(name)||(!BASICS.has(name)&&qty!==1))return {ok:false,count};
   seen.add(name);count+=qty;
  }
 }
 const commanderLines=tier.sections.filter(s=>s.role==="Commander").flatMap(s=>s.cards);
 return {ok:count===100&&commanderLines.length===commanders.length &&
   commanders.every(c=>commanderLines.includes("1 "+c)),
   count};
}
export function deckText(tier){
 return tier.sections.map(section=>
  "# "+section.role+"\n"+section.cards.join("\n")).join("\n\n");
}
async function loadDrafts(){
 try{
  const res=await fetch(new URL("./premade-decks.json",import.meta.url),{credentials:"omit"});
  if(!res.ok)return {};
  const data=await res.json();
  return data?.schemaVersion===1&&data.cases&&typeof data.cases==="object"?data.cases:{};
 }catch{return {};}
}
function sectionView(info,tier,commanders){
 const list=make("div","premade-role-list");
 for(const group of tier.sections){
  const count=group.cards.reduce((n,entry)=>n+Number(line(entry)[1]),0);
  const groupWrap=make("section","premade-role");
  const heading=make("h4","premade-role-title",group.role+" · "+count);
  const lines=make("ul","premade-card-lines");
  for(const entry of group.cards){
   const match=line(entry);
   const item=make("li",null,match[1]+" × "+match[2]);
   lines.append(item);
  }
  groupWrap.append(heading,lines);
  list.append(groupWrap);
 }
 info.append(list);
 const controls=make("div","premade-actions");
 const copy=make("button","premade-copy","Copy 100-card deck");
 copy.type="button";
 const status=make("span","premade-copy-status","");
 status.setAttribute("role","status");
 status.setAttribute("aria-live","polite");
 copy.addEventListener("click",async()=>{
  try{
   await navigator.clipboard.writeText(tier.sections.flatMap(g=>g.cards).join("\n"));
   status.textContent="Deck copied";
  }catch{status.textContent="Clipboard unavailable; select the cards above.";}
 });
 controls.append(copy,status);
 info.append(controls);
}
export async function mountPremadeDecks(data){
 const container=document.querySelector(".report-content");
 if(!container||!Array.isArray(data?.commanders)||!data.commanders.length ||
    document.querySelector(".premade-decklists"))return;
 const slug=location.pathname.split("/").pop()?.replace(/\.html$/,"")||"";
 if(!/^[a-z0-9-]{1,100}$/.test(slug))return;
 const cases=await loadDrafts();
 const found=cases[slug];
 const box=make("details","premade-decklists");
 box.id="premade-decklists";
 const label=make("summary","premade-summary","SEE DEEPCUTS PREMADE DECKLISTS");
 const inside=make("div","premade-content");
 const intro=make("p","premade-intro",
  "Explore complete builds by role. All decklists are free and optional — prices and affiliate checkout are not live.");
 inside.append(intro);
 const tiers=make("div","premade-tiers");
 for(const [id,title] of TIERS){
  const tier=found?.tiers?.[id],result=checkDraft(tier,data.commanders);
  const details=make("details","premade-tier");
  const summary=make("summary","premade-tier-summary",title+(result.ok?" · 100 cards":" · Coming soon"));
  details.append(summary);
  const body=make("div","premade-tier-body");
  if(result.ok){
   const msg=make("p","premade-unverified",found.preview||data.preview?
    "Preview deck: release status, Commander legality and printing availability must be checked before play or purchase.":
    "Editorial 100-card build. Individual card legality, strategy and prices are not independently verified yet.");
   body.append(msg);
   sectionView(body,tier,data.commanders);
  }else body.append(make("p","premade-unverified","This complete decklist has not been prepared yet. The existing starter core remains free below."));
  details.append(body);
  details.addEventListener("toggle",()=>{
   if(!details.open)return;
   for(const other of tiers.children)if(other!==details)other.open=false;
  });
  tiers.append(details);
 }
 inside.append(tiers);
 box.append(label,inside);
 const anchor=container.querySelector(".report-core-warning") ||
  container.querySelector(".report-references");
 if(anchor)anchor.after(box);else container.append(box);
}
