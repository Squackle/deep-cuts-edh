# Owner Command Center — Capacity & Usage

Owner page: `/member-operations.html#capacity` under **Site → Capacity & usage**. Owner route `/api/owner-ops?view=capacity` shares the existing Cloudflare Access + separate owner-issuer bearer key security boundary. There is **no public analytics API** and **no new per-visitor tracker**, writes, cron, external frontend SDK, or schema migration.

## Status on first deployment

A deployed page alone does **not** authorize the site to read your Cloudflare account usage. Until you connect a scoped Cloudflare API token, the section explicitly displays **Connect Cloudflare metrics**, not invented zeros.

1. In Cloudflare Dashboard, open **My Profile → API Tokens** or your **Account API Tokens** panel, create a **Custom token** scoped to this Cloudflare account only. Give it **Account → Account Analytics → Read**. Optionally also **Account → D1 → Read** so the dashboard can retrieve database file sizes. Do **not** grant D1 Edit, Workers Write, Pages Write, billing writes, or permission to edit Access policies.
2. In Cloudflare **Workers & Pages → deep-cuts-edh → Settings → Variables and Secrets**, production environment, create **Secret** `CLOUDFLARE_ANALYTICS_TOKEN` (the token) and a **plain text environment variable** `CLOUDFLARE_ACCOUNT_ID` (32-character Cloudflare account ID from the account overview). Both names are case-sensitive.
3. Deploy/activate the changed production environment settings as Cloudflare requires, then sign into Owner Command Center with Cloudflare Access MFA and your existing owner key. Visit Site → Capacity & usage, select Refresh metrics.
4. If it shows Metrics temporarily unavailable, inspect Cloudflare GraphQL API permissions, resource scope, data availability and API rate limits. Do not paste or log secrets. This failure does **not** affect normal website operations.
5. Keep the secret only in Cloudflare encrypted environment settings. Never put the key in GitHub, HTML, frontend JavaScript, report files, chat messages, or URL query parameters.

## What the panels measure

- **Workers requests and errors:** Real GraphQL `workersInvocationsAdaptive` responses, for all scripts in this Cloudflare account (includes other Workers sites), shown in UTC daily buckets. This is **not the number of DeepCutsEDH visitors** and may include previews/other scripts if Cloudflare includes them.
- **D1 rows read and written:** `d1AnalyticsAdaptiveGroups` GraphQL rows, account-wide totals over 7 UTC calendar dates; tracked Community and Hive D1 rows split by immutable database ID. Separate other databases remain in account-wide totals because account quotas are shared.
- **D1 storage:** Current `file_size` values from read-only D1 REST `GET /accounts/:account/d1/database/:id`, only if token has optional D1 Read permission. Without that permission, storage reads remain unavailable; never substitute database record counts or hard-coded historical sizes.
- **Trends:** Last 7 UTC calendar days, including a potentially partial or delayed current day. Analytics is Cloudflare-provided, sampled/retained and not an authoritative invoice.
- **Limit comparisons:** Clearly marked **Free-tier reference only**: Workers 100k/day, D1 5M rows read/day, 100k rows written/day, 500MB storage per database. **Your billing plan is not autodetected.** Comparisons are hypothetical unless your Cloudflare billing plan is confirmed Free.
- **Truncation:** Results reaching the GraphQL dataset limit are labeled incomplete and quota bars are withheld, to avoid under-reporting as reliable usage. No averages or visitors are fabricated.

Cloudflare source documentation:
- https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/
- https://developers.cloudflare.com/d1/observability/metrics-analytics/
- https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/

## Usage over time graph

Under **Today · Cloudflare account**, a compact green-and-gold **Usage over time** SVG shows the last seven UTC daily buckets. Switch between Worker requests, Worker errors, D1 rows read, and D1 rows written without an additional request: the chart reuses the same `workers.daily` and `d1.daily` arrays already returned to the owner dashboard. The original Today values, quota comparisons, database storage and seven-day detailed rows remain unchanged.

The chart uses built-in browser SVG (no charting library, CDN, new script, API endpoint, analytics integration, database table or background process). Screen readers receive the complete date/value series in an accessible chart label, and the existing detailed table provides a text alternative. On narrow phones, only the graphic scrolls horizontally, not the whole page. An unavailable/disconnected Cloudflare dataset continues to show the existing setup message rather than false zero usage. These are daily account-wide counts, not unique visitors or an hourly live chart.

## Security and operations

Queries run **only** after authenticated owner navigates to this section or clicks Refresh. Cloudflare Access and existing Owner bearer checks run before any API data read. The token never reaches client JavaScript or JSON; errors are generic. Backend fetches are bounded to 6.5 seconds and are read-only, with graceful unavailable status. No user identities, IPs, email addresses, or tracked unique visitor IDs are stored. Lock & clear removes rendered metrics and prevents late responses from restoring private data.

Staging mocks cover invalid/missing credentials, empty/permission-denied GraphQL, data shaping, seven-day grouping, account-vs-site scope, database sizing, and mobile behavior. Real successful GraphQL data retrieval requires production credential setup by the owner; until then, mark integration pending rather than complete.

## Growth follow-ups

If future traffic justifies richer analytics, use Cloudflare Web Analytics for privacy-conscious page/visitor statistics as a **separate opt-in project**. Do not infer visits from Workers requests. Before applying Paid-tier thresholds, verify the account's Workers/D1 plan and update the comparisons.

Rollback: revert the owner-capacity changes (owner-v2.js/css, functions/api/owner-ops.js, src/owner-capacity.js, tests, this doc). No D1 migration or cleanup needed; remove the two optional environment bindings if retiring integration.
