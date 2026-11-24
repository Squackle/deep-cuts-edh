# Weekly report discovery

The static `/sitemap.xml` remains the inventory of real public static pages. `/sitemap-weekly.xml` is a Pages Function using the same merged published index as `/rescues`; both are advertised in `robots.txt`. It includes canonical dated report URLs, deduplicates valid calendar dates, and does not invent modification timestamps from scheduled issue dates. No per-edition sitemap edit is needed.

If the publisher index fails or has an invalid envelope, the sitemap responds 503 with Retry-After and no-store; the ordinary archive still shows local reviewed editions. A successful response has a five-minute cache policy. No write, subscriber notification, extra service binding or cron is introduced.

After a separately authorized release, verify the exact deployed SHA, GET and HEAD `/sitemap-weekly.xml`, HTTP status and XML type, both robots sitemap declarations, and a representative local edition and publisher-only report (HTTP 200, matching canonical, no noindex). On a healthy archive the XML date set should match the published list. Check Search Console sitemap and selected URL inspection when first-party access is available. A sitemap is a discovery hint, not a guarantee of indexing.

Editorial workflow: keep dates and report data in the existing `src/weekly-rescue-editions.js` review process or publisher's public index; do not create placeholder report URLs. Leave lastmod absent unless a trustworthy per-report modification timestamp is available. Run `node --test tests/weekly-sitemap.test.mjs` and the full site audit.

Rollback: revert the scoped PR to remove the second robots declaration and dynamic endpoint; static sitemap and reports remain intact.

Reference: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap and https://developers.cloudflare.com/pages/functions/routing/.
