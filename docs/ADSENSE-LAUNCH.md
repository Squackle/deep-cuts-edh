# AdSense integration — Deep Cuts EDH
Date: 2026-10-13

**Publisher ID:** `ca-pub-1885127351876276`

The AdSense account must still complete Google's approval and payment verification. Adding the script does **not** confirm approval or guarantee impressions or revenue.

## Included in this release
- Google's exact asynchronous script from the publisher's setup panel, plus `google-adsense-account` meta tag, added **once** inside the HTML `head` on these six public content pages:
  - `/index.html` (also site root `/`)
  - `/library.html`
  - `/reports/chainer-dementia-master.html`
  - `/reports/alena-and-gilanra.html`
  - `/reports/commander-mustard.html`
  - `/reports/ekthi-contaminator-priest.html`
- Root `/ads.txt`: `google.com, pub-1885127351876276, DIRECT, f08c47fec0942fa0`
- Public `/privacy.html` policy with a disclosure of advertising cookies, Google's data use and controls; direct footer links on all ad-enabled pages
- Updated sitemap to include privacy policy

**Not monetized:** Daily puzzle pages, Field Network profiles, account/recovery, nominations, Deck Workshop, supporter checkout, Field Office, operations and diagnostics. The six opt-in editorial/search pages are deliberately the only pages that include Google's script.

**Ad placements:** The script supports AdSense account review and Auto ads. **No manual display ad units are activated**, because Google has not provided any `data-ad-slot` unit IDs. Auto ads need to be enabled in the **AdSense UI** after site approval, and layouts are chosen by Google subject to account settings. Never insert invisible ads, disguise ad links, or click your own ads.

## Publisher tasks in Google AdSense
1. Go to [AdSense Sites](https://adsense.google.com/), select `deep-cuts-edh.pages.dev`, and confirm site code and `ads.txt`. Request review if prompted.
2. Confirm that **site status is Ready**; waiting for review and pending status do not mean serving or payment is active.
3. Under **Ads → Edit (site) → Auto ads**, choose modest in-page banners and limit the maximum number of ads. **Disable Overlay formats** (Anchor, Vignette, Side rail) and **Intent-driven formats** if the goal is minimal interruption. Save the settings.
4. Under **Privacy & messaging**, configure Google's consent-management platform (or another Google-certified CMP) for required European-region consent, and relevant US privacy messages. A privacy page alone is **not** a substitute for required consent collection.
5. Test actual page behavior on mobile and desktop once ads begin; use AdSense settings to exclude intrusive areas.
6. Avoid creating or purchasing traffic, clicking your own ads, refreshing ads to generate views, or mislabeling sponsorships.

Sources: Google's [Connect your site](https://support.google.com/adsense/answer/7584263), [ads.txt](https://support.google.com/adsense/answer/12171612), [Auto ads settings](https://support.google.com/adsense/answer/9305577), [privacy disclosures](https://support.google.com/adsense/answer/1348695), and [consent requirements](https://support.google.com/adsense/answer/7670013).

## Technical QA
- Public `/ads.txt` must respond HTTP 200 with the exact publisher line as text.
- Homepage and five other opted-in pages contain the exact script **once** under `head`, and the corresponding meta tag **once**.
- `/privacy.html` must load without an AdSense ad script.
- No other pages should load the AdSense script.
- Google Search Console's previously verified HTML file and meta tags remain untouched.
- Cloudflare Pages deployment must be successful for the intended GitHub commit.
