# Ko-fi Field Office: manual verified member issuance (October 13, 2026)

## Purpose and status

The Informant ($5/mo), Detective ($10/mo) and Chief Investigator ($25/mo) features are implemented in the existing private Field Office, and a read-only interactive public tier preview is available at [members.html](../members.html). The Ko-fi verified-owner **manual key issuance** workflow now has an owner-only page at `/member-operations.html` and API `/api/kofi-member-issue`.

**CRITICAL: Paid membership access is still OFF** until the owner rotates the previously exposed Ko-fi webhook verification token, publishes/verifies actual Ko-fi recurring tiers, validates end-to-end payments/renewals, and explicitly sets `KOFI_MEMBER_ACCESS_READY=true` in encrypted Cloudflare Pages production settings. The original premium authorization remains fail-closed. The public Ko-fi page is a donation/support link, not a verified automatic benefit checkout.

No qualifying recurring payments or membership keys were recorded at the time of this release. This is NOT evidence that subscribers have been enrolled. A verified payment webhook is necessary but **not sufficient** to issue a member key.

## Manual issuance: operator procedure

1. Store the independent operator key from the owner's one-time private credential file in a password manager. The plaintext is never written to GitHub or D1. The database stores only its SHA-256 hash in `member_issuer_credentials`. Losing the file requires key rotation via D1 using a newly generated high-entropy key.
2. Have the customer contact Deep Cuts through a channel independently linked to their Ko-fi subscription. Verify their subscriber identity privately through Ko-fi, not merely by anyone typing an email address.
3. Check their **actual** completed, qualifying recurring payment in the Ko-fi dashboard. Check exact tier and USD monthly amount. Do not use a sample webhook or a tip.
4. Open `https://deep-cuts-edh.pages.dev/member-operations.html`, enter the independent owner issuer key and subscriber email, and select **CHECK VERIFIED PAYMENT**. This checks only the HMAC-hashed email lookup against successfully authenticated Ko-fi webhook records in `kofi_renewals`.
5. Confirm both owner-attestation checkboxes and choose **ISSUE ONE-TIME KEY**. The server checks the verified renewal remains within the paid-through window, refuses duplicate issuance, issues a random 256-bit secret only once, and inserts the hashed key into the existing two-device membership infrastructure. Deliver this key securely through the verified contact channel. The site does not automatically email keys.
6. The subscriber activates up to two devices at `/members.html`. This activation remains unavailable until the owner has completed the paid-access verification and readiness switch.
7. If a key is lost, after repeating identity checks, choose **REPLACE LOST KEY**. This revokes all existing device tokens. For a refund or support problem, **REVOKE ACCESS**; this does not cancel Ko-fi billing or cause a refund.
8. Each protected API request re-evaluates the verified `paid_until` from the latest Ko-fi renewal, the subscriber's tier, and owner revocation status. An inactive membership is rejected, even if an old device token remains.

This operator tool never asks for credit card information or stores the subscriber email in plaintext. Incoming email is normalized, HMAC-hashed with the private `KOFI_EMAIL_HASH_SECRET` and discarded. Do NOT include raw emails or issuer keys in logs, issue reports, developer screenshots, or web URL query parameters.

## Scope of membership tools

- **Informant:** Personalized printable heuristic Deck Dossier, five themed ten-card alternatives (not full decks), in-site early research note, one in-site classified memo (not automatic email), four office-only themes, member badge and moderated public showcase submission.
- **Detective:** All Informant tools, 1,500-trial land-drop sample (not a mulligan-aware win prediction), pasted collection name comparison, 40 stored version snapshots, up to 25 on-demand Scryfall watches (no push/email/background checks), research question intake reviewed by a human.
- **Chief Investigator:** All Detective tools, request for quarterly consultation (one intake request per 90 days, subject to scheduling), editorial co-design intake, and opt-in credit/recognition after human approval. Chief features do **not** automatically book or fulfill staff time.

The tier preview demonstrates the differences but does not leak private editorial responses or unlock the secured member endpoints. Members never receive additional nomination votes or different deck legality rules.

## Schema, code and security

- Migration: `db/member-kofi-access.sql` (additive, applied to production D1).
- Protected admin: `functions/api/kofi-member-issue.js`; SHA-256 operator credential table, IP quota, same-origin POST validation; no public GET enrollment, no unverified self-service activation.
- Paid access reconciliation: `src/member-auth.js` checks `member_kofi_links` joined to `kofi_renewals` for every member API authorization. The previous Stripe checkout path remains retired.
- Admin page is marked `noindex`, not linked from the public site navigation. Every response is `Cache-Control: no-store`.
- Existing Ko-fi webhook authentication, replay prevention and HMAC email hashing remain unchanged.
- Remaining launch tests: rotate webhook token; confirm real Ko-fi tier creation, payment, renewal, expiry, refunds and manual revocation; issue a controlled real membership and test two devices, role gates, member content, lost-device replacement, and inactivity rejection. Do not set the readiness flag until tests pass.
- Keep a review workflow for member showcase and editorial submissions. Advertised staff responses and consultations must not exceed available editorial capacity.

## Recovery and privacy

- Treat both the operator key and customer member keys as bearer credentials.
- Store only hashed credentials, not raw email or card data. Ko-fi and payment processors still handle identity/payment information.
- A stolen operator key can issue paid entitlements *only* for existing validated paid subscriber hashes, but it can also revoke/reissue existing keys. Rotate promptly if compromised.
- Automatic member onboarding requires a verified transactional-email challenge or Ko-fi-supported identity authentication; neither is configured in this package.

## Complimentary member keys and private directory

The owner operations page now also supports complimentary tier keys (1–365 days), grant-expiration records, session activity, an audit history, and read-only listings of free community profiles alongside premium member accounts. The complimentary branch in `src/member-auth.js` works independently from Ko-fi activation, and revocation/expiration are checked on every request. A grant does not create a Ko-fi subscription or payment. Details and recovery setup: [OWNER-COMPLIMENTARY-AND-RECOVERY.md](OWNER-COMPLIMENTARY-AND-RECOVERY.md).
