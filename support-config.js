/* Stripe sandbox products exist for all three tiers. No live checkout configured.
Never add Stripe secret keys to this public file. A static link alone does not
grant premium entitlements. Enable only after benefits, billing and access checks
are implemented and each live recurring Price is verified. */
window.DEEP_CUTS_SUPPORT=Object.freeze({
 monthlyUSD:5,currency:"USD",frequency:"month",provider:"Stripe",membershipInfrastructureReady:false,
 checkoutURL:null,verifiedLiveRecurring:false,manageBillingURL:null,
 tiers:Object.freeze({
  informant:{monthlyUSD:5,sandboxProduct:"prod_VQj1sN8fQn1Hff",sandboxPrice:"price_1UPrZWBDD2Zs8Kb6NMpeOFOu",liveCheckoutURL:null,ready:false},
  detective:{monthlyUSD:10,sandboxProduct:"prod_VQkHZ7oRG0X80p",sandboxPrice:"price_1UPsnHBDD2Zs8Kb6qchMeXKO",liveCheckoutURL:null,ready:false},
  chief:{monthlyUSD:25,sandboxProduct:"prod_VQkHAnT8PJKwkI",sandboxPrice:"price_1UPsnKBDD2Zs8Kb6F8hFcPfK",liveCheckoutURL:null,ready:false}
 })
});
