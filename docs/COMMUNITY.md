# Field Network — Community Beta (October 13, 2026)

## Rollout scope
One coordinated Cloudflare Pages + D1 change. New files: community.html/css/js, community-features.js, src/community-core.js, src/community-read.js, src/community-social.js, src/community-games.js, functions/api/community.js, db/community.sql. Existing homepage, Workshop, library, nominations, supporters, members, and published reports receive navigation and discussion links.

### Included
- **Public profiles**: distinct 256-bit recovery-key identities, handle, bio, five fixed Scryfall Commander portraits. Profile secret is hashed (SHA-256) server-side and is displayed only on registration; no passwords/emails. Sign-in can remain per tab, or be remembered on this device at explicit opt-in. There is *no recovery* after key loss. These free profiles have no connection to premium Ko-fi entitlements or existing deck-vault keys.
- **Case boards and Deck Doctor**: one moderated discussion per published Rescue Report and per public deck; like a comment, report it to moderation, or hide your own. Server limits posts and reporting.
- **Friends / following**: follow other profiles and specific commander cases. This is one-way following, not a private messaging or reciprocal friend-request system.
- **Deck gallery**: explicitly publish from a local Workshop deck or paste a list. Existing private vaults and read-only share links are not exposed. Public deck version changes and notes retained to 50 versions; user may delete the whole published deck.
- **Playtest lab**: self-reported wins/losses/draws, turns, opposing strategy, notes and matchup statistics. Win-rate estimates display only after at least 10 reported games, with an explicit bias warning. They are not authoritative or independently verified.
- **Rescue challenge**: first Chainer challenge 2026-10-13 through 2026-10-20 UTC, manually curated; one entry per profile, one vote per account (replaceable), no self-votes. Subsequent challenges need editor-controlled DB entries. No automatic prize or award.
- **Badges**: badges based on actual number of visible contributions, tests and published decks, not purchasable ranks.
- **Watchlist**: follow profiles/cases and view new visible comments from them when visiting the page. No external push, email, or scheduled notification delivery.
- **Hidden Gem Scanner**: Scryfall Commander-legal Oracle-text searches sorted toward less prominent EDHREC-ranked results; these are exploratory cards, not a validated commander-specific AI synergy recommendation.
- **Evidence indicators**: test sample sizes and documented contributions. No fabricated Rescue Ratings or unsupported quantitative commander-power scoring.

## Security and privacy
- Account identities are **key-only and unrecoverable**. Show the key once at signup and do not echo it in server logs, links or profile API responses. Warning shown before allowing local-device persistence. A user should export/secure the key before leaving registration.
- Cloudflare Turnstile checks profile creation; no anonymous write actions after creation. D1 per-IP and per-user daily rate limits. Strict server-side input lengths and allowlisted avatar/case values, same-origin POST requests, authentication before user operations.
- Public content is displayed using DOM textContent, not HTML injection. Profiles, decks and comments are publicly readable; personal email addresses are not collected. Moderation reports go to private D1 only.
- Owners can hide their comments and delete decks or the profile. Deletion cascades through the new community tables. It **does not delete** a separately stored deck vault or Ko-fi membership.
- **Staff operations**: inspect reports with: SELECT r.id,r.reason,r.created_at,c.body,p.handle FROM community_reports r JOIN community_comments c ON c.id=r.comment_id JOIN community_profiles p ON p.id=r.reporter_id WHERE r.status='pending' ORDER BY r.created_at; After reviewing, UPDATE community_comments SET status='hidden' WHERE id=?; UPDATE community_reports SET status='resolved' WHERE comment_id=?; Never expose these D1 operations in the public UI.
- Before significant promotion: exercise registration, validation failures, case comments, reporting, profile deletion, deck publishing and version updates on a test identity; check D1 backups and Cloudflare logs. An automated CAPTCHA, abuse detection or a human moderation team does not exist here; the site owner must review reports.
- No public upload endpoints or arbitrary image URLs, no premium entitlement activation and no blanket claim of verified deck performance. No user DMs, push alerts, fully automated weekly resets or real machine-learning ranking.

## Maintenance
- Community schema lives at db/community.sql; all statements are additive/idempotent except the initial challenge seed, which uses INSERT OR IGNORE.
- The current challenge is seeded explicitly and does not roll forward automatically. Change it by inserting another community_challenges row after the previous one closes. Only publish a vetted commander name with a valid UTC window.
- API has two methods GET/POST at /api/community, with action dispatch and bearer-token authentication.
- Backward compatibility: retiring /api/account remains 410; legacy key-only vaults are untouched.
