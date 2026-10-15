// Render the report table through DOM text nodes; never parse card names as HTML.
document.addEventListener("DOMContentLoaded",()=>{
  const rows=window.CHAINER_CORE||[];
  const body=document.getElementById("coreRows");
  if(!body)return;
  const fragment=document.createDocumentFragment();
  for(const [role,name] of rows){
    const tr=document.createElement("tr"),roleCell=document.createElement("td"),nameCell=document.createElement("td");
    roleCell.textContent=String(role);
    nameCell.textContent=String(name);
    tr.append(roleCell,nameCell);fragment.append(tr);
  }
  body.replaceChildren(fragment);
  document.getElementById("copyCore")?.addEventListener("click",async()=>{
    const t=rows.map(x=>"1 "+x[1]).join("\n");
    const feedback=document.getElementById("copyFeedback");
    try{
      await navigator.clipboard.writeText(t);
      if(feedback)feedback.textContent="Copied incomplete sample core.";
    }catch{
      if(feedback)feedback.textContent="Copy unavailable; select the cards above.";
    }
  });
});
