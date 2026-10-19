# Hive Run Dominion 2.0 — final Game Lab parity promotion (October 19, 2026)

**Owner authorization:** “deploy everypart of hive run from the test site to public.” This is a separate, explicitly owner-authorized production promotion following the test-only Lab fix.

**Latest scanned Lab main SHA:** `9533987e5ec28cdbbbf07175a6cda5813b580d16`.
**Last relevant, three-CI-green Hive Run Lab release:** `e08ea173acf003426fc06d095e656c17c046c94a`, [Game Lab PR #117](https://github.com/Squackle/deep-cuts-game-lab-/pull/117).
**Rules version:** `hive-1.5.4` (unchanged: additional rescue applies only to explicitly unranked `lairBoss` runs).

## Production-eligible comparison

A complete SHA-by-SHA inventory of the Lab's Hive Run gameplay `src/**` and background `assets/**` versus the current production `games/hive-run/**` was performed. Backgrounds, art, audio, all five boss abilities, obstacles, mutation synergies, victory sequences, and nearly all pure game modules are already SHA-identical. The ONLY newer shared gameplay modules were Lab `src/engine.js` and `src/lair.js`; copied exactly. Production `src/main.js` is deliberately not replaced, because it contains authenticated first-party score/profile integration. One precisely scoped HUD change mirrors the Lab's `1 FREE BOSS DODGE`. Public-only leaderboard, authentication, and metadata remain intact.

Hunt continues with its one free beginner dodge **only against ordinary prey**, whereas unranked single-boss Lair practice has a one-use rescue from boss/hatchling collision. Wall/self-collision remain lethal. Brood Trail remains unchanged. No ranked D1 migration/reset, scoring API changes, profile changes, or `src/hive-server/leaderboard.js` edits. Historic `hive-1.3` scores remain stored and labeled. This update preserves deterministic ranked replay semantics and keeps score version `hive-1.5.4` because the server never replays `lairBoss` practice runs.

## Permanent exclusions

Do NOT transfer `director/**`, cheat/super-orb/victory showcase tools, local-only Lab `src/solo-session.js` or `src/codex-preview.js`, Lab score APIs, local leaderboards, standalone test-site shell/site navigation, or other games' code. Lab source differences in `index.html`, `styles.css`, and `src/main.js` reflect Lab-only versus public score/profile architecture; selectively integrate only user-visible practice copy and Instinct HUD.

## Verification and rollback

Run Hive Run integration tests, new Lab rescue/hatchling regression suites, client/server replay tests, production release coordination, site quality (including Chromium 390px mobile touch and desktop 1280px real controls), and security. Verify all required workflow runs green at exact final PR SHA before merging; verify Cloudflare Pages public production deployment exact merge SHA. Confirm page and game script load and tested UI mode selection; physical iPhone/Android and live ranked score submission remain independent human/production QA. Revert this sole production PR for rollback; preserve all database contents and other feature PRs.
