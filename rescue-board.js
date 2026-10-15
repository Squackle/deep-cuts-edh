/* Rescue Board: progressively disclose nomination research without duplicating voting.
 * Nomination status is grounded in the moderated nomination API, while report
 * metadata names only articles that are already published.
 */
(function(){
 "use strict";
 const published=Object.freeze([
  ["Chainer, Dementia Master","chainer-dementia-master"],
  ["Alena & Gilanra","alena-and-gilanra"],
  ["Commander Mustard","commander-mustard"],
  ["Ekthi, Contaminator Priest","ekthi-contaminator-priest"]
 ]);
 const slugSet=new Set(published.map(x=>x[1]));
 const root="/reports/";
 function node(tag,text,cls){
  const n=document.createElement(tag);
  if(text!==undefined&&text!==null)n.textContent=String(text);
  if(cls)n.className=cls;
  return n;
 }
 function link(text,url,cls){
  const a=node("a",text,cls);
  a.href=url;
  return a;
 }
 function fillNomination(commander,forStrategy=false){
  const form=document.getElementById("nominationForm");
  if(!form)return;
  const input=form.elements.namedItem("commander");
  if(!input)return;
  input.value=commander;
  const target=forStrategy?form.elements.namedItem("strategy"):form.elements.namedItem("reason");
  target?.focus();
  form.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"nearest"});
 }
 function createNominationEntry(entry,index){
  const shell=node("details",null,"rescue-board-entry");
  const summary=node("summary",null,"leader-entry rescue-board-summary");
  const rank=node("span",String(index+1).padStart(2,"0"),"leader-entry-rank");
  const identification=node("span",null,"rescue-board-identification");
  identification.append(node("span",entry.name,"leader-entry-name"));
  identification.append(node("span","Nominated · review before publication","rescue-board-status"));
  const votes=node("span",null,"leader-entry-votes");
  votes.append(node("strong",String(entry.votes),"leader-vote-number"),node("small",entry.votes===1?"vote":"votes","leader-vote-label"));
  summary.append(rank,identification,votes);
  const body=node("div",null,"rescue-board-details");
  body.append(node("p","This commander is approved for community voting. A Rescue Report is not scheduled or published automatically."));
  const actions=node("div",null,"rescue-board-actions");
  const submit=node("button","SHARE A BUILD IDEA ↗","rescue-board-action");
  submit.type="button";
  submit.addEventListener("click",()=>fillNomination(entry.name,true));
  actions.append(submit);
  const research=link("FIND DEEP CUTS ↗","/deep-cut-finder?commander="+encodeURIComponent(entry.name),"rescue-board-action rescue-board-action-secondary");
  actions.append(research);
  body.append(actions,node("small","Sharing an idea uses the existing nomination form, including verification and vote limits. Research and brewing remain editorial decisions.","rescue-board-note"));
  shell.append(summary,body);
  return shell;
 }
 function renderPublished(rootElement){
  if(!rootElement)return;
  rootElement.replaceChildren();
  for(const [name,slug] of published){
   const row=node("li",null,"rescue-published-item");
   row.append(link(name,root+slug,"rescue-published-link"));
   row.append(node("span","Published","rescue-published-status"));
   row.append(link("Findings ↗","/community?case="+encodeURIComponent(slug)+"&evidence=1","rescue-published-finding-link"));
   rootElement.append(row);
  }
 }
 window.DeepCutsRescueBoard=Object.freeze({createNominationEntry,renderPublished,fillNomination,published:published.map(x=>({name:x[0],slug:x[1]})),isPublished:slug=>slugSet.has(slug)});
})();
