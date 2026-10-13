// Email recovery frontend. All credentials stay in memory or explicit session sign-in.
// A verified email receives only one-time codes; never email long-lived keys.
import {$,state,msg,saveSession} from "./community.js";
let recoverChallenge="",recoverEmail="",verifyChallenge="";
const err=x=>x instanceof Error?x.message:String(x);
async function request(body,authenticated=false){
 const headers={"Content-Type":"application/json"};
 if(authenticated&&state.key)headers.Authorization="Bearer "+state.key;
 const res=await fetch("/api/profile-recovery",{method:"POST",headers,cache:"no-store",credentials:"same-origin",body:JSON.stringify(body)});
 // Edge errors sometimes return an HTML error document, not JSON. Explain that
 // clearly rather than displaying a confusing "Unexpected token '<'" exception.
 let data;
 try{
  const type=res.headers.get("Content-Type")||"";
  if(!type.toLowerCase().includes("application/json"))throw Error("non-json");
  data=await res.json();
 }catch{
  throw Error("The recovery service returned an unexpected response (HTTP "+res.status+"). Refresh the page and try again. If it continues, contact Deep Cuts EDH support.");
 }
 if(!res.ok)throw Error(data.error||"Recovery service unavailable (HTTP "+res.status+").");
 return data;
}
async function status(){
 const dest=$("linkedEmailStatus");
 if(!dest||!state.me)return;
 try{
  const headers={};if(state.key)headers.Authorization="Bearer "+state.key;
  const res=await fetch("/api/profile-recovery",{headers,credentials:"same-origin",cache:"no-store"});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"Recovery settings unavailable.");
  dest.textContent=data.verified
   ?"Verified recovery address: "+(data.maskedEmail||"Connected")+". "+(data.emailSendingReady?"Recovery enabled.":"Sending not configured; recovery unavailable.")
   :data.pending
    ?"Recovery email staged: "+(data.pendingMaskedEmail||"private address")+". NOT YET ACTIVE FOR ACCOUNT RECOVERY. Once the email sender is configured, re-enter the address below and verify the code while signed in."
    :data.emailSendingReady
     ?"No recovery email verified. Add one below to enable email-based account recovery."
     :"Email recovery setup is not yet active. You can register and use your key normally, but the owner must configure an email sender before verification can be completed.";
 }catch(e){dest.textContent="Unable to check recovery status: "+err(e)}
}
async function showKoFiAdFreeStatus(){
 const target=$("koFiAdFreeStatus");
 if(!target||!state.me)return;
 try{
  const headers={Accept:"application/json"};
  if(state.key)headers.Authorization="Bearer "+state.key;
  const res=await fetch("/api/ad-entitlement",{credentials:"same-origin",cache:"no-store",headers});
  const data=await res.json();
  if(!res.ok||data.unavailable)throw Error("Unable to check supporter status.");
  if(data.adFree){
   const end=data.paidUntil?new Date(data.paidUntil*1000).toLocaleDateString():"the paid membership period";
   target.textContent="✓ Monthly Ko-fi supporter confirmed. Ads are disabled for your verified account through "+end+". Remember this device to remain ad-free across the website.";
  }else if(data.verifiedEmail){
   target.textContent="Your email is verified. Ad-free browsing activates when a matching monthly Ko-fi payment is confirmed. Already paying monthly? Contact deepcutsedh@gmail.com to reconcile an older subscription.";
  }else{
   target.textContent="Monthly Ko-fi supporters browse ad-free after verifying the same email used for payment. Complete the email verification below, then remember this device.";
  }
 }catch{
  target.textContent="Ko-fi supporter status is temporarily unavailable. You can still verify your account email below.";
 }
}
export function refreshEmailStatus(){
 if(!state.me)return;
 status();
 showKoFiAdFreeStatus();
}
function display(text,isError=false){
 const target=$("recoverMessage");
 if(target)target.textContent=text;
 msg(text,isError);
}
export async function offerEmail(email){
 const box=$("linkedEmailStatus"),input=$("linkEmailForm")?.elements.email;
 if(!email||!state.me||!input)return;
 input.value=email;
 try{
  const d=await request({action:"start_verify",email},true);
  verifyChallenge=d.requestId;$("verifyEmailForm").hidden=false;
  $("linkedEmailStatus").textContent=d.message+" Enter it below to connect your account.";
 }catch(e){
  if(box)box.textContent="Profile created. Email was not linked: "+err(e)+" You can try again from this profile later.";
 }
}
export function initializeRecovery(){
 const link=$("linkEmailForm"),verify=$("verifyEmailForm"),lost=$("recoverStartForm"),finish=$("recoverFinishForm");
 if(!link||!verify||!lost||!finish)return;
 link.addEventListener("submit",async ev=>{
  ev.preventDefault();const button=link.querySelector('button[type="submit"]');button.disabled=true;
  try{const x=await request({action:"start_verify",email:link.elements.email.value},true);
   verifyChallenge=x.requestId;verify.hidden=false;
   $("linkedEmailStatus").textContent="An 8-digit code was sent to the address above. It expires in 15 minutes.";
   verify.elements.code.focus();
  }catch(e){$("linkedEmailStatus").textContent=err(e)}finally{button.disabled=false}
 });
 verify.addEventListener("submit",async ev=>{
  ev.preventDefault();const button=verify.querySelector('button[type="submit"]');button.disabled=true;
  try{await request({action:"finish_verify",requestId:verifyChallenge,code:verify.elements.code.value.trim()},true);
   verifyChallenge="";verify.hidden=true;verify.reset();link.reset();
   await status();await showKoFiAdFreeStatus();msg("Recovery email verified.");
  }catch(e){$("linkedEmailStatus").textContent=err(e)}finally{button.disabled=false}
 });
 lost.addEventListener("submit",async ev=>{
  ev.preventDefault();const button=lost.querySelector('button[type="submit"]');button.disabled=true;
  recoverEmail=lost.elements.email.value.trim();
  const token=lost.querySelector('input[name="cf-turnstile-response"]')?.value||"";
  try{
   const x=await request({action:"start_recovery",email:recoverEmail,token});
   recoverChallenge=x.requestId;finish.hidden=false;display(x.message);
   finish.elements.code.focus();
  }catch(e){display(err(e),true)}finally{
   button.disabled=false;
   // Cloudflare Turnstile: reset the widget associated with this form only.
   if(window.turnstile?.getResponse) {
    const widget=lost.querySelector(".cf-turnstile");
    if(widget){try{window.turnstile.reset(widget)}catch{}}
   }
  }
 });
 finish.addEventListener("submit",async ev=>{
  ev.preventDefault();const button=finish.querySelector('button[type="submit"]');button.disabled=true;
  try{
   const x=await request({action:"finish_recovery",email:recoverEmail,requestId:recoverChallenge,code:finish.elements.code.value.trim()});
   const key=x.key;recoverChallenge="";recoverEmail="";finish.reset();lost.reset();finish.hidden=true;
   await saveSession(key,true); // Recovery remembers the newly authorized browser.
   const box=$("profileRecoveryKeyBox"),container=$("accountLoggedIn");
   container.prepend(box);$("profileRecoveryKey").value=key;box.hidden=false;
   display("Recovery completed. Save the newly issued key. The previous key no longer works.");
   box.scrollIntoView({block:"center",behavior:"smooth"});
  }catch(e){display(err(e),true)}finally{button.disabled=false}
 });
 $("copyRecoveryKey").addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText($("profileRecoveryKey").value);msg("New recovery key copied. Store it privately.")}
  catch{msg("Select the key and copy it manually.",true)}
 });
}
