# Weekly report discovery

The static `/sitemap.xml` remains the inventory of real public static pages. `/sitemap-weekly.xml` is a Pages Function using the same merged published index as `/rescues`; both are advertised in `robots.txt`. It includes canonical dated report URLs, deduplicates valid calendar dates, and does not invent modification timestamps from scheduled issue dates. No per-edition sitemap edit is needed.

If the publisher index fails or has an invalid envelope, the sitemap responds 503 with Retry-After and no-store; the ordinary archive still shows local reviewed editions. A successful response has a five-minute cache policy. No write, subscriber notification, extra service binding or cron is introduced.

After a separately authorized release, verify the exact deployed SHA, GET and HEAD `/sitemap-weekly.xml`, HTTP status and XML type, both robots sitemap declarations, and a representative local edition and publisher-only report (HTTP 200, matching canonical, no noindex). On a healthy archive the XML date set should match the published list. Check Search Console sitemap and selected URL inspection when first-party access is available. A sitemap is a discovery hint, not a guarantee of indexing.

Editorial workflow: keep dates and report data in the existing `src/weekly-rescue-editions.js` review process or publisher's public index; do not create placeholder report URLs. Leave lastmod absent unless a trustworthy per-report modification timestamp is available. Run `node --test tests/weekly-sitemap.test.mjs` and the full site audit.

Rollback: revert the scoped PR to remove the second robots declaration and dynamic endpoint; static sitemap and reports remain intact.

Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap and https://developers.cloudflare.com/pages/functions/routing/.

## Publication coverage and read-only recovery (2026-11-24)

The November 24 read-only KV census found only article keys and index rows for 2026-10-30 and 2026-11-20; no article keys for 2026-11-06 or 2026-11-13. The reviewed repository editions cover November 6 (Nymris) and November 13 (Grothama) as explicitly labeled editorial backfills, and supersede the November 20 Kruphix article. The merged website inventory covers all four scheduled Fridays. Do not copy editorial backfills into production KV, rewrite issue dates, or send retrospective subscriber notifications without separate authorization.

The currently configured two UTC retry schedules (15/16 UTC at minutes 0,15,30,45 Fridays) were created November 16. The stored last-run and last-trigger records refer only to November 20; they show an already-published index recovery and a true Chicago release window. They cannot establish the earlier failure causes. Preserve both DST-compatible schedules and the current release guard. Do not describe four scheduled dates as four automated successes.

For each future Friday after the 10:00 Central release window: compare the scheduled date against the public index, article GET, repository editions, and (once deployed) weekly sitemap. If a date is missing, read the publisher health/status, compare article/index dates and record evidence. Existing article with missing index: use the existing publisher recovery mechanism only under separately authorized operational review. Missing article: prepare a source-checked, labeled editorial draft rather than rerun generation blindly. Do not publish or mail automatically from this review procedure. Invalid index or malformed rows now return a retryable 503 from the dynamic sitemap instead of quietly dropping URLs; the reader archive remains available with known reviewed editions.

Known long-term limit: the publisher index currently retains 104 rows; before reaching that limit, design an authorized complete-history migration with QA and the publisher owner. Do not change retention or enumerate/write production KV as part of this sitemap release.
