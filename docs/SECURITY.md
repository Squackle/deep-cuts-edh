# Security baseline — Deep Cuts EDH (October 2026)

This site uses Cloudflare Pages Functions and D1, not a conventional server-side login. Security layers must preserve the free vault's 256-bit recovery key and separately protect the staged Ko-fi premium membership integration.

## Implemented
- **Sitewide security headers:** HSTS, `nosniff`, `X-Frame-Options: DENY`, CSP directives protecting framing/object embeds/base URLs and forms, `Referrer-Policy: no-referrer`, and a restricted Permissions Policy. The CSP is intentionally a conservative baseline so existing Scryfall card art and inline site scripts continue to work; a complete restrictive `script-src` policy still requires browser testing.
- **Cross-site mutation protection:** Pages middleware rejects browser requests labeled `Sec-Fetch-Site: cross-site` for POST API endpoints, excluding Ko-fi's external server-to-server webhook. Individual API origin validation remains in place.
- **No-cache private data:** Private APIs, Field Office and the diagnostics page are served with `Cache-Control: no-store, private` and noindex headers.
- **Passwordless diagnostics for administrator:** `/diagnostics.html` uses a high-entropy, independent admin key. It is sent only as a POST Authorization bearer header and cleared from the input after use; it is neither embedded in client code, stored in browser storage, nor placed in a URL. Cloudflare stores only the SHA-256 hash of the administrator key, not the usable administrator key; this dashboard returns no customer identifiers, amounts, or raw event data.
- **Ko-fi webhook validation:** Ko-fi form-encoded payload, shared verification token comparison, streaming payload size limit, strict monthly tier/price checks, replay-safe receipt storage, anonymous audit and rejection counters.
- **Replay safety:** Renewal state can only be written if the immutable stored Ko-fi message ID also matches the exact hashed payer identity, tier, timestamp, and paid amount. Existing message IDs with different metadata cannot alter another subscriber's record.
- **Free deck shares:** Explicitly require an abuse-protection secret before issuing new share links, with their existing per-IP daily quota.
- **Secret hygiene:** `.gitignore` excludes local .env and private key files; Cloudflare production secrets, never browser JavaScript, own the Ko-fi token and email HMAC secret. Cloudflare stores only a SHA-256 hash of the private diagnostics administrator key.
- **Subscription safety:** Ko-fi has no cancellation webhook. Premium key issuance/authorization remains disabled until we implement secure ownership proof, renewal-driven expiry, recovery and refund handling. **Receiving a webhook is not proof of entitlement activation.**

## Operator's private diagnostics
Open `https://deep-cuts-edh.pages.dev/diagnostics.html`. Enter the independent administrator key from the private file handed to the owner. It is not the Ko-fi verification token. After submitting, the page queries only:
- aggregate `kofi_webhook_diagnostics` reason counts / last hour in the past 24 hours;
- up to 12 recent verified event *categories* from `kofi_webhook_audit`;
- total qualifying subscription records received in the past 24 hours.
No raw emails, IP addresses, donor messages, full webhook bodies, payment identifiers, or secrets are returned. The endpoint does not support GET access to this information.

### Diagnosing tests
- `post_received`: a request reached the Cloudflare Function.
- `token_verified`: Ko-fi's private verification token matched.
- `valid_non_subscription`: a donation/tip (not a paid membership).
- `unknown_tier_or_amount`: tier name/amount didn't match the exact planned membership definitions.
- `invalid_subscription_details`: payment timestamp, email, message ID or field validation failed (some Ko-fi example events may have fictional/stale timestamps).
- `subscription_recorded`: a verified event was processed into the recurring ledger.
- `token_mismatch`: rotate the Ko-fi verification token in Ko-fi and update Cloudflare to match.
Note the diagnostics counters reflect aggregate traffic from anyone, not only Ko-fi. The verification flag and authenticated receipts differentiate valid events.

## Remaining launch tasks
- Rotate the **Ko-fi verification token** previously shared in conversation, then update its Cloudflare encrypted secret. This must happen **before live launch**.
- Manually verify your Ko-fi recurring tier creation and provider business identity visibility.
- Configure Ko-fi's webhook URL and test with representative live recurring subscription and renewal payloads.
- Implement email-ownership proof and issue personal two-device keys from *verified* subscription payments only; revoke premium access at the paid-through date when renewals stop.
- Test Stripe/PayPal payment provider receipt privacy; Ko-fi doesn't shield payment-provider identity.
- Review real response security headers, dashboard access, SQL queries, and UI across a browser. Source-level validation and Pages deploy success alone aren't penetration testing.
- Configure Cloudflare zone-level WAF/rate limiting when running on a custom domain; Pages on `*.pages.dev` cannot automatically rely on a custom-zone WAF rule.
- Restrictive `script-src` / `style-src` CSP, automated dependency checks (site is mostly static), and disaster recovery/export policy for D1 are desirable next improvements.

The independent admin key is a bearer secret, although only its one-way hash is stored in Cloudflare: whoever has it can read the operational diagnostics. Generate a new key and update its SHA-256 hash in Cloudflare if lost or shared. No diagnostics credential should ever be committed to GitHub.

## Delivery acknowledgment safeguard (October 2026)
Malformed/unrecognized *authenticated* subscription sample events are never granted entitlements. The webhook acknowledges their **delivery** with HTTP 200 while recording an anonymous ignore reason, avoiding unnecessary retry storms. An actual qualifying event requiring durable database storage still returns a temporary error on write failure so Ko-fi can retry.
