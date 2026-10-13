/* Public Ko-fi destination. No payment credentials here, and no paid access enabled.
 * Confirm Ko-fi tier names, prices and member-key verification before launch.
 * Ko-fi payment processing remains with the creator's PayPal or Stripe account.
 */
window.DEEP_CUTS_SUPPORT=Object.freeze({
 provider:"Ko-fi",
 pageURL:"https://ko-fi.com/deepcutsedh",
 currency:"USD",
 tiers:Object.freeze({
  informant:{monthlyUSD:5,name:"The Informant",verified:false},
  detective:{monthlyUSD:10,name:"The Detective",verified:false},
  chief:{monthlyUSD:25,name:"The Chief Investigator",verified:false}
 }),
 membershipAccessReady:false
});
