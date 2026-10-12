/* Supporter checkout appears only after a validated, owner-configured URL is supplied. */
(() => {
"use strict";
const settings=window.DEEP_CUTS_SUPPORT||{};
const link=document.getElementById("supportCheckout");
const message=document.getElementById("supportCheckoutMessage");
if(!link||!message)return;
const raw=typeof settings.checkoutURL==="string"?settings.checkoutURL.trim():"";
let safe=null;
try {
 if(raw){const url=new URL(raw);const h=url.hostname.toLowerCase();
  if(url.protocol==="https:"&&(
   h==="buy.stripe.com"||h==="checkout.stripe.com"||
   h==="patreon.com"||h==="www.patreon.com"||
   h==="ko-fi.com"||h==="www.ko-fi.com"||
   (h==="github.com"&&url.pathname.startsWith("/sponsors/"))
  ))safe=url.href;
 }
} catch{}
if(safe){
 link.href=safe;link.hidden=false;link.target="_blank";link.rel="noopener noreferrer";
 message.textContent="Secure recurring checkout is provided by the linked payment platform, not by Deep Cuts EDH.";
 message.classList.add("checkout-ready");
}else{
 link.hidden=true;
 message.textContent="Subscriptions are not accepting payments yet. The $5/month tier will open once our secure checkout is connected.";
}
})();