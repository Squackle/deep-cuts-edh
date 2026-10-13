/* Owner-only case finding moderation, using the existing independent issuer key. */
(() => {
 const form=document.getElementById("ownerEvidenceForm"),status=document.getElementById("ownerEvidenceStatus");
 if(!form||!status)return;
 form.addEventListener("submit",async e=>{
  e.preventDefault();
  const secret=document.getElementById("opsForm")?.elements?.operatorKey?.value?.trim();
  const id=form.elements.evidenceId.value.trim();
  if(!secret||!/^dcissuer1_[a-f0-9]{64}$/.test(secret)){status.textContent="Enter the private owner key at the top of this page.";return}
  if(!/^[a-f0-9]{32}$/.test(id)){status.textContent="Enter a valid finding ID.";return}
  const button=form.querySelector("button[type=submit]");button.disabled=true;
  status.textContent="Saving case finding status…";
  try{
   const r=await fetch("/api/field-expansion",{method:"POST",cache:"no-store",credentials:"same-origin",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+secret},
    body:JSON.stringify({action:"feature_evidence",id,status:form.elements.status.value})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||"Owner moderation request failed.");
   status.textContent=data.changed?"Finding updated. Refresh the public Evidence Board to see the change.":"No finding matched that ID.";
  }catch(err){status.textContent=err.message}
  finally{button.disabled=false}
 });
})();