# Published Rescue Reports RSS (free notifications foundation)

This work continues issue #66, Weekly Dispatch. It does not send email, subscribe anybody, change member records, spend money or alter Card Library.

The public /feed.xml Pages Function reads the deployed homepage index.html and includes ONLY the linked public reports in the nav named "Published Commander rescue reports". Publishing a new approved report AND adding it to this homepage published list introduces a new RSS item automatically following deployment. The full canonical report URL is the stable GUID. Editing titles or moving report order cannot change GUID identity.

The existing four public reports form the initial feed baseline. The owner must confirm the provider does not email the historical archive as if newly published. No item publication dates are invented (RSS permits omission of pubDate). Malformed, duplicate or empty published listings produce HTTP 503 instead of an empty or misleading feed.

This does not automatically discover or publish newly released Commander cards from Scryfall and does not announce randomized Matchmaker suggestions. New reports remain editorially approved.

## Connect free subscriber notifications only after authorized release

1. Verify the public feed at https://deep-cuts-edh.pages.dev/feed.xml has HTTP 200, RSS XML content type and only approved report links.
2. Owner creates a free follow.it publisher account and adds this RSS URL. Never share subscriber emails, provider credentials or recovery keys here.
3. Confirm the provider's historical baseline behavior; free-tier branding or suggested reading may appear and polling may take 5–6 hours.
4. The owner creates a real follow.it subscribe widget and shares its public embed code for a separately reviewed site signup integration. Do not invent a widget or subscribe existing account recovery emails.
5. Once subscribers separately opt in, publish one new genuinely approved report and verify actual opt-in email delivery and unsubscribe before claiming automation works.

The current src/weekly-dispatch-template.js remains a separate unsent HTML/plain-text renderer. No Cloudflare Cron, subscriber D1 schema, paid sending provider or domain migration is part of this PR.

## Verification and rollback

Focused local test: node --experimental-default-type=module --test tests/rescue-report-feed.test.mjs

Full PR gates: site-quality (SEO suite imports RSS tests) and release-coordination. Verify production's exact Cloudflare deployment SHA if a separate release approval is given.

Rollback is a PR revert; no profile, payments, games, private data or existing published pages are removed.
