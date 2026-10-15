/* Rescue Report archive: render all dynamic fields as DOM text, never HTML. */
const reportUrls={chainer:"reports/chainer-dementia-master.html","alena-gilanra":"reports/alena-and-gilanra.html",mustard:"reports/commander-mustard.html",ekthi:"reports/ekthi-contaminator-priest.html"};
const issueNo={chainer:"001","alena-gilanra":"002",mustard:"003",ekthi:"004"};
const commanders=(window.DEEP_CUTS||[]).filter(c=>c.status==="published"&&Object.hasOwn(reportUrls,c.id)).sort((a,b)=>issueNo[b.id].localeCompare(issueNo[a.id]));
const archiveGrid=document.getElementById("archiveGrid"),searchInput=document.getElementById("searchInput"),colorFilter=document.getElementById("colorFilter"),count=document.getElementById("resultsCount"),dialog=document.getElementById("caseDialog"),modalBody=document.getElementById("modalBody");
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
const pip=l=>node("span",l,"pip pip-"+l);
const cardColorPips=colors=>{const n=node("div",null,"card-colors");for(const color of colors)n.append(pip(color));return n};
const link=(text,href,cls)=>{const a=node("a",text,cls);a.href=href;return a};
const external=(text,href,cls)=>{const a=link(text,href,cls);a.target="_blank";a.rel="noopener noreferrer";return a};
function buildTile(c){
 const theme=c.colors.includes("B")?"ink":c.colors.includes("G")?"wood":c.colors.includes("U")?"tide":c.colors.includes("R")?"ember":"bone";
 const article=node("article",null,"archive-card theme-"+theme);
 const top=node("div",null,"card-top");
 top.append(node("span","CASE "+issueNo[c.id]),node("span",c.preview?"PRE-RELEASE GUIDE":"PUBLISHED","card-status"+(c.preview?" status-future":"")));
 const mark=node("div",c.name[0],"card-mark");mark.append(node("span","✳"));mark.setAttribute("aria-hidden","true");
 const data=node("div",null,"card-data");data.append(cardColorPips(c.colors),node("span",c.kind.toUpperCase(),"card-type"));
 const title=node("h3");
 const scryfall="https://scryfall.com/search?q="+encodeURIComponent('!"'+c.full+'"')+"&unique=cards";
 const cardLink=external(c.name,scryfall,"dc-card-link archive-card-name");
 cardLink.title="View "+c.full+" on Scryfall";title.append(cardLink);
 data.append(title,node("p",c.headline));
 const bottom=node("div",null,"card-bottom");
 const report=link("READ REPORT ↗",reportUrls[c.id],"archive-read");report.setAttribute("aria-label","Read "+c.name+" Rescue Report");
 bottom.append(node("span","DEEP CUT"),report);
 article.append(top,mark,data,bottom);
 return article;
}
function render(){
 const q=searchInput.value.trim().toLowerCase(),cf=colorFilter.value;
 const selected=commanders.filter(c=>{const blob=[c.name,c.full,c.headline,c.pitch,c.hook,c.kind,c.badge,...c.tech].join(" ").toLowerCase();return(!q||blob.includes(q))&&(cf==="all"||(cf==="multi"?c.colors.length>1:c.colors.includes(cf)))});
 archiveGrid.replaceChildren(...selected.map(buildTile));
 count.textContent=selected.length+" "+(selected.length===1?"PUBLISHED REPORT":"PUBLISHED REPORTS");
 document.getElementById("emptyState").hidden=selected.length!==0;
}
function openCase(id){
 const c=commanders.find(x=>x.id===id);
 if(!c)return;
 if(reportUrls[id]){location.href=reportUrls[id];return}
 // Fallback modal for future cases without a dedicated article.
 modalBody.replaceChildren();
 const titleRow=node("div",null,"modal-title-row");
 const h2=node("h2",c.name);h2.id="modalTitle";titleRow.append(h2,cardColorPips(c.colors));
 const diagnosis=node("div",null,"modal-diagnosis");diagnosis.append(node("span","THE PREMISE"),node("p",c.pitch));
 const two=node("div",null,"modal-two-col");
 for(const [heading,value] of [["THE ANGLE",c.hook],["THE PROBLEM",c.risk]]){
  const col=node("div");col.append(node("span",heading,"modal-minilabel"),node("p",value));two.append(col);
 }
 const tech=node("div",null,"modal-tech");
 tech.append(node("span","POTENTIAL TECH · NOT A VERIFIED DECKLIST","modal-minilabel"));
 const ul=node("ul");for(const card of c.tech)ul.append(node("li",card));tech.append(ul);
 const footer=node("div",null,"modal-footer");
 footer.append(node("span",c.status==="upcoming"?"UPCOMING CARD · CHECK LEGALITY AT RELEASE":"FULL REPORT COMING LATER"));
 footer.append(external("SCRYFALL ↗","https://scryfall.com/search?q="+encodeURIComponent('!"'+c.full+'"')));
 footer.append(external("TCGPLAYER ↗","https://www.tcgplayer.com/search/magic/product?productLineName=magic&q="+encodeURIComponent(c.name)+"&view=grid"));
 footer.append(external("MOXFIELD ↗","https://www.moxfield.com/"));
 footer.append(external("MTGGOLDFISH ↗","https://www.mtggoldfish.com/deck_searches/new"));
 modalBody.append(node("div",c.badge.toUpperCase()+" · DEEP CUT","modal-eyebrow"),titleRow,node("p",c.headline,"modal-tagline"),diagnosis,two,tech,footer);
 dialog.showModal();
}
searchInput.addEventListener("input",render);
colorFilter.addEventListener("change",render);
document.getElementById("surpriseBtn").addEventListener("click",()=>{if(commanders.length)openCase(commanders[Math.floor(Math.random()*commanders.length)].id)});
document.getElementById("closeDialog").addEventListener("click",()=>dialog.close());
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
document.getElementById("clearFilters").addEventListener("click",()=>{searchInput.value="";colorFilter.value="all";render()});
render();
