/* Verified live Stripe Payment Link only; checkout itself is hosted by Stripe.
 * This static site never receives or stores card data or Stripe API secrets. */
(() => {
"use strict";
const config=window.DEEP_CUTS_SUPPORT||{};
const $=id=>document.getElementById(id);
const checkout=$("supportCheckout"),message=$("supportCheckoutMessage");
if(!checkout||!message)return;
const label=$("supportTierLabel"),disclosure=$("supportDisclosure");
const manage=$("supportManageBilling"),manageNote=$("supportManageNote");
const monthly=Number(config.monthlyUSD)===5&&config.currency==="USD"&&config.frequency==="month";
function safeUrl(value,kind){
 if(typeof value!=="string"||!value.trim())return null;
 try {
   const parsed=new URL(value);
   if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.port||parsed.hash)return null;
   const host=parsed.hostname.toLowerCase();
   const path=decodeURIComponent(parsed.pathname);
   if(kind==="checkout"&&host==="buy.stripe.com"&&/^\/[A-Za-z0-9_-]{8,}$/.test(path)&&!/^\/test(?:_|\/)/i.test(path))return parsed.href;
   if(kind==="portal"&&host==="billing.stripe.com"&&/^\/p\/login\/[A-Za-z0-9_-]{8,}$/.test(path))return parsed.href;
 }catch{}
 return null;
}
const link=monthly&&config.verifiedLiveRecurring===true?safeUrl(config.checkoutURL,"checkout"):null;
if(link){
 checkout.href=link;checkout.hidden=false;checkout.target="_blank";checkout.rel="noopener noreferrer";
 message.textContent="Secure checkout on Stripe · $5 USD billed every month. No Deep Cuts account is required.";
 message.classList.add("checkout-ready");
 if(label)label.textContent="FOUNDING SUPPORTER / MONTHLY SUBSCRIPTION";
 if(disclosure)disclosure.textContent="Subscriptions are billed by Stripe at $5 USD per month. You can manage or cancel through Stripe Billing. Any applicable taxes are shown at checkout. Deep Cuts EDH never receives your card details.";
}else{
 checkout.hidden=true;
 message.textContent="Subscriptions aren't open yet. The $5/month founding supporter plan will become available after its live recurring Stripe checkout is verified.";
 if(label)label.textContent="FOUNDING SUPPORTER / COMING SOON";
 if(disclosure)disclosure.textContent="The monthly price is informational until a verified Stripe subscription checkout is activated. No payment or subscription can currently be created here.";
}
const portal=safeUrl(config.manageBillingURL,"portal");
if(manage&&manageNote){
 if(portal&&link){
   manage.href=portal;manage.hidden=false;manage.target="_blank";manage.rel="noopener noreferrer";
   manageNote.textContent="Existing supporters can manage or cancel their subscription securely through Stripe, without a Deep Cuts password.";
 }else{
   manage.hidden=true;
   manageNote.textContent="Stripe's billing-management portal will be available when subscriptions launch.";
 }
}
})();