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

## Instinct

Version 1.0.5: keyboard mutation selection via W/A/S, ↑/←/↓ and 1/2/3. Desktop waits for a fresh valid movement key after selection (no time passes, no simulation changes); touch immediately resumes. Brood Trail upgrade copy references only orbs instead of captures/kills. Top HUD SESSION BEST is in-memory per mode/expedition, resetting on page reload; persistent personal best and verified leaderboards are untouched. No replay rules-version bump because movement and mutation simulation are unchanged.

**Permanent release-title convention:** See [docs/HIVE-RUN-RELEASE-NAMING.md](docs/HIVE-RUN-RELEASE-NAMING.md). Every update gets one thematic word as its title.

## Lair

Version 1.1 · **Lair**. Unranked, repeatable single-boss practice for Burrow Stalker, Hatchery Warden, Tunnel Weaver, and Rift Guardian. Each scenario uses a fixed seed and correct biome/evolution speed, with the existing boss dossier and 3-second countdown. Boss selection, immediate retry after death/victory, attack warning overlays, and pixel capture/defeat bursts are presentation/solo-only additions. Completing a practice boss ends the practice run; no new mutations or ordinary prey are spawned.

**Ranked safety:** Practice does not request a leaderboard session, cannot submit a score, and cannot modify local or personal record values. Simulation and server replay modules are unchanged; RULES_VERSION remains hive-1.0.2. Brood Trail is unchanged. Full regression tests include all four bosses, seeded reproduction, briefing timing, warning effects, practice victory and ranked-mode isolation.

**One-word release title:** Lair. Preserve the permanent naming policy in docs/HIVE-RUN-RELEASE-NAMING.md.
