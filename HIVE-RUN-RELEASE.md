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
