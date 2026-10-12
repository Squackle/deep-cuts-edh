/* Deep Cuts EDH — Stripe-hosted $5/month supporter subscriptions.
 * Stripe Payment Links require no API key on the site.
 * Never add an sk_test_/sk_live_ secret here or in GitHub.
 *
 * Before enabling:
 * 1. Confirm the Stripe Price is USD 500 cents, recurring every month.
 * 2. Confirm Payment Link is LIVE, active and owned by Deep Cuts EDH.
 * 3. Enable Stripe Billing customer portal and copy its portal login URL.
 * 4. Update checkoutURL and verifiedLiveRecurring below in the same commit.
 */
window.DEEP_CUTS_SUPPORT=Object.freeze({
 monthlyUSD:5,
 currency:"USD",
 frequency:"month",
 provider:"Stripe",
 checkoutURL:null,
 verifiedLiveRecurring:false,
 manageBillingURL:null
});
