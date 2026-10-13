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
3. In **Ko-fi Webhooks**, add `https://deep-cuts-edh.pages.dev/api/kofi-webhook`. Ko-fi sends subscription payment notifications as form-encoded `data` JSON. Copy its private verification token into a **Cloudflare Pages encrypted secret** `KOFI_VERIFICATION_TOKEN`; never commit or paste it into public code.
4. In Cloudflare Pages configure another independent random secret `KOFI_EMAIL_HASH_SECRET` (at least 32 unpredictable bytes). This is used to HMAC subscriber emails before storing them. Do not rotate it without a migration plan because the hash is the renewal lookup key. The site does not store plain-text email in the Ko-fi payment tables.
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
