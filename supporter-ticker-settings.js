/* Optional public supporter credit. This form does not publish a name
   without the member's explicit consent and live Ko-fi eligibility. */
(()=>{"use strict";
 const panel=document.getElementById("supporterCreditSettings");
 if(!panel)return;
 const $=id=>document.getElementById(id),name=$("supporterCreditName"),
  consent=$("supporterCreditConsent"),status=$("supporterCreditStatus"),
  form=$("supporterCreditForm"),remove=$("supporterCreditRemove");
 const key=()=>{try{const v=sessionStorage.getItem("dc-profile-key")||localStorage.getItem("dc-profile-key")||"";
  return /^dcprofile1_[0-9a-f]{32}_[0-9a-f]{64}$/.test(v)?v:""}catch{return ""}};
 const req=async(method,data)=>{
  const token=key(),headers={Accept:"application/json"};
  if(token)headers.Authorization="Bearer "+token;
  if(method==="POST")headers["Content-Type"]="application/json";
  const r=await fetch("/api/supporter-ticker"+(method==="GET"?"?action=mine":""),{
   method,credentials:"same-origin",cache:"no-store",headers,
   ...(method==="POST"?{body:JSON.stringify(data)}:{})
  });
  const j=await r.json();if(!r.ok)throw Error(j.error||"Unable to update public supporter credit.");return j;
 };
 const say=(message,error=false)=>{status.textContent=message;status.dataset.error=error?"true":"false"};
 let busy=false;
 const setBusy=value=>{busy=value;form.querySelector("button[type=submit]").disabled=value;remove.disabled=value};
 const load=async()=>{
  try{
   const d=await req("GET");
   panel.hidden=false;
   name.value=d.displayName||"";
   consent.checked=Boolean(d.visible);
   remove.hidden=!d.visible;
   if(d.eligible)say(d.visible?"Your "+d.tier+" supporter name is currently public.":"Your verified Ko-fi membership is eligible for the supporter ticker.");
   else if(!d.emailVerified)say("Verify your profile email to enable public supporter recognition.");
   else say("We couldn't confirm a current paid Ko-fi tier for your verified profile email. Your name stays private.");
  }catch(e){
   panel.hidden=true; // Signed-out visitors should never see private account controls.
  }
 };
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(busy)return;
  if(!consent.checked)return say("Please check the consent box before publishing your name.",true);
  setBusy(true);
  try{
   const d=await req("POST",{visible:true,displayName:name.value.trim()});
   remove.hidden=false;say("Your "+d.tier+" supporter credit is public. You can remove it here anytime.");
  }catch(e){say(e.message,true)}finally{setBusy(false)}
 });
 remove.addEventListener("click",async()=>{
  if(busy)return;setBusy(true);
  try{await req("POST",{visible:false});consent.checked=false;remove.hidden=true;say("Your public supporter name has been removed.");}
  catch(e){say(e.message,true)}finally{setBusy(false)}
 });
 window.addEventListener("deepcuts:profile-change",()=>load());
 load();
})();