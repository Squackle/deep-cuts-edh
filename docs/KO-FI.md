# Deep Cuts EDH — Ko-fi membership migration

**Public creator page:** https://ko-fi.com/deepcutsedh

## What is live now
The Deep Cuts site points visitors to the owner's Ko-fi creator page. The three **planned** premium tiers remain:
- The Informant — $5 USD/month
- The Detective — $10 USD/month
- The Chief Investigator — $25 USD/month

These tiers are **not verified as currently published on Ko-fi**. The public Ko-fi URL has been provided by the owner; Ko-fi's live tier page is not currently readable by our verification tools. Do not claim tiers or benefits are redeemable until the owner checks their Ko-fi membership settings.

The site does **not** accept payment details. The legacy direct-Stripe checkout/enrollment and Stripe webhook have been retired. The former sandbox products have not been deleted in Stripe. Premium Field Office access is currently **disabled** until Ko-fi verification, entitlement expiry, email ownership verification and key issuance have been implemented and tested.

## What the owner must configure on Ko-fi

1. In **Ko-fi → Memberships**, choose **Membership Tiers**, not monthly tips. Create matching tiers with exact names **The Informant**, **The Detective** and **The Chief Investigator**, at $5, $10 and $25 USD per month. Review and post realistic descriptions of each tier's *actually available* benefits.
2. Under Ko-fi **Payment Settings**, use an appropriately configured **PayPal Business** account if the goal is to avoid showing a personal PayPal name/email. Verify business branding, privacy, customer-visible receipt/transaction details. Ko-fi itself is not merchant of record: direct payment processing still happens through PayPal or Stripe. Name and email visibility may vary.
3. In **Ko-fi Webhooks**, add `https://deep-cuts-edh.pages.dev/api/kofi-webhook`. Ko-fi sends subscription payment notifications as form-encoded `data` JSON. The supplied private verification token was saved as an **encrypted Cloudflare Pages production secret** `KOFI_VERIFICATION_TOKEN`. Rotate it in Ko-fi before launch (it was previously shared in a chat), then update the Cloudflare secret to match. Never commit it into public code.
4. **Completed:** An independent, cryptographically random secret `KOFI_EMAIL_HASH_SECRET` was generated and stored as an encrypted Cloudflare Pages production secret. This is used to HMAC subscriber emails before storing them. Do not rotate it without a migration plan because the hash is the renewal lookup key. The site does not store plain-text email in the Ko-fi payment tables.
5. Send the **test webhook** from Ko-fi, then validate an actual owner-authorized membership payment and renewal. Do not accept payments promising automatic member keys until tests and enrollment have been implemented. Webhook messages don't magically activate accounts.
6. Set up an authenticated, rate-limited key-claim process proving ownership of the paying email or Ko-fi account (e.g. one-time email challenge from a verified sending domain). Connect and test the two-device limit, expiration, refunds and lost-key process before setting `KOFI_MEMBER_ACCESS_READY` and public tier verification flags.
7. Determine membership taxes and customer support obligations. Ko-fi charges a creator fee and the payment provider may charge processing fees. Ko-fi is not a legal privacy shield.

## Payment tracking already staged
The database has two privacy-conscious new tables, `kofi_payment_events` and `kofi_renewals`, created by `db/kofi.sql`. The `/api/kofi-webhook` route:
- refuses all requests unless both private Cloudflare secrets and D1 are configured;
- validates the creator's verification token before processing;
- accepts only `type=Subscription`, `is_subscription_payment=true`, USD amounts meeting the minimum for a matching tier name;
- deduplicates by `message_id` to resist repeat deliveries;
- stores only keyed HMAC email hashes, tier names, timestamps, and amounts (no name, email, payment message, or card data);
- computes the next expected renewal date based on the payment date and records that as `paid_until`, but **does not grant access**.

### Crucial cancellation limitation
Ko-fi's public webhook only reports **payments**. Ko-fi says it **does not send membership-ended/cancellation events** (https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook). A functional membership system must let premium access expire from its last *verified* monthly payment timestamp, unless a new renewal comes in. Refunds and immediate cancellation/refund require manual reconciliation. Merely checking if the original membership key exists is **not enough**.

The existing `src/member-auth.js` deliberately fails closed until the Ko-fi access system is built. The earlier 2-device `member_devices` table and trigger are preserved. This protects the site from accidental entitlement grants based on unverified or stale Ko-fi subscription data.

## Editorial and tier benefit transparency
The software workspace provides the framework for Deck Dossiers, five alternate build packages, a preview, a member-only memo, a basic probability lab, deck revision comparisons, manual Ko-fi-intake-independent editorial requests, and on-demand card watches. As of this migration the verified membership access layer is **not** live; no Key is being issued automatically. Premium benefits should continue to be labeled in development.

## Sources
- https://help.ko-fi.com/hc/en-us/articles/4402945994001-Ko-fi-Memberships-and-Membership-Tiers
- https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook
- https://help.ko-fi.com/hc/en-us/articles/115004001294-What-personal-information-is-shared-on-Ko-fi-as-a-creator

## Operational configuration update — 2026-10-12
- The verification token supplied by the owner was stored as encrypted Cloudflare Pages production variable `KOFI_VERIFICATION_TOKEN`.
- A new independent secret was securely generated and installed as `KOFI_EMAIL_HASH_SECRET` in production.
- The existing `TURNSTILE_SECRET` remained present and unchanged as a secret binding; preview environment settings were not modified.
- The current GET `/api/kofi-webhook` health check reports **only configuration readiness**, not secret values or payment details. Only POST events with a correct token are accepted as payment notifications.
- The webhook now writes payment event and renewal state inside one transactional D1 batch. Replayed deliveries are idempotent; a failure rolls back both writes.
- **The owner still needs to set the URL in Ko-fi's Webhooks dashboard and send a test notification**. This integration has no API that can set that Ko-fi account preference remotely, and the endpoint does not automatically issue keys.
- Ko-fi still has no membership cancellation events. Paid Field Office features remain off pending verified ownership/renewal tracking and service testing.

## Ko-fi test webhook receipt diagnostics (October 2026)

Ko-fi's test payment can be a **one-time donation**, which is intentionally ignored by the membership renewals table. To distinguish a delivery test from a recurring membership payment, the webhook now stores a privacy-preserving delivery record **only after verifying the Ko-fi token**:
- `kofi_webhook_audit`: event type, subscription classification, receipt time; no email, name or transaction identifiers; auto-purged after 30 days.
- `kofi_payment_events`: actual valid recurring member payments only.
- `kofi_renewals`: the latest qualifying paid-through date per hashed subscriber email.

To check the next test after this code is deployed:
```sql
SELECT datetime(received_at,'unixepoch') AS received_utc,event_type,classification
FROM kofi_webhook_audit ORDER BY id DESC LIMIT 5;
```
If the audit table stays empty, a request might not have reached the correct endpoint, might have used an incorrect verification token, or may have failed before token verification. Check Ko-fi's displayed HTTP response code; it must receive HTTP 200. Never post the verification token publicly.

## 2026-10-12 webhook delivery troubleshooting

The POST handler now records aggregate hourly, privacy-safe diagnostic categories in `kofi_webhook_diagnostics`, even if the verification token mismatches. No raw payload, token, payer email, names, or IP addresses are stored. The original `kofi_webhook_audit` continues to show only *verified* event types, and the payments tables contain only accepted recurring membership payments.

```sql
SELECT datetime(hour_bucket,'unixepoch') AS hour_utc,reason,events
FROM kofi_webhook_diagnostics ORDER BY hour_bucket DESC,reason;
```

Expected `post_received` count is nonzero for a Ko-fi test that reaches the Pages Function. If it is zero after another test, check Ko-fi's response status / delivery settings or routing. A nonzero `token_mismatch` means the Dashboard token is different from the encrypted Cloudflare secret; regenerate/rotate both securely. `valid_non_subscription` shows a successful one-time Tip test, while verified `Subscription` payments enter the separate payment tables when tier and amount match.

The validator accepts Ko-fi's documented `Tip`, `Subscription`, `Commission`, and `Shop Order` event labels.
