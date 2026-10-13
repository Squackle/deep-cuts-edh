# Monthly Ko-fi supporters browse ad-free — October 2026

## Rules

**Every successfully verified recurring Ko-fi subscription payment, at any membership tier, qualifies for an ad-free experience while its paid-through date remains in the future.** One-off tips, commissions, shop orders, free trials, invalid/zero-value events, and unverified claims do not qualify.

To connect payment identity, the visitor signs into a free Field Network profile and verifies **the same email used to pay on Ko-fi** under My Profile → Private Recovery Email. This verification requires an eight-digit email code. The recommended 90-day secure device cookie keeps the profile signed in between site visits. Email addresses are decrypted only in the trusted Cloudflare function, then domain-separated HMAC-SHA256 hashes are compared with payment records; **no plaintext email, session key or payment token is returned to the browser**.

Approved subscribers' ad-enabled HTML responses are rewritten by Cloudflare Pages middleware to **omit the Google AdSense script before the page reaches their browser**. The HTML meta verification tag remains harmless. Other visitors and Google's anonymous review bot receive the existing AdSense publisher script unchanged. No client-side ad flash, fake hidden ad unit, or bypass of AdSense controls.

Ad-free applies to the public content pages that otherwise load AdSense (homepage, Card Library and four Rescue Reports). Other pages—games, Field Network, account recovery, Deck Workshop, supporters, Field Office, private operations—remain entirely without AdSense for everyone, as before.

## Implementation

- `db/kofi-adfree-2026-10.sql`: `kofi_adfree_payments` (immutable, idempotent verified payment events), `kofi_adfree_renewals` (per-address paid-through summary), and `kofi_adfree_manual` (owner-verified legacy reconciliation). Email identifiers are keyed hashes, not plaintext.
- `functions/api/kofi-webhook.js`: verifies the original Ko-fi webhook verification token and form data, fixes an earlier WebCrypto HMAC import error, processes any real `Subscription` with `is_subscription_payment=true` and positive amount, then writes the ad-free entitlement separately from *stricter* Field Office tier-qualification records. An event replay with the same `message_id` cannot renew a different person; the lookup checks the immutable event's email hash, payment date, currency and amount. No automatic paid member keys are issued.
- `src/kofi-adfree.js`: matches the signed-in profile's verified email to Ko-fi's HMAC, tests active paid-through dates from ad-free, manual and legacy renewal tables.
- `functions/_middleware.js`: checks only ad-enabled HTML routes for a valid 90-day Field Network device cookie. Paid subscribers receive private/no-store HTML without the Google AdSense script. Unauthenticated visitors receive the original unchanged HTML. Private ad-free responses cannot be cached publicly.
- `functions/api/ad-entitlement.js`: authenticated, no-store JSON with only boolean ad-free state and expiry, plus owner-key-authenticated manual reconciliation for historic paid months.
- `community.html` and `community-recovery.js`: in-profile verified-email and Ko-fi membership status with clear guidance.
- `supporters.html`: prominently explains the new live ad-free benefit and its matching rule.
- `member-operations.html` and `owner-adfree.js`: independent owner-key-only manual legacy reconciliation. **Never grant based solely on a webhook test, screenshot, or someone's unsupported claim.** The operator must check the real Ko-fi payment and paid-through date. These grants expire automatically. Removing one does not override a real automatic payment.
- `privacy.html`: disclosure of verified-email matching, hashed Ko-fi payment data, and ad suppression.

**Pre-existing Ko-fi subscriptions:** At installation, the production database had zero tracked Ko-fi renewals, although profiles already existed. Older payments cannot be retroactively verified by a newly installed webhook. The operator should manually reconcile an existing paid subscriber through the owner dashboard after checking Ko-fi's real history; future valid recurring payment webhooks update the entitlement automatically. Subscriber status does not require unlocking the intentionally staged premium Field Office key-issuance system.

## Notes and limits

- Ko-fi doesn't send a cancellation webhook in this implementation. The ad-free entitlement lasts through the last paid-through date; it expires if no renewal arrives. A cancellation that leaves the paid month prepaid does not revoke ad-free early.
- Ko-fi payment email and verified Field Network email must match exactly after lowercasing and trimming. Profiles without a verified email cannot be identified as paying members. Users should not share a recovery code or private membership key in chat.
- If a subscriber doesn't choose to remember the device and signs in only with a temporary profile key, their temporary login is not visible to Cloudflare on unrelated page navigation. They should select **Remember This Device** in their account to receive ad-free page responses.
- All subscriber matching happens server-side. The website does not gain direct Ko-fi account inspection or subscription-cancellation APIs through this change.
- The ad-free benefit is granted independently of Ko-fi private Field Office key availability; private tier features remain gated until verified issuance is ready.
- AdSense may still be waiting for Google's approval. Installing a conditional supporter exemption does not guarantee ads start serving.

## Verification before announcing

1. Confirm the three D1 tables exist and `PRAGMA foreign_key_check` returns no violations.
2. Confirm the Ko-fi webhook's HMAC imports specify SHA-256, and tests distinguish a valid subscription from a one-off tip or a duplicate `message_id`.
3. For a page with the exact AdSense script, verify public/anonymous HTML retains it, while a paid verified profile request returns HTML with no ad script plus `Cache-Control: private, no-store`.
4. Confirm no raw email, HMAC secret, or subscriber payment details appear in public API responses.
5. Confirm legacy owner reconciliation requires the independent issuer key and independently verified payment.
6. Test expiry, partial payment data, invalid email, wrong email, and an unverified profile.
7. Confirm the live Cloudflare deployment compiled with the middleware and the unchanged public publisher script.
8. Test an actual paid Ko-fi account in a browser (if available) and inspect network activity to ensure `pagead2.googlesyndication.com` never loads.

## Separate connected apps for website operations

GitHub and Cloudflare are connected for changes/deployments; Google Search Console is connected through GSC Wizard and can report site indexing and sitemaps. The optional Windsor.ai integration can extend reporting into GA4/other marketing platforms **only after the user explicitly connects it**. No ChatGPT plugin is required for a visitor to browse ad-free.
