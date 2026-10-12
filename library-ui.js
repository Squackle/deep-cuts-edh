/* Keep the primary card search and format legality visible; tuck away advanced controls. */
(() => {
 const form=document.getElementById("librarySearch"),query=document.getElementById("cardQuery");
 if(!form||!query)return;
 const row=query.closest(".tool-controls");
 if(!row)return;
 row.classList.add("library-quick-filters");
 const details=document.createElement("details");details.className="workbench-fold library-advanced";
 const summary=document.createElement("summary");summary.textContent="More filters & sorting";
 const advanced=document.createElement("div");advanced.className="tool-controls";
 details.append(summary,advanced);row.after(details);
 for(const id of ["identityFilter","rarityFilter","maxMana","maxPrice","sortFilter"]){
  const el=document.getElementById(id);if(el?.parentElement)advanced.append(el.parentElement);
 }
 for(const id of ["rarityFilter","identityFilter","maxMana","maxPrice","sortFilter"]){
  const el=document.getElementById(id);
  el?.addEventListener("change",()=>details.classList.toggle("has-filters",[
   document.getElementById("rarityFilter").value,
   document.getElementById("identityFilter").value,
   document.getElementById("maxMana").value,
   document.getElementById("maxPrice").value,
   document.getElementById("sortFilter").value==="edhrec"?"":document.getElementById("sortFilter").value
  ].some(Boolean)));
 }
 document.getElementById("libraryReset")?.addEventListener("click",()=>details.classList.remove("has-filters"));
 const submit=form.querySelector('button[type="submit"]');
 if(submit)submit.textContent="SEARCH CARDS ↗";
 const box=query.closest(".span-two");if(box)box.style.gridColumn="span 2";
 if(location.search)details.open=true;
})();