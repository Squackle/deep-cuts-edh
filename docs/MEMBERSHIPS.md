# Premium Field Office — deployment and operations

This package implements a key-only membership infrastructure and member-facing features across all three proposed tiers. **Publishing code is not equivalent to launching paid benefits.** All live checkout URLs remain null/disabled until Stripe LIVE credentials, billing, full verification and editorial capacity are available.

## Actual service status

| Feature | Available after member verification | Current scope |
|---|---|---|
| Stripe entitlement verification | Yes, when LIVE secrets configured | Checkout session claim and subscription polling; signed subscription webhooks |
| Two-device membership keys | Yes | A 256-bit member key, server-hashed; two active HttpOnly device cookies, SQL cap, 30-day replacement |
| Member dashboard | Yes | Key-only access, tabbed Field Office, device list |
| Printable Deck Dossier | Yes | Server-authorized mana/role heuristics; print to PDF in browser, **not** playtested recommendations |
| Alternative builds | Partial | Five exclusive ten-card packages with strategy notes, not complete priced 100-card lists |
| Early access | Pipeline only | Private preview of a Celestial Kirin research hypothesis; no completed or scheduled article |
| Supporter Showcase | Yes | Member submissions in D1; only manually approved entries shown in public gallery |
| Classified newsletter | Partial | One member-only in-site editorial memo; no email delivery scheduler |
| Themes and badges | Partial | Four Field Office themes and member badge; not account-wide site themes |
| Deck version history | Yes | Up to 40 revisions/member with side-by-side quantity comparison, restore to local Workshop |
| Probability Lab | Partial | 1,500-turn Monte Carlo land-drop model, no mulligans/ramp/colors/opponents; not a win-rate simulator |
| Collection-aware suggestions | Partial | Matches names in a pasted collection to current deck and returns missing cards, not a generated optimized upgrade deck |
| Discovery alerts | Partial | Manual, 25-item watchlist with up to eight Scryfall price/Oracle comparisons every two hours; no push/email/background monitoring |
| Research Q&A | Yes, intake | Submission and private editorial response visible in Field Office; answers require a human |
| Quarterly consultation | Yes, intake | One request per 90 days; consultation fulfillment requires human time |
| Co-design Rescue Reports | Yes, intake | Chief editorial request pathway, human review |
| Special recognition | Yes, opt-in | Chief credit requests may be approved for public display |

Any incomplete feature must be described as **in development**, not as an active paid perk or guaranteed automation.

## 1. Verify Stripe LIVE integration

The connected Stripe app currently exposes only **sandbox**, with $5 Informant, $10 Detective, and $25 Chief Investigator recurring products. The live account/keys have **not** been connected, so **no live member keys can currently be claimed**.

Configure these *Cloudflare Pages production* encrypted secrets/variables in the Dashboard (do not commit them):

- \`STRIPE_SECRET_KEY\`: a LIVE restricted secret key or live server-side key with access to Checkout Sessions, Subscriptions, Prices and Customers as required.
- \`STRIPE_WEBHOOK_SECRET\`: the signing secret from the live webhook endpoint at \`https://deep-cuts-edh.pages.dev/api/stripe-webhook\`, subscribed to \`customer.subscription.updated\` and \`customer.subscription.deleted\`.
- \`STRIPE_PRICE_INFORMANT\`: the exact live monthly $5 Price ID.
- \`STRIPE_PRICE_DETECTIVE\`: exact live monthly $10 Price ID.
- \`STRIPE_PRICE_CHIEF\`: exact live monthly $25 Price ID.

The access backend explicitly rejects sandbox Checkout Session IDs and sandbox Stripe API keys in production. It requires a completed LIVE Checkout Session, \`mode=subscription\`, \`payment_status=paid\`, an active subscription, and an exact matching Price ID. It refreshes subscription validity at most once every five minutes on protected API access; webhook updates handle cancellation quickly. Subscription \`cancel_at_period_end\` is allowed until Stripe marks it inactive.

For each live Stripe Payment Link, configure a post-checkout redirect to:
\`https://deep-cuts-edh.pages.dev/members.html?session_id={CHECKOUT_SESSION_ID}\`
Use the **exact Stripe Checkout template variable** as provided by Stripe. Test the redirect using the live account with an authorized controlled transaction before opening to customers.

## 2. Make the site ready for public billing

The public \`support-config.js\` has safety switches:

- \`membershipInfrastructureReady:false\`
- \`verifiedLiveRecurring:false\`
- \`tiers.informant/detective/chief.ready:false\`
- All \`liveCheckoutURL:null\`.

**Do not switch these flags** until (1) live backend bindings work, (2) benefits advertised as live are deliverable, (3) product tax codes have been selected with appropriate professional advice, (4) billing portal and cancellation are operational, and (5) customer support and refund policy are ready. Stripe handles card details; no Stripe secret must appear in browser JavaScript.

Use the Stripe-hosted customer portal login URL (\`https://billing.stripe.com/p/login/...\`) for \`manageBillingURL\`. Product pages should include clear recurrence and cancellation instructions.

## 3. Passwordless / two-device flow

1. Subscriber buys a LIVE monthly plan through Stripe-hosted checkout.
2. Redirect contains \`session_id\`. The site retrieves the LIVE Stripe Checkout Session and associated Subscription server-side; only then does it generate a one-time membership key: \`dcmember1_<id>_<secret>\`.
3. The user saves the key and activates up to two devices, labeled by the subscriber. The server sets a 256-bit device credential as a \`Secure; HttpOnly; SameSite=Strict\` cookie scoped to \`/api\`. Browser JavaScript never needs to read it.
4. SQL enforces **at most two active devices** with both insertion predicates and a D1 trigger. A valid key allows one device replacement every 30 days, automatically revoking the oldest activated device; authenticated users can selectively revoke a device instead.
5. Membership requests are checked server-side against Stripe. If the subscription is inactive, paid endpoints reject access.
6. A lost membership key has no automatic recovery mechanism. Use a **human, verified subscription-owner support workflow** to resolve lost keys; never disclose stored hashes.

The free deck vault and free local drafts are **separate**; paid member keys do not replace free deck keys.

## 4. Editorial requests

The protected \`/api/member-data\` endpoint accepts \`showcase\`, \`question\`, \`consultation\`, \`editorial\`, and \`credit\` categories. They remain pending until manual moderation.

Use Cloudflare D1 console for review:
\`\`\`sql
SELECT id,category,content,created_at,status
FROM member_requests WHERE status='pending' ORDER BY created_at ASC;
\`\`\`

Approve public content only with appropriate permission:
\`\`\`sql
UPDATE member_requests SET status='approved' WHERE id='<verified request id>' AND category IN ('showcase','credit');
\`\`\`

A staff research reply or consultation outcome can be delivered privately:
\`\`\`sql
UPDATE member_requests
SET status='answered', staff_reply='<editorial response>'
WHERE id='<verified request id>' AND category IN ('question','consultation','editorial');
\`\`\`

Public \`/api/supporter-gallery\` exposes **only approved** showcase and opt-in credit content, capped in size. Avoid publishing contact details accidentally pasted into submission text. Nothing is automatically accepted.

Quarterly consultations are limited to one **request** per 90 days per member; editorial labor is not automatically fulfilled. Build an owner-side review SOP before selling Chief memberships.

## 5. D1 tables and manual verification

The migration is \`db/premium.sql\`, applied to the existing D1 DB \`5f870895-4281-45d2-b331-45c8182e1079\` before deployment. It creates member accounts/devices/versions/requests/watches; adds staff replies and a database trigger for the two-device limit. No free-deck or nomination data was deleted.

No email, username, or password is required for Deep Cuts membership. Stripe, however, may collect billing email and address under its own policies.

## 6. Limits and testing

Before going live, verify:
- Invalid \`cs_test_\` IDs rejected; only real, completed \`cs_live_\` session can claim once.
- Repeated claim of the same checkout is denied; the first plaintext key is never stored.
- Third device is denied; one-time 30-day replacement revokes an older credential.
- Revoked token cannot access any premium API; inactive/canceled subscription loses access after webhook or refresh.
- Altered Stripe signature and expired signature cannot update access.
- Each tier gets the correct actions; Informant cannot save revisions or request consultations.
- Unapproved showcases are private; approved showcases publicly visible.
- Subscription billing portal and cancellation work independently of any Deep Cuts password.
- Dossier and probability estimates are educational, never represented as ML performance predictions.
- Screen reader, keyboard and mobile UI checks plus live browser end-to-end QA.

The backend is fail-closed by default; without a live Stripe key and production mappings, the Field Office displays a setup/pending message and checkout remains disabled. Live API secrets and payment records are never stored in GitHub.

**Official Stripe docs:** https://docs.stripe.com/billing/subscriptions and https://docs.stripe.com/webhooks .

## October 2026 production rollout audit
A single website build was staged with all four tier interfaces. This does **not** automatically fulfill future editorial work: early access requires new drafts, emailed newsletters require a delivery service, and Chief consultations require owner scheduling. The on-demand Scryfall watchlist checks only eight names per request (one check every two hours per member); no periodic background watch runs. A real live Stripe connection, test transactions, private billing secrets, webhook delivery, tax decisions and launch verification are all required before enabling public membership payments.
