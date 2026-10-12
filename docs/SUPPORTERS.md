# Launching $5/month Deep Cuts supporters

The public [supporter page](../supporters.html) is published. Membership checkout is **not active** until the owner connects an actual payment service and verifies a live recurring plan.

## Stripe Payment Links (recommended)

1. Connect the Stripe account using the Stripe integration or Stripe Dashboard.
2. Create a product named **Deep Cuts EDH — Founding Supporter**.
3. Create a **recurring** USD price of **$5.00 every month** (not a one-time $5 charge).
4. Create a live Payment Link from that price. Test with Stripe's test mode first but **never publish a `/test_` checkout URL**.
5. Confirm the subscription amount, cancellation terms, taxes, business identity and customer portal with Stripe.
6. Edit [support-config.js](../support-config.js), changing `checkoutURL:null` to the verified URL. The frontend only accepts HTTPS URLs on trusted provider domains.
7. Publish via GitHub → Cloudflare and test with a separate browser. No payment or customer card information is collected by Deep Cuts EDH itself.

Alternative hosted links: an approved $5 monthly Patreon or Ko-fi membership page, or an enabled GitHub Sponsors tier. Verify ownership and the recurring amount, not just the domain.

## User experience
- Every page has a Support link; the homepage includes a prominent $5 monthly prompt.
- Until `checkoutURL` is configured, the support page explicitly says subscriptions are not yet accepting payments and **does not show a buy button**.
- No supporter-only site login, paywalled articles, or vote weighting is promised.
- Only third-party payment services handle billing; never ask supporters to enter payment credentials on this website.

Payment Links official documentation: https://stripe.com/payments/payment-links


## October 2026 hardened Stripe-only integration
See [`STRIPE-IMPLEMENTATION.md`](STRIPE-IMPLEMENTATION.md) for the product, monthly price, portal, testing and go-live checklist. `supporters.js` now rejects test-mode Stripe links and only enables the public checkout after explicit verification of a live $5/month Price. The existing site's `pk_test` key is **not required** for Payment Links.
