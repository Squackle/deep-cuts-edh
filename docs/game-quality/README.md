# Game quality audit — 20 October 2026

**Outcome: functional baseline is strong; increasing reasoning difficulty is not certified.** This is a completed first batch of measurement, browser QA and two isolated Lab presentation fixes. It does not rebalance the 750 campaign puzzles or claim a validated human difficulty equation. Production was not deployed, and no remote account, score, subscription or database was changed.

## Sources and architecture

- Website baseline: `eb5354463a531077a40d3147b5146b4569a6803c` (`Squackle/deep-cuts-edh`).
- Lab baseline: `3d634002b46a957f34fe6009c4a268a0001b1868` (`Squackle/deep-cuts-game-lab-`).
- Website hosts Hive Run and four daily puzzle UIs. `functions/api/daily-games.js` and `arcane-games.js` own daily/practice state and answer validation; isolated fixtures replace D1 in tests.
- Website embeds the Lab's original Stackbreaker UI. Its ranked API uses a separately pinned server engine and immutable daily scenarios; browser messages cannot award wins. Replacing puzzle definitions requires a versioned promotion, not an incidental UI edit.
- Mana Heist lives in the Lab. Its engine, automatic casting, solver, certificates and local save schema remain unchanged. The present campaign has **500** vaults, not the older roadmap's 250. Every vault remains accessible.
- Each Lab game patch has its own `game/<game>-*` branch, restricted to that game's directory. This Website branch owns only new audit tooling, evidence and CI. It does not overlap audit PR #96 or modify the shared Lab catalog.

## Prioritized findings

| Priority | Reproduction / impact | Status |
| --- | --- | --- |
| High, design | Mana Heist: one Island/one blue ward has estimated D=17. Repeat that same ward six times over six turns: D=60, C=43. The formula rewards action/ward counts; a higher number does not establish harder reasoning. | Exact synthetic regression recorded. Shipped D/C retained for compatibility; not certified. |
| High, design | Stackbreaker: exhaustive subsets of each supplied reference line find shorter winning lines in **61/250** cases (10, 11, 11, 14, 15 by galaxy). `sb-07` wins with one response instead of its recorded two. | All 61 witness lines included in JSON. Reference length must not be presented as proven minimum. Efficient alternatives are valid gameplay, not bugs to forbid. |
| Medium, functionality | Stackbreaker: block Scryfall metadata or use a cached image URL whose CDN request fails. Formerly almost blank cards hide identities and abilities. | Separate Lab patch renders escaped local name/cost/text/stats, handles image errors without resetting game state, and gives text-only lands usable height. |
| Medium, usability | Mana Heist: narrow viewport places the vault title under Final Turn/Undo/Restart; status labels disappear. Long titles also have an oversized box on desktop. | Separate Lab CSS patch reserves heading space, restores turn/life labels, and retains touch controls. |
| Medium, verification | At 1,500 states per puzzle, exact graphs finish for only **175/500 MH** and **81/250 SB**. Others are explicitly inconclusive. | No guessed difficulty or unsolvability assigned. Increase/prune search and review curriculum before certification. |
| Medium, maintainability | Four existing website static assertions fail on main: overescaped Hive version regex, stale `action=me`, nonexistent outbound ranked-move literal, and `localStorage` appearing only in a comment. | Already corrected in separate website PR #96; intentionally not duplicated here. Same selected suite: main 59/63, companion PR 63/63. |
| Lower, presentation | Obscurity Ladder still shows broken thumbnails with external images blocked, but names/order controls remain usable. Daily game pages have substantial mobile scrolling. | Follow-up; existing identity and layout preserved. |

The MH structural inventory finds 45 lineage groups, 463 repeated-family candidates and 235 similar-board candidates. These are **review candidates**, not proof of 235 identical strategies. Its structural-only audit reports zero reference replays because that command does not run replays; the separate existing Lab tests exercise certificate routes. Do not conflate those fields.

## What the new equation measures

`decision-graph.mjs` builds a bounded reachable-state graph, deduplicates identical successor states and computes reverse reachability from wins. On the first shortest-action winning route, a critical choice has N distinct legal successors, of which W retain a winning continuation, with `0 < W < N`.

```
bits = log2(N / W)
choicePressure = round(100 * (1 - exp(-(0.65 * mean(bits) + 0.35 * max(bits)) / 3)))
```

There is **no action-count, ward-count, stage-number or route-length term**. Forced padding and duplicate equivalent actions do not increase this score. Real-engine regression confirms repeating the same two-turn tap/cast/end pattern six times does not increase its choice pressure, though it takes more actions. Introducing the first turn-ending choice can change pressure; obvious bad choices can still inflate this proxy.

This is a **non-empirical choice-pressure diagnostic**, not a complete measure of thought, lookahead, novelty, player skill, fun or cognitive load. It is sensitive to the selected shortest route and can count obviously bad alternatives. It does not prove an optimal human strategy. Search exhaustion produces `inconclusive`, never a difficulty number.

The Stackbreaker adapter pools current free basic lands before search to remove commuting tapping permutations. It uses every engine-exposed cast, target, payment and pass. It explicitly rejects unsupported snapshot types. This assumption must be revisited if land timing/reactions/phase-dependent effects change. Subset witnesses preserve reference order and default payments: they establish an upper bound on needed responses, **not a globally optimal solution**.

`progression.mjs` is a proposed authoring gate: no proven-unsolvable puzzle, >=90% exact coverage per 50-level band, median pressure rising by >=3, and no overstatement of reference response counts. The thresholds are policy suggestions, not player-calibrated values. **Both current campaigns fail this gate.** Incomplete late-band samples cannot establish that later galaxies are easier. Alternate solutions should trigger documentation/reference review, not artificial restrictions on players.

## Executed checks and limits

| Check | Result / actual scope |
| --- | --- |
| Existing complete Lab suite, baseline | **725/725**; existing Hive simulation, 250 Stackbreaker routes, 500 Mana Heist certificates, Learn/bonus and prototype tests. Certificate replay proves a route, not optimality or independent MTG correctness. |
| Mana Heist after CSS patch | **215/215** existing tests. |
| Stackbreaker after fallback patch | **258/258**, including four new renderer/escaping regressions. |
| New analyzer unit tests | **8/8**: padding, constrained branches, cycles, budgets and progression rejection. |
| Real-engine integration | Pass: 500/250 inventory, repetition invariant and `sb-07` shorter legal win. |
| Full campaign analysis | All 750 attempted, **858,396 states** visited; 256 complete / 494 inconclusive / zero proven unsolvable. Every recorded subset witness is replayed through the real engine. |
| Existing website Chromium suites | **17/17**: four daily practice games as guest and synthetic signed-in user, refresh/privacy, Arcade navigation, Hive Hunt/Brood Trail/Broodmother launch and extra Case File coverage imported by existing tests. |
| New Lab browser regression | **6/6** cases: MH/SB at 320×568, 390×844, 1280×900. Render, no JS exceptions/sideways overflow, solve first puzzle, MH save/refresh, SB reset, title/control separation, missing metadata and cached broken image fallback. |
| New website browser inspection | **10/10**: four daily games plus Hive at 390/1280; render, no JS exceptions/sideways overflow, isolated API fixtures and screenshots. This is rendering coverage, not ten extra complete playthroughs. |
| Selected website game/API tests | Main **59 pass / 4 stale assertions fail**. The same command on companion PR #96 is **63/63**. The protected shared-avatar fixture discussed in that PR is outside this selected command and still blocks its full suite. |

Screenshots inspected include all four daily mobile games, Cipher desktop, Hive mobile, MH phone/desktop and SB phone/desktop. The parchment/forest/gold identity is coherent; controls and objectives remain legible in inspected cases. This is a qualitative inspection, not an accessibility or aesthetic certification. No physical phones, Safari/WebKit, screen reader, full contrast audit, complete late-stage UI walkthrough, every advanced prototype UI, long-session human enjoyment test or production authenticated run was performed. Final Turn/advanced prototypes have existing engine tests but were not independently browser-certified here.

## Repeatable commands

Use Node 24. Run website commands from this repository. Point `LAB` and `STACK` at isolated local checkouts of the relevant Lab branches; never point these harnesses at production URLs.

```sh
node --test tests/game-quality/*.test.mjs
node scripts/game-quality/integration.mjs "$LAB"
node scripts/game-quality/run.mjs "$LAB" /tmp/game-evidence.json 1500
# Explicit certification attempt: currently exits 1, as intended.
node scripts/game-quality/run.mjs "$LAB" /tmp/game-evidence.json 1500 --gate

# Requires playwright-core 1.56.1 and its Chromium headless shell.
# PR #96 supplies the root development package; otherwise install locally:
npm install --no-save --no-package-lock playwright-core@1.56.1
node node_modules/playwright-core/cli.js install chromium --only-shell
node scripts/game-quality/browser.mjs "$LAB" "$STACK" /tmp/lab-game-screens
node scripts/game-quality/site-browser.mjs /tmp/site-game-screens

# Existing browser suites look for Chrome on PATH (or CHROME_BIN in some files).
node --test tests/practice-browser.test.mjs tests/hive-run-browser.test.mjs tests/arcade-journey-browser.test.mjs
node --test tests/*daily*.test.mjs tests/practice-games.test.mjs tests/arcane-hints.test.mjs tests/stackbreaker*test.mjs tests/hive-audit-fixes.test.mjs tests/hive-main-integration.test.mjs tests/hive-beacon-promotion.test.mjs

# From Lab (each game branch separately):
node --test tests/*.test.mjs stackbreaker/tests/*.test.mjs mana-heist/tests/*.test.mjs
python stackbreaker/build.py
```

`.github/workflows/game-quality.yml` tests the analyzer and reproduces committed evidence against the exact baseline Lab SHA with read-only repository permissions. **A green reproducibility check does not mean the campaigns pass difficulty certification.** Browser verification of companion patches is a separate command because these three branches have independent review/promotion boundaries.

## Security and compatibility

No authentication, payment, membership, game legality, score formula, daily manifest, public leaderboard or save version changed. Local fallback text is escaped (including fetched Oracle metadata); tests cover injected markup. Browser harnesses abort outside traffic and stub local APIs. Practice endpoints run against in-memory fake D1, not real accounts. Source inspection and mocked ranked replay tests do not replace live permission/security verification. This audit does not claim the current simplified Magic engines are fully Oracle-accurate; no rules change or independent official-rules/Forge certification was undertaken.

## Next development batch, in order

1. Review the two Lab fixes, run their browser regressions on the reviewed heads and physical phones, and separately authorize a Lab preview/release. Production promotion remains a distinct approval.
2. Build a **small unranked curated difficulty ladder** before rewriting all 750 boards. Tag the actual decision dependency of each puzzle. MH tiers should combine flexible mana allocation, opportunity costs, delayed resources and constrained life/turn budgets. SB tiers should combine target selection, ordering, payment reservation and protecting the actual objective. Require choices whose consequences interact; independent extra wards/threats do not qualify by themselves.
3. For each new tier, record a legal witness, counterexamples to greedy choices, distinct strategy families, delayed consequence depth and alternate wins. Compare equal-length examples across tiers; remove padding from the difficulty argument. Improve solver state normalization before increasing budgets blindly.
4. Use the existing opt-in local playtest records plus consented human trials to compare first-attempt solve rate, active solve time, restarts and hint dependence by cohort. Calibrate ratings to those observations. No valid target success percentages can be inferred from the current tests alone.
5. Only after rules review, solvability, curriculum diversity and human results agree, promote a versioned campaign/rating revision with saved-puzzle compatibility and matching ranked replay data. Keep prior daily manifests immutable. Do not force a mathematically rising number onto repetitive content.

Rollback of the current patches is a source revert; no data migration or record rollback is needed.

### Build reproducibility finding

Stackbreaker's canonical rebuild exposed existing source/bundle drift. Alongside the fallback, regenerated HTML synchronizes previously committed free local black spell-effect cosmetic availability/disclosure and ranked-status copy, and reorders embedded data/modules. This is disclosed in its separate PR. Card definitions, engine, generator, Commander adapter, original/expansion scenarios and daily-manifest contents were verified identical in the old and regenerated HTML. Local cosmetic preview does not grant membership or authenticated achievements.

Both new visual regressions were also run against the unmodified baseline: Mana Heist fails the heading/control intersection assertion at 320px; Stackbreaker fails the readable fallback assertion with Scryfall blocked. Both pass with the patches.

## Review branches

- [Mana Heist PR #128](https://github.com/Squackle/deep-cuts-game-lab-/pull/128), tested tree `b4083bcf8b057eae8d329231f84c61abd3e666b0`, remote head `b9c932dbf79c72863ca8639d9ef019f03cdcc09d`.
- [Stackbreaker PR #129](https://github.com/Squackle/deep-cuts-game-lab-/pull/129), tested tree `8f9995a53075512c2de0ba7bfcb87d487c62feff`, remote head `aeaadd968d3238a4459f8a6ae5aa332c43ff8567`.
- [Earlier website audit PR #96](https://github.com/Squackle/deep-cuts-edh/pull/96): separate API fixes and test setup. Its remaining protected avatar fixture and preview configuration blocker are not resolved by this game-quality batch.

The complete Lab suite after the Stackbreaker patch is **729/729** (original 725 plus four renderer tests). This run uses baseline Mana Heist CSS; the separate Mana Heist tree passed its 215 tests and the combined browser harness. Counts overlap and must not be added as independent coverage.

### CI follow-up — 21 October 2026

The first published Website head passed audit reproducibility, site quality, the safe security sweep and release coordination, but CodeQL reported two high-severity findings. The local browser servers now preload an explicit asset snapshot: incoming URLs only select an existing in-memory entry and never form a filesystem path. Hidden files, dependency trees and symlinks are excluded; non-read methods are rejected. A regression covers traversal encodings, symlink escapes, private files, writes and files introduced after startup. All **9** audit/server tests and all **16** new browser cases pass after this hardening. Fresh remote checks must be consulted before merge; the existing Workers preview-build failure also remains a separate deployment-configuration concern.

Both game PRs passed all reported CI checks. Cloudflare's existing GitHub integration automatically created isolated branch previews; no manual deployment or production promotion was performed. Their preview URLs and exact-head status are recorded in the PR descriptions. Local browser QA is not represented as verification of those hosted previews.
