/* All supporter checkout destinations are Ko-fi. Never send a visitor to
 * the retired Stripe test catalogue. A public Ko-fi visit is not equivalent
 * to verified eligibility for Field Office premium tools. */
(() => {
"use strict";
const config=window.DEEP_CUTS_SUPPORT||{};
const url=(()=>{
 try{const u=new URL(config.pageURL);return u.protocol==="https:"&&u.hostname==="ko-fi.com"&&u.pathname==="/deepcutsedh"?u.href:null}catch{return null}
})();
const checkout=document.getElementById("supportCheckout");
const message=document.getElementById("supportCheckoutMessage");
const disclosure=document.getElementById("supportDisclosure");
if(checkout){
 if(url){checkout.href=url;checkout.hidden=false;checkout.textContent="VISIT OUR KO-FI PAGE ↗";checkout.target="_blank";checkout.rel="noopener noreferrer"}
 else checkout.hidden=true;
}
if(message)message.textContent="Support us on Ko-fi. Premium Field Office access is being connected separately; Ko-fi payments do not issue Deep Cuts membership keys yet.";
if(disclosure)disclosure.textContent="Membership prices shown here are planned. Confirm tier details and billing on Ko-fi before paying. The Ko-fi-to-Field-Office access integration is not yet active.";
for(const button of document.querySelectorAll(".support-tier-checkout")){
 const tier=config.tiers?.[button.dataset.tier];
 if(url&&tier&&tier.verified===true&&config.membershipAccessReady===true){
  button.hidden=false;button.href=url;button.textContent="VIEW MEMBERSHIP ON KO-FI ↗";button.target="_blank";button.rel="noopener noreferrer";
 }else button.hidden=true;
}
const manage=document.getElementById("supportManageBilling");
const manageNote=document.getElementById("supportManageNote");
if(manage)manage.hidden=true;
if(manageNote)manageNote.textContent="Members manage and cancel recurring payments through their Ko-fi account and connected payment provider.";
})();
