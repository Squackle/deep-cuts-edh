# DEEP CUTS EDH — MANA HEIST
## Independent game agent starter / source of truth v0.1

**Prepared:** 2026-10-15  
**Status:** DESIGN HANDOFF — NOT A RELEASE OR PRODUCTION DEPLOYMENT  
**Game:** Mana Heist — Crack the Vault  
**Workspace:** GitHub `Squackle/deep-cuts-edh`, branch `game/mana-heist-incubator-20261015`, exclusively `incubators/mana-heist/**`  
**Starting file:** `incubators/mana-heist/AGENT_STARTER.md`  
**Coordination:** https://github.com/Squackle/deep-cuts-edh/issues/14  
**Production Arcade:** https://deep-cuts-edh.pages.dev/games — do not edit or deploy.

## Mission
Create a polished, replayable, mobile-first **original resource-routing logic game**. Players manipulate magical energy sources, converters and relays to open sealed vaults with minimal moves. The five familiar fantasy energy families can feel reminiscent of Commander deck mana decisions, but all symbols, device artwork, story and precise game rules are original. No daily requirement. Begin with a deterministic handcrafted Campaign and an optimal-move replay challenge; add Endless only after a generator+solver are proven reliable.

## Your lane: hard separation
- **You own only** `incubators/mana-heist/**` on branch `game/mana-heist-incubator-20261015`. Keep all prototype code, assets, puzzles, tests and docs in that folder.
- **Never modify** `main`, `games.html`, `games.css`, global nav, `functions/**`, `src/**`, `db/**`, `.github/**`, root `tests/**`, root `package.json`, `games/hive-run/**`, or `incubators/stackbreaker/**`.
- Stackbreaker has a **different agent**, branch and folder. Hive Run Dev owns the separate Hive Run Lab repo; Website Dev owns production Arcade integration, and Project Assistant coordinates scope in GitHub issue #14.
- No production API, backend database, live scoreboard, profile grant, Cloudflare project or changes to existing game content. No merge/deploy until the owner specifically authorizes an integration release through Website Dev.
- Before each coding session, inspect branch SHA, current open PRs and coordination issue #14. Develop and commit only on your own branch; use your own folder-scoped test runners; track achievements as local-only concepts until explicit backend authorization.
- For handoff, record an immutable tested branch SHA, detailed puzzle rules version, solver evidence, optimal solutions and QA. Website Dev alone ports it to a production `/games/mana-heist` route with reviewed PR after owner authorization.

## Player promise
> "Route the energy. Break the seal. Leave nothing behind."

A level displays a clear sealed gate goal, a small grid of magical components, an energy ledger and an action counter. The player rotates/connects certain relays and activates sources/devices in a chosen sequence. Moves are finite and reversible using Undo/Reset. When the gate receives its required resources, it opens, shows a brief celebratory animation and records local stars for efficient play. Puzzle playtime goal: 1–3 minutes each.

## Mechanic contract, version mh-core-0.1.0
The model is deliberately **NOT** the Magic rules engine: it uses independent units of energy with invented glyphs.

### Resource types
Five energy families — e.g. `sun`, `tide`, `shadow`, `ember`, `grove` — plus optional generic `aether` in later content. Store as integer counts; UI must not rely on color alone (symbols/text too). Avoid copying Wizards' official mana icons or card imagery.

### Level components
- **Source:** A fixed, limited-use energy generator. Each activation grants a specified integer resource vector, e.g. 1 tide.
- **Dual source:** On activation pick exactly one of two defined energy outputs; consumes one use.
- **Converter:** Pays a positive resource vector from the accessible pool, then produces another vector; may have limited activations. No free infinite loops.
- **Relay:** Connects routable edges on the tile grid; a limited number of rotations/reconfigurations; routing is deterministic and never animates resources without changing legal state.
- **Reservoir:** Optional, stores explicitly bounded energy for later, separate from the player pool. Do not implement until source/converter/relay logic is stable.
- **Vault seal:** Goal vector of energy; consumes required units only if all are accessible and any routing requirement is satisfied.

**MVP sequencing:** One action at a time; source activation and conversion are atomic. A converter cannot fire without enough accessible input. The gate cannot count resources that were already spent. A move has clear cost and no random effect. Replay a level from initial state with a canonical action log.

**Routing:** In initial tutorial levels, energy is globally accessible (no cables). Starting with the second vault, a 4×4 or 5×5 grid introduces orthogonal connectors and component accessibility. Connections are bidirectional unless a tile explicitly says otherwise. The engine uses one graph traversal routine for reachability; presentation must not fake connections. Keep animation separate from resolution. Puzzles may require routing + optimal activation order, but each mechanic gets a separate tutorial level first.

## Suggested first level data (illustrative, not verified playable yet)
```json
{
  "id": "mh-vault-001",
  "engineVersion": "mh-core-0.1.0",
  "chapter": "The Outer Lock",
  "title": "Turn a Tide",
  "board": {"width": 3, "height": 2, "routing": "global"},
  "goal": {"tide": 2, "ember": 1},
  "components": [
    {"id": "tideA", "type": "source", "position": [0, 0], "outputs": [{"tide": 1}], "uses": 1},
    {"id": "tideB", "type": "source", "position": [1, 0], "outputs": [{"tide": 1}], "uses": 1},
    {"id": "prism", "type": "converter", "position": [1, 1], "input": {"tide": 1}, "output": {"tide": 1, "ember": 1}, "uses": 1}
  ],
  "moveBudget": 4,
  "designNote": "Activate both tide sources; consume one tide in the prism to regenerate it plus ember; pay exactly two tide and one ember to unlock. Three device activations plus gate open, if opening counts as a move."
}
```
The solver must validate this and every authored level. Resources can only be consumed when available. A converter producing more energy than it consumes is allowed if its uses are finite. A gate-opening action counts as a move consistently throughout the campaign; decide and document this early. The example is a proposed specification, not proof of a working build.

## Starter content progression
- **Vault I — Spark (6 levels):** one resource, two-resource gates, limited uses, the illustrated converter.
- **Vault II — Conduit (6 levels):** rotating orthogonal relays, reachable components, blocked paths; tutorialized one at a time.
- **Vault III — Crucible (6 levels):** dual source choices, limited conversions and scarcity.
- **Vault IV — Crown (6 levels):** multi-stage routing, resource storage if implemented, varied solution paths.
- **24 authored levels** for a strong v1 target; start by shipping 6 validated tutorials into the local prototype. All scenarios must be tested against the same pure engine. Do not publish a level if unsolvable.

## Scoring and modes
1. **Campaign:** unlimited attempts, deterministic authored levels; local progress saved by version and level ID.
2. **Perfect Heist:** medals/stars based on solver-computed optimal move count; use BFS/Dijkstra with bounded state; a *legal* completion earns a clear success even when suboptimal.
3. **Endless (future):** algorithmically generate instances, then validate with solver, enforce unique or meaningfully ranked solvability and reasonable search bounds. No Endless mode claims before tests.

## Solver and state model (very important)
- Pure transition function `applyAction(state, action) -> newState | error`, no time/randomness in core gameplay.
- State captures resources, uses remaining, relay rotations, selected path/positions and gate state. Canonical stable key for visited states, with no DOM or mutable reference identity.
- Run BFS for equal-cost move actions, Dijkstra if different costs appear; bound search expansions and report `inconclusive` rather than declare a level impossible on timeout.
- Enumerate legal actions exactly the same way player input does. Do not allow solver-only moves or special privileged state.
- Reject negative supplies, noninteger costs, impossible tile coordinates, overlong layouts, zero-cost unlimited cycles, invalid glyphs, and duplicate component IDs.
- Save local progress to `dc-mana-heist-progress-v1`; do **not** touch daily games/Hive Run/profile keys. Guest play never requires login or a network call.

## Proposed folder layout
```
incubators/mana-heist/
  AGENT_STARTER.md
  index.html
  styles.css
  src/engine.js        # pure reducer and legal actions
  src/solver.js        # BFS optimizer and validation
  src/schema.js        # schema and level validation
  src/controller.js    # board rendering, input, local progress
  data/levels.json     # authored tutorial and campaign
  tests/engine.test.mjs
  tests/solver.test.mjs
  tests/levels.test.mjs
  README.md            # commands/progress/test notes
```
Keep runtime build self-contained; relative assets and no global scripts. If eventually using a package dependency, pin it inside your own folder only.

## Acceptance tests (before integration)
- Every authored level: loads, validates, at least one solution proven, optimal length computed where bounded, no forced hidden information.
- Solver/reducer parity on randomized action sequences; illegal moves never mutate state.
- Save/reload preserves only local guest progress; Reset and Undo are reliable.
- Bad path, disconnected relay, insufficient energy, exhausted source/converter, duplicate activation and gate attempts have explicit error states.
- Color-blind accessibility: each energy uses an original unique icon/pattern plus readable label, not only its hue.
- Keyboard/tab/touch/gamepad-free play at widths 320, 390, 768 and 1280; no scroll trap, no horizontal overflow, 44px-ish controls and clear focus.
- No plagiarism of MTG mana icons, official card art, or external game assets; all visuals and audio original/licensed.
- Entire diff limited to `incubators/mana-heist/**`, branch remains independent of Stackbreaker/Hive Run/main.
- Evidence of tests/screenshots/browsers and precise engine version provided for review.

## Milestones
1. **M0:** Define reducer/data schema and solver, prove the tutorial sample and two negative states.
2. **M1:** 6 polished playable tutorial levels, keyboard and touchscreen, local progress.
3. **M2:** 24 authored levels across four thematic vaults, correct minimal-move scoring.
4. **M3:** Original visuals, accessible feedback, performance/solver limits, desktop/mobile QA. Hand off to Website Dev; DO NOT SELF-DEPLOY.
5. **Future with new approval:** Endless generator, authenticated achievements and ranked profiles.

## Arcade integration contract (Website Dev owns)
- Planned route `/games/mana-heist`, non-daily, free and guest-playable.
- Reuse existing **ARCADE** top nav; optionally show it under a compact “Play anytime” category with Hive Run and Stackbreaker. No extra navbar entry, homepage hero, redundant help card or long landing-page description.
- No new database migrations or backend bindings for v1. A versioned data format and local progress must be robust to changed or retired levels.
- A production integration requires owner sign-off, a separate Website Dev PR, CI/browser QA, and Cloudflare production SHA verification.

## Progress handoff template
`MANA HEIST | branch <branch> | commit <full SHA> | engine mh-core-<version> | validated levels <N> | solver guarantee <details> | tests <commands/results> | outstanding blockers <list> | changed paths <list> | request website promotion: YES/NO`

**First task for the new agent:** inspect this document and named branch; implement level validation, pure transitions, BFS solution verification and the first two levels within `incubators/mana-heist/**`. **Do not edit the production Arcade.**
