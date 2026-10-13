/* Owner-only ad-free reconciliation for legacy monthly Ko-fi supporters. */
(()=>{
 const form=document.getElementById("ownerAdFreeForm");
 const output=document.getElementById("ownerAdFreeStatus");
 if(!form||!output)return;
 const expiry=form.elements.paidThrough,now=new Date();
 const iso=d=>d.toISOString().slice(0,10);
 const max=new Date(now.getTime()+62*86400000);
 expiry.min=iso(now);expiry.max=iso(max);
 expiry.value=iso(new Date(now.getTime()+30*86400000));
 const select=form.elements.action;
 select.addEventListener("change",()=>{
  const grant=select.value==="grant";
  expiry.required=grant;expiry.disabled=!grant;
  form.elements.confirmedPayment.disabled=!grant;
 });
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  const secret=document.getElementById("opsForm")?.elements?.operatorKey?.value?.trim()||"";
  if(!/^dcissuer1_[0-9a-f]{64}$/.test(secret)){output.textContent="Enter the independent owner key at the top of this page.";return}
  const action=select.value,button=form.querySelector('button[type="submit"]');
  const email=String(form.elements.email.value||"").trim();
  if(action==="grant"&&!form.elements.confirmedPayment.checked){output.textContent="Confirm you verified the real monthly payment in Ko-fi before granting.";return}
  button.disabled=true;output.textContent="Verifying owner access and saving this record…";
  try{
   const res=await fetch("/api/ad-entitlement",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+secret},
    body:JSON.stringify({action,email,paidThrough:expiry.value,confirmedPayment:form.elements.confirmedPayment.checked})
   });
   const data=await res.json();
   if(!res.ok)throw Error(data.error||"Couldn't save the ad-free record.");
   output.textContent=data.notice||"Ad-free entitlement updated.";
   form.elements.confirmedPayment.checked=false;
  }catch(e){output.textContent=e.message||"Request failed."}
  finally{button.disabled=false}
 });
})();
