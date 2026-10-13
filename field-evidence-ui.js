import {$,state,el,msg,appendProfileMentions} from "./community.js";
import {fieldGet,fieldPost,dateLabel,emptyNotice,mentionNode,linkButton,showFieldError} from "./field-client.js";
const reports={
 "chainer-dementia-master":"reports/chainer-dementia-master.html",
 "alena-and-gilanra":"reports/alena-and-gilanra.html",
 "commander-mustard":"reports/commander-mustard.html",
 "ekthi-contaminator-priest":"reports/ekthi-contaminator-priest.html"
};
const categories={synergy:"🔎 HIDDEN SYNERGY",combo:"⚙️ COMBO ENGINE",budget:"💰 BUDGET FIND",weakness:"⚠️ WEAKNESS",matchup:"🎲 MATCHUP DATA"};
let currentCase="chainer-dementia-master",lastLoad=0;
export async function loadEvidenceBoard(){
 const selector=$("evidenceCase"),root=$("evidenceResults");
 if(!selector||!root)return;
 const caseSlug=selector.value,sort=$("evidenceSort").value;
 const marker=++lastLoad;root.replaceChildren(el("p","Opening the case files…","cm-note"));
 const report=$("evidenceReportLink");report.href=reports[caseSlug]||reports["chainer-dementia-master"];
 try{
  const data=await fieldGet("evidence",{case:caseSlug,sort});if(marker!==lastLoad)return;
  root.replaceChildren();currentCase=caseSlug;
  if(!data.items?.length)return emptyNotice(root,"No findings filed for this commander yet. Your research could be the first.");
  const mine=new Set(data.voted||[]);
  for(const item of data.items){
   const article=el("article",null,"cm-card field-evidence-card");
   article.id="finding-"+item.id;
   const top=el("div",null,"field-evidence-top");
   top.append(el("span",categories[item.category]||"CASE FINDING","field-evidence-category"));
   if(item.status==="featured")top.append(el("span","★ EDITOR-FEATURED","field-featured"));
   article.append(top,el("h3",item.title));
   const meta=el("p",null,"field-evidence-meta");
   appendProfileMentions(meta,"Filed by @"+item.handle+" · "+dateLabel(item.created_at));
   article.append(meta);
   if(item.card_name){
    const related=el("p",null,"field-evidence-cardname");
    related.append(el("span","CARD: "));
    const link=linkButton(item.card_name,"https://scryfall.com/search?q="+encodeURIComponent('!"'+item.card_name+'"'));
    link.target="_blank";link.rel="noopener noreferrer";related.append(link);article.append(related);
   }
   article.append(mentionNode(item.body,"p"));
   const footer=el("div",null,"cm-actions");
   const endorse=el("button",(mine.has(item.id)?"✓ ENDORSED":"☆ ENDORSE")+" · "+item.votes,"cm-btn cm-outline");
   endorse.type="button";endorse.disabled=!state.me||(state.me.handle.toLowerCase()===item.handle.toLowerCase());
   if(!state.me)endorse.title="Sign in to endorse this finding";
   endorse.addEventListener("click",async()=>{
    endorse.disabled=true;try{await fieldPost("evidence_vote",{id:item.id});await loadEvidenceBoard()}
    catch(e){msg(e.message,true);endorse.disabled=false}
   });
   footer.append(endorse);
   footer.append(linkButton("OPEN FINDING ↗","community.html?case="+encodeURIComponent(caseSlug)+"&evidence="+item.id));
   if(state.me?.handle?.toLowerCase()===item.handle.toLowerCase()){
    const withdraw=el("button","WITHDRAW","cm-btn cm-outline");withdraw.type="button";
    withdraw.addEventListener("click",async()=>{
     if(!confirm("Withdraw this finding from public view?"))return;
     try{await fieldPost("evidence_withdraw",{id:item.id});await loadEvidenceBoard()}catch(e){msg(e.message,true)}
    });footer.append(withdraw);
   }
   article.append(footer);root.append(article);
  }
  const selected=new URL(location.href).searchParams.get("evidence");
  if(selected&&/^[a-f0-9]{32}$/.test(selected)){
   const item=document.getElementById("finding-"+selected);
   if(item){item.classList.add("field-evidence-highlight");item.scrollIntoView({behavior:"smooth",block:"center"})}
  }
 }catch(e){if(marker===lastLoad)showFieldError(root,e)}
}
export function initEvidenceBoard(){
 const selector=$("evidenceCase");if(!selector)return;
 selector.addEventListener("change",()=>{state.caseSlug=selector.value;loadEvidenceBoard()});
 $("evidenceSort").addEventListener("change",loadEvidenceBoard);
 $("evidenceForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  try{
   if(!state.me)throw Error("Sign in to publish research to the Evidence Board.");
   const data={case:selector.value,category:form.elements.category.value,title:form.elements.title.value,
    cardName:form.elements.cardName.value,body:form.elements.body.value};
   await fieldPost("evidence_post",data);
   form.reset();msg("Evidence submitted to the public case board.");await loadEvidenceBoard();
  }catch(e){msg(e.message,true)}
 });
}
export function alignEvidenceCase(){
 const selector=$("evidenceCase");
 if(selector&&reports[state.caseSlug])selector.value=state.caseSlug;
 return loadEvidenceBoard();
}
