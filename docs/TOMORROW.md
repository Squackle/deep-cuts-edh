# Deep Cuts EDH — tomorrow's handoff (2026-10-13)

## Where things stand
- Primary site: https://deep-cuts-edh.pages.dev/
- Ko-fi creator page: https://ko-fi.com/deepcutsedh
- Supporter page: https://deep-cuts-edh.pages.dev/supporters.html
- Private diagnostics: https://deep-cuts-edh.pages.dev/diagnostics.html (requires independent admin key, not Ko-fi's verification token).
- Ko-fi webhook: https://deep-cuts-edh.pages.dev/api/kofi-webhook
- Repo: https://github.com/Squackle/deep-cuts-edh
- Security details: [SECURITY.md](SECURITY.md); provider details: [KO-FI.md](KO-FI.md).

Cloudflare successfully deployed the preceding security package. A subsequent routine reliability change acknowledges invalid *authenticated* Ko-fi test subscription examples without creating paid records; confirm the final production deployment status before relying on it.

## Confirmed and not yet confirmed
- **Confirmed:** Public site is linked to Ko-fi, the D1 payment/diagnostics schema was created, and Cloudflare production settings have the Ko-fi webhook token, email HMAC secret, and separate **hashed** diagnostics administrator credential.
- **Confirmed earlier:** One signed/verified Ko-fi `Subscription` sample reached the webhook at 2026-10-13T02:15:56Z and was classified as a subscription payment; it did *not* qualify for a stored paid membership.
- **Not proven:** End-to-end paid recurring membership purchase/renewal, private diagnostics retrieval in a real browser, member key issuance, subscriber email ownership, real payment receipt privacy, refund handling or cancellation-to-expiration behavior.
- **Deliberately OFF:** Automatic premium member keys, paid member entitlements, subscriber login/recovery. Do not switch on `KOFI_MEMBER_ACCESS_READY`; the server-side verifier is intentionally non-operational.

## Tomorrow's order of work

1. **Rotate the Ko-fi verification token.** The old token was shared in a ChatGPT message and needs replacement *before launch*. Regenerate it in Ko-fi's dashboard, then update the Cloudflare Pages **encrypted** production setting `KOFI_VERIFICATION_TOKEN`. Don't paste the replacement in GitHub, a public chat, or frontend files.
2. **Open the private diagnostics dashboard.** Use the previously downloaded independent key. Check last-24-hour entries: `post_received`, `token_verified`, `unknown_tier_or_amount`, `invalid_subscription_details`, and `subscription_recorded`. Older sample events may age out of the dashboard's rolling window.
3. **Confirm Ko-fi tiers really exist and match exactly:** The Informant $5/mo, The Detective $10/mo, The Chief Investigator $25/mo. Tier publishing has not been independently verified.
4. **Send one membership and one monthly sample**, inspect HTTP 200 response and the *private* diagnostics status. Ko-fi sample events may not reflect live payment fields or be eligible for a paid member record; this is expected.
5. **Plan secure key delivery** using a verified subscriber email/account challenge via a transactional email provider or equivalent authenticated workflow, plus the existing two-device system. Link it to actual Ko-fi payment receipts, renewal dates, and manual refunds; Ko-fi does not expose a cancellation webhook.
6. **Test privacy through one controlled, real payment** after business-facing payment processor branding and refund policy are configured. Ko-fi still processes through Stripe/PayPal behind the scenes and does not guarantee anonymity.
7. **Browser acceptance test:** homepage, deck Workshop, nominations, field office locked state, support page, private diagnostics, mobile navigation, HTTP security headers.

## Security guardrails
- Never activate memberships because a form POST says `type=Subscription` on its own.
- Do not store donor names, plain-text emails, Ko-fi tokens, credit card details or private diagnostics credentials in the public repo.
- Do not display payments publicly when `is_public===false`. The current site has no webhook-driven public payment feed.
- Free deck vault and free deck tools must remain unaffected.
- The admin key lives in the owner's private downloadable file; the project stores only a SHA-256 hash of it.

## Suggested first question tomorrow
**“Continue the Deep Cuts EDH Ko-fi migration from docs/TOMORROW.md. Start by checking the latest deployment and private diagnostics, then help me rotate the webhook token and finish subscription activation safely.”**
