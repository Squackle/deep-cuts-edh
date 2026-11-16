# Search indexing and organic discovery — Deep Cuts EDH

Canonical public site: https://deep-cuts-edh.pages.dev/
Public sitemap: https://deep-cuts-edh.pages.dev/sitemap.xml
Robots rules: https://deep-cuts-edh.pages.dev/robots.txt

## What a Google Search Console query means
The **Performance → Search results → Queries** report lists terms that
generated impressions/clicks. It is not a list of indexed website pages.
Only seeing the query 'deep cuts edh' can simply mean this new site has
little non-branded search visibility; Google also omits anonymized searches.
Check **Indexing → Pages** (indexed vs non-indexed URLs) separately.

## Public pages we submit
The XML sitemap lists the 24 canonical, static public HTML landing pages:
homepage; Arcade hub, Hive Run and current daily games; featured Rescue
Reports; public discovery, card library and deck research tools; community,
nominations, support and privacy pages. Do not add dynamic user query pages,
work-in-progress prototypes, unshipped games, account profiles, D1/API routes,
diagnostics, private member administration or hidden personal data.

## How to verify Google's actual index status (free Search Console)
1. Open https://search.google.com/search-console and choose the exact
   https://deep-cuts-edh.pages.dev/ property. Verify it if Google asks.
2. Go to **Indexing → Sitemaps**. Submit `sitemap.xml` (not all URLs manually).
   Check if the status is Success and whether Google discovered the URLs.
3. Go to **Indexing → Pages**. Record totals and specific 'Not indexed'
   reasons (discovered/crawled currently not indexed, redirect, noindex, 404,
   canonical mismatch, server error). Do not infer this from Queries.
4. Inspect the exact URL of the homepage and each of the four Rescue
   Reports with **URL Inspection**. Check live test, 'Google-selected
   canonical', indexed status and rendered HTML. Request indexing
   for priority pages only after verifying crawlability.
5. Check **Performance → Pages** to learn which individual landing URLs
   receive impressions. **Performance → Queries** then shows the search
   terms, including brand and non-brand. Expect a delay of several days.
6. Recheck after 1–3 weeks; a sitemap is discovery assistance, not a
   Google guarantee of indexing or ranking. Improve specific pages with
   useful original content and actual third-party editorial links.

## Repository regression tests
`node --test scripts/seo-indexability.test.mjs` is wired to GitHub Actions.
It checks XML sitemap uniqueness, published page existence, page title,
meta description, H1, self-canonical consistency, robots crawlability,
the absence of missing public canonical pages, and deliberate noindex
handling of the private member/profile/operations pages.

A `robots.txt` Disallow rule by itself is not an access-control security
mechanism and does not guarantee de-indexing; enforce real authorization
on private APIs, which these SEO checks do not change.

## Release discipline
When a new indexable public page ships, add its absolute canonical URL to
sitemap.xml and self-canonical/meta description/H1 in the HTML. Include a
lastmod only when it reflects a real, significant public content update.
When retiring a public page, use a deliberate 301/404/410, update its
links/sitemap, and leave no duplicate canonicals.

Current data limitation: connected GSC Wizard trial is expired, so this
repository audit cannot report the real index count or submit the sitemap.
Use the native free Google Search Console interface above without requiring
another paid service.
