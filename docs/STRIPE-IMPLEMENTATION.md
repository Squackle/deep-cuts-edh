> **ARCHIVED (Ko-fi migration):** Deep Cuts EDH is no longer implementing direct-Stripe memberships. The official page is https://ko-fi.com/deepcutsedh . This historical Stripe plan is not an active setup guide; see [KO-FI.md](KO-FI.md).\n\n# Deep Cuts EDH — Stripe implementation plan
**Prepared:** 2026-10-12  
**Site:** https://deep-cuts-edh.pages.dev/  
**Offering:** Deep Cuts EDH — Founding Supporter, **$5.00 USD monthly**, optional recurring support for independent Magic: The Gathering articles and free deckbuilding tools.

## Integration assessment

The site is hosted on Cloudflare Pages, with source in `Squackle/deep-cuts-edh`. The existing `supporters.html` page already has a checkout link slot and subscription copy, but `support-config.js` currently contains no Stripe Payment Link. The site intentionally has **no username/password accounts**. Decks are stored locally, in public snapshots or behind recovery keys. There are no exclusive paid features and no need to associate a Stripe Customer with a Deep Cuts user.

**Recommended first release: Stripe Payment Links + Billing customer portal**, with a Stripe-hosted purchase and management experience. Do **not** build custom Stripe.js form inputs, Checkout Session APIs, webhooks, entitlements or a member login yet. They add credentials, attack surface and operational burden without supplying any benefit to an optional donation-like subscription.

## Product/pricing specification

| Field | Value |
|---|---|
| Product | Deep Cuts EDH — Founding Supporter |
| Description | Help fund original Commander Rescue Reports, card research, hosting, and free deckbuilding tools |
| Price | 500 cents USD |
| Billing model | Recurring flat rate |
| Interval | Monthly (1 month) |
| Default quantity | 1 supporter membership |
| Trial | None |
| Cancellation | Self-service through Stripe Billing portal |
| Access / entitlements | None; all site content remains free |
| Taxes | Review Stripe Tax applicability, jurisdiction and customer-facing disclosures before live activation |
| Public success language | Thank supporters, but do not grant perks based on a redirect alone |

The pricing and billing configuration—not the URL shape or public JavaScript—is the actual source of truth for subscription amount and interval.

## Phase A — Stripe connection & account setup

1. Stripe integration planning remains separate from active site billing. Confirm available Stripe connector capabilities and account configuration before changing payment or membership issuance workflows.
2. Verify Stripe account ownership, business display name, statement descriptor, support contact, country, payouts and tax details.
3. In **Stripe test mode**, create the Product + recurring $5.00/month Price and one Payment Link. Use test cards only, and confirm it generates a subscription (not a one-time PaymentIntent).
4. Run the checkout success, declined-payment and cancellation cases. Ensure the email receipts, billing descriptions and taxes are accurate.
5. Enable the **Stripe-hosted customer portal** and its no-code login link, letting supporters manage/cancel without a Deep Cuts password. Configure redirect handling for customers who already have an active subscription.
6. Once tested, create the equivalent **live-mode** Product/Price/Payment Link. Test and verify the link is active and `livemode=true`, with a Price of `unit_amount=500`, `currency=usd` and `recurring.interval=month`. Check available payment methods and cancellation details.
7. Copy the official `https://buy.stripe.com/...` **live Payment Link**, and optionally the `https://billing.stripe.com/p/login/...` customer portal login URL. Only then activate site checkout.

## Phase B — Website integration (code prepared)

1. Update `support-config.js`:
   - `checkoutURL` = verified live Payment Link
   - `verifiedLiveRecurring` = `true` (only after account-side verification)
   - `manageBillingURL` = Stripe Billing portal login URL, if configured.
2. Commit the config change on `main`; Cloudflare Pages will deploy automatically if Git integration is enabled.
3. Open `/supporters.html` from a fresh private browser and verify:
   - $5/month button appears and goes only to `https://buy.stripe.com/...`.
   - Manage/cancel link appears only when the portal URL is configured.
   - Test-mode URLs such as `https://buy.stripe.com/test_...` are rejected from the public page.
   - Without configuration, both buttons stay hidden and an honest pending-launch message is displayed.
4. Verify Stripe's dashboard shows the expected subscription data; **do not** trust a `success=1` query parameter or frontend callback as proof of payment.

## Keys and security

- The supplied `pk_test_...` is a **publishable test key**. It is safe to include in Stripe.js integrations but **unnecessary for hosted Payment Links**. It was deliberately **not** added to code.
- Do **not** paste `sk_test_`, `sk_live_`, `rk_...` or `whsec_...` into chat, GitHub, browser code or Cloudflare Pages plaintext variables.
- If Deep Cuts later adds paid entitlements, use encrypted Cloudflare environment secrets for the server-side Stripe secret and webhook signing secret. Verify the raw webhook signature, replay/duplicate event IDs, and subscription statuses before granting any entitlement. Then implement server-side reconciliation and receipt/portal access securely.
- Stripe owns and processes payment details; the Deep Cuts website should not collect, log or store card details.
- A customer portal lets supporters self-service without creating Deep Cuts accounts. Keep the email/contact information transparent.

## Remaining blocker
**No connected callable Stripe account action and no verified live recurring Payment Link URL.** Do not activate payment checkout until those exist and the owner approves the live-mode billing configuration.

## Reference documentation
- https://docs.stripe.com/payment-links
- https://docs.stripe.com/api/payment-link
- https://docs.stripe.com/billing/subscriptions
- https://docs.stripe.com/payments/checkout/limit-subscriptions
- https://docs.stripe.com/testing
