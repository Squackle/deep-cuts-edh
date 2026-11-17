# Stackbreaker Classic — main-site promotion

- Production route: `/games/stackbreaker/classic/`.
- Lab source: `Squackle/deep-cuts-game-lab-` main commit `2125388d2f69170e15cbd22281b0375ef0a15ddd`, `stackbreaker/index.html`.
- Source is the self-contained **Classic** build from that SHA: inlined card catalog, gameplay engine, scenario data, generated galaxy stages, rendering and rules/UI. The game logic is unmodified; only frame-only chrome, local links and CSS sizing are adjusted for main-site embedding.
- Content: 250 Classic stages, five galaxies, local map/level picker, stars, restart, undo, mana sources, spell targeting, keyboard/pointer/touch interaction.
- Save keys remain `dc-stackbreaker-progress-v3`, `dc-stackbreaker-last-level`, and the bundled local mastery/cosmetic keys. Main-domain saves are distinct from Lab-origin storage.
- `play.html` is intentionally **noindex**: the public `index.html` is the canonical crawlable route. The parent renders the exact main-site header, profile/supporter script and footer. A narrowly scoped Cloudflare header exception allows same-origin embedding of `play.html`; all other pages keep their restrictive frame policy.
- Classic is unranked, uses no production score API and does not alter Daily Stackbreaker verification, D1, player auth or profile ownership. Scryfall-hosted card images have an internal fallback.
- Source audit/rebuild: retrieve the pinned Lab `stackbreaker/index.html`, ensure `python build.py` was run in Lab for that commit, and compare engine/scenario definitions before promoting future mechanics. Run `node --test tests/stackbreaker-classic-promotion.test.mjs` and the companion browser test using Chromium.
- Rights and attribution: educational fan content; continue honoring Wizards/Scryfall image use and attribution rules. This release adds no committed official card image files.
- Rollback: revert the promotion commit. No schema/data migrations required. Previous daily game remains available.
