# Hive Run 1.0 — Paths of the Hive

Owner-authorized game release on 2026-10-14. Source game repository: `Squackle/deep-cuts-game-lab-`.

- Play at `/games/hive-run/`, linked from the existing games hub.
- Predator Hunt: two minibosses and two three-phase bosses, distinct activated enemy powers, original pixel-art emblems, warnings and safe phase transitions.
- Brood Trail: classic orb-only Snake with original five mutations and environment/music progression.
- Arcade and Daily Ritual have separate boards for each mode; daily seeds reset at midnight America/Chicago. Historical alpha scores stay in their original tables.
- Main-site device-cookie authentication supplies verified profile ownership. Guest links remain unverified. Public profiles show verified records; deleted accounts lose verified leaderboard attribution.
- `DB` remains the community database. Additional `HIVE_DB` binds the existing game database; schema is additive and tracked in the game repo.
- Source export: `node scripts/export-main-site.mjs /path/to/deep-cuts-edh` from the game repository. Identity wrapper and profile integration remain site-owned.

Verification: 75 game/API tests; 320/375/390/768/1280px browser layouts and Game Only controls; deterministic replay checks. Physical iPhone/Android playfeel remains a real-device check. Existing daily Commander-game changes were retained. Deploy through Git-connected Cloudflare Pages; inspect the successful deployed commit.

## First-party game refresh — 2026-10-14
- Synced the current standalone 1.0.4 client into /games/hive-run/ including all keyboard responsiveness improvements, easier ordinary prey, boss briefing/countdown and the optimized four-biome art atlas.
- Replaced the outdated Hive Run API replay engine with the matching client rules version. The same HIVE_DB is bound to both live Cloudflare projects.
- Field Network auth continues to use the main site's HttpOnly remembered-device cookie; the server, not a typed guest handle, decides whether a submission has verified profile ownership.
- Made the main site Games hub and homepage link to the first-party arcade prominently; profile sign-in lives at /community.html#account.
- Public investigator dossiers include verified Hive Run records from all historical rules versions, kept separate per ruleset.
- Past self-declared guest handles are intentionally not promoted to verified identities, even when the same display handle is later used to sign in.

## October 14, 2026 — Classic arcade initials / automatic profile linking

- New public Hive Run high-score entries require **exactly three ASCII letters or digits**; browser entry normalizes to uppercase and the server independently validates the initials.
- Ranked replay verification, per-mode scoreboards and game-rule version remain unchanged. Historical scores are preserved.
- A signed-in Field Network profile is linked **exclusively** from server-validated cookie authentication at submission time, independent of the three-character tag. Guests can still submit unlinked initials.
- Removed the self-reported profile-handle field and prevent legacy unverified guest handles from displaying clickable ownership claims.
- Regression tests verify valid and invalid initials, server-enforced length, uppercase storage, replay integrity, guest spoofing resistance, and verified account links.
