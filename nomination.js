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
      const {candidates,leader,pendingCount}=await response.json();
      const pendingEl=document.getElementById("pendingNominationCount");if(pendingEl)pendingEl.textContent=pendingCount>0?pendingCount+" new "+(pendingCount===1?"nomination":"nominations")+" awaiting review":"";
      board.replaceChildren();
      for(const [index,entry] of candidates.slice(0,16).entries()){
        const row=document.createElement("div");row.className="leader-entry";
        const rank=document.createElement("span");rank.className="leader-entry-rank";rank.textContent=String(index+1).padStart(2,"0");
        const name=document.createElement("span");name.className="leader-entry-name";name.textContent=entry.name;
        const score=document.createElement("span");score.className="leader-entry-votes";score.textContent=entry.votes+" "+(entry.votes===1?"NOMINATION":"NOMINATIONS");
        row.append(rank,name,score);board.append(row);
      }
      if(!candidates.length){const p=document.createElement("p");p.className="nomination-loading";p.textContent="No approved nominations yet.";board.append(p)}
      spotlightName.textContent=leader?leader.name:"The next rescue is undecided";
      spotlightVotes.textContent=leader?leader.votes+" community "+(leader.votes===1?"nomination":"nominations")+" so far":"Nominate a commander to put it on the board.";
    }catch{
      board.replaceChildren();const p=document.createElement("p");p.className="nomination-loading";
      p.textContent="The live nominations board is unavailable. Try Refresh.";board.append(p);
      spotlightName.textContent="Nominations temporarily unavailable";
      spotlightVotes.textContent="Live database connection required.";
    }
  }
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
