(() => {
  const form=document.getElementById("nominationForm"),board=document.getElementById("nominationLeaderboard"),
    spotlightName=document.getElementById("leaderName"),spotlightVotes=document.getElementById("leaderVotes"),
    feedback=document.getElementById("nominationFeedback"),submit=document.getElementById("nominationSubmit");
  if(!form||!board)return;
  const warn=(message,error=false)=>{feedback.textContent=message;feedback.classList.toggle("error",error)};
  function voterId(){
    const key="deepcuts_voter_id";
    try {
      let id=localStorage.getItem(key);
      if(!id||!/^[-0-9a-f]{36}$/i.test(id)){id=crypto.randomUUID();localStorage.setItem(key,id)}
      return id;
    } catch {return crypto.randomUUID()}
  }
  async function load(){
    try{
      const response=await fetch("/api/nominations",{headers:{Accept:"application/json"},cache:"no-store"});
      if(!response.ok)throw new Error("Unable to load vote totals");
      const {candidates,leader,pendingCount,totalVotes}=await response.json();
      const setText=(id,value)=>{const element=document.getElementById(id);if(element)element.textContent=String(value)};
      setText("nomTotalCount",totalVotes??0);
      setText("nomVotedCandidates",candidates.filter(x=>x.votes>0).length);
      setText("nomPendingCount",pendingCount??0);
      const pendingEl=document.getElementById("pendingNominationCount");if(pendingEl)pendingEl.textContent=pendingCount>0?pendingCount+" new "+(pendingCount===1?"nomination":"nominations")+" awaiting review":"";
      window.DeepCutsGuide?.registerCardNames(candidates.map(x=>x.name));
      board.replaceChildren();
      for(const [index,entry] of candidates.slice(0,25).entries()){
        if(window.DeepCutsRescueBoard?.createNominationEntry){
          board.append(window.DeepCutsRescueBoard.createNominationEntry(entry,index));
        }else{
          const row=document.createElement("div");row.className="leader-entry";
          const rank=document.createElement("span");rank.className="leader-entry-rank";rank.textContent=String(index+1).padStart(2,"0");
          const name=document.createElement("span");name.className="leader-entry-name";name.textContent=entry.name;
          const score=document.createElement("span");score.className="leader-entry-votes";score.textContent=entry.votes+" "+(entry.votes===1?"vote":"votes");
          row.append(rank,name,score);board.append(row);
        }
      }
      if(!candidates.length){const p=document.createElement("p");p.className="nomination-loading";p.textContent="No approved nominations yet.";board.append(p)}
      spotlightName.textContent=leader?leader.name:"The next rescue is undecided";
      spotlightVotes.textContent=leader?leader.votes+" "+(leader.votes===1?"vote":"votes")+" so far":"No approved candidates have votes yet.";
    }catch{
      board.replaceChildren();const p=document.createElement("p");p.className="nomination-loading";
      p.textContent="The live nominations board is unavailable. Try Refresh.";board.append(p);
      spotlightName.textContent="Nominations temporarily unavailable";
      spotlightVotes.textContent="Live database connection required.";
    }
  }
  // Keep the unpublished editorial ideas in the nomination flow, not in the published article archive.
  const ideas=(window.DEEP_CUTS||[]).filter(c=>c.status!=="published");
  const list=document.getElementById("nominationSuggestionList"),datalist=document.getElementById("nominationSuggestions");
  if(datalist){
    for(const idea of ideas){const option=document.createElement("option");option.value=idea.full;datalist.append(option)}
  }
  if(list){
    for(const idea of ideas){
      const box=document.createElement("div");box.className="nomination-suggestion";
      const title=document.createElement("a");title.textContent=idea.name;title.className="dc-card-link";
      title.href=window.DeepCutsGuide?.scryfallUrl(idea.full)||"https://scryfall.com/search?q="+encodeURIComponent('!"'+idea.full+'"');
      title.target="_blank";title.rel="noopener noreferrer";title.title="View "+idea.full+" on Scryfall";
      const detail=document.createElement("span");detail.textContent=idea.kind+(idea.status==="upcoming"?" · upcoming":"");
      const button=document.createElement("button");button.type="button";button.className="nomination-suggestion-action";
      button.textContent="NOMINATE ↗";button.setAttribute("aria-label","Nominate "+idea.full);
      button.addEventListener("click",()=>{
        document.getElementById("nomCommander").value=idea.full;
        document.getElementById("nomReason").focus();
        document.getElementById("nominationForm").scrollIntoView({behavior:"smooth",block:"center"});
      });
      box.append(title,detail,button);list.append(box);
    }
  }
  window.DeepCutsRescueBoard?.renderPublished(document.getElementById("rescuePublishedList"));
  document.getElementById("refreshNominations")?.addEventListener("click",load);
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const widget=window.turnstile;
    const token=widget?.getResponse?.();
    if(!token){warn("Complete the human verification first.",true);return}
    submit.disabled=true;warn("Saving your nomination…");
    const payload={
      commander:form.elements.commander.value,
      reason:form.elements.reason.value,
      strategy:form.elements.strategy.value,
      cards:form.elements.cards.value,
      budget:form.elements.budget.value,
      visitorId:voterId(),turnstileToken:token
    };
    try{
      const response=await fetch("/api/nominations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Unable to submit nomination");
      warn(data.message||"Nomination saved.");
      if(data.recorded){form.reset();await load()}
    }catch(err){warn(err.message||"Please try again.",true)}
    finally{submit.disabled=false;widget?.reset?.()}
  });
  load();
})();
