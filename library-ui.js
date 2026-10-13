/* Card Library: quick search stays prominent; expanded pricing and sorting in a fold. */
(() => {
 const form=document.getElementById("librarySearch"),query=document.getElementById("cardQuery");
 if(!form||!query)return;
 const row=query.closest(".tool-controls");if(!row)return;
 row.classList.add("library-quick-filters");
 const details=document.createElement("details");details.className="workbench-fold library-advanced";
 const summary=document.createElement("summary");summary.textContent="More filters, price & sorting";
 const advanced=document.createElement("div");advanced.className="tool-controls";
 details.append(summary,advanced);row.after(details);
 const moved=["identityFilter","rarityFilter","maxMana","minPrice","maxPrice","sortFilter","printingFilter"];
 moved.forEach(id=>{
  const element=document.getElementById(id);
  if(element?.parentElement)advanced.append(element.parentElement);
 });
 const isActive=()=>moved.some(id=>{
  const element=document.getElementById(id);if(!element)return false;
  if(id==="sortFilter")return element.value!=="edhrec-asc";
  if(id==="printingFilter")return element.value!=="cards";
  return Boolean(element.value);
 });
 const update=()=>details.classList.toggle("has-filters",isActive());
 moved.forEach(id=>{
  const element=document.getElementById(id);
  element?.addEventListener("change",update);
  if(element?.tagName==="INPUT")element.addEventListener("input",update);
 });
 document.getElementById("libraryReset")?.addEventListener("click",()=>setTimeout(update,0));
 const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent="SEARCH CARDS ↗";
 const box=query.closest(".span-two");if(box)box.style.gridColumn="span 2";
 if(location.search)details.open=true;
 update();
})();