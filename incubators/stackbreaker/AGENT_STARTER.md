# DEEP CUTS EDH — STACKBREAKER
## Independent game agent starter / source of truth v0.1

**Prepared:** 2026-10-15  
**Status:** DESIGN HANDOFF — NOT A RELEASE OR PRODUCTION DEPLOYMENT  
**Game:** Stackbreaker — The Last Response  
**Workspace:** GitHub `Squackle/deep-cuts-edh`, branch `game/stackbreaker-incubator-20261015`, exclusively `incubators/stackbreaker/**`  
**Starting file:** `incubators/stackbreaker/AGENT_STARTER.md`  
**Coordination:** https://github.com/Squackle/deep-cuts-edh/issues/14  
**Production Arcade:** https://deep-cuts-edh.pages.dev/games — do not edit or deploy.

## Mission
Develop a satisfying, accurate, mobile-first *tactical timing puzzle*, where the player responds to a dangerous tabletop-fantasy game state, sequences actions, resolves a visible last-in-first-out stack, and learns **why** the outcome follows. Build a tightly bounded original rules system inspired by priority/stack reasoning, **not** a full Magic: The Gathering simulator and not a direct recreation of protected Magic cards or artwork. No daily requirement. Guests can play indefinitely; profile badges/leaderboards are later, separate site integrations.

## Your lane: hard separation
- **You own only** `incubators/stackbreaker/**` on the named branch. Put your HTML, CSS, JS, puzzle data, local tests, illustrations, docs and build scripts **inside that folder**.
- **Never modify** `main`, `games.html`, `games.css`, global navigation, `functions/**`, `src/**`, `db/**`, `.github/**`, root `tests/**`, root `package.json`, `games/hive-run/**`, or `incubators/mana-heist/**`.
- A different future agent owns `game/mana-heist-incubator-20261015` and `incubators/mana-heist/**`. Existing Website Dev owns production integration, Hive Run Dev owns the separate Hive Run Lab; Project Assistant coordinates GitHub work. Do not rewrite their code or merge their branches.
- Do not add a production route, scores, auth integration, remote writes, migrations, external dependencies or Cloudflare project without a *new, specific* owner authorization. An owner-approved prototype can run locally via a static server.
- Before every development session, check the current named branch SHA, open PRs and coordination issue #14. Commit only your lane; no direct pushes to protected `main`, no automatic merge, no deployment claim. Record commit SHAs and QA evidence in your own progress notes.
- When ready for integration, hand Website Dev a *tested immutable commit* and a concise list of files, required assets, rules/version caveats and test evidence. Website Dev separately ports it to `/games/stackbreaker` by reviewed PR after explicit approval. Your source branch is **not** the production branch.

## Player promise
> "One move from defeat. Find the response that changes everything."

A session begins with an intelligible state and an immediate threat. Player chooses actions, taps **Resolve next / Pass priority**, sees the stack update, and either succeeds or receives an informative explanation. Puzzle replay should take 1–5 minutes; avoid lengthy tutorial text on screen.

## Mechanic contract, version sb-core-0.1.0
**Must support in MVP:**
1. Visible actors: player/opponent, life, a small unit board, available responses, and a stack with top-first visual ordering.
2. Each scenario starts at a precisely defined priority window. Available **legal actions** have explicit costs, targets and effects. Costs are paid on activation, before the effect resolves.
3. Player can activate a response or pass. Resolution is deterministic: after both parties pass consecutively with a nonempty stack, the **top** stack object resolves; return priority as specified. A fictional puzzle opponent follows a **scenario-scripted policy**, not a random smart AI.
4. Effects have a very small whitelist: deal damage, gain life, destroy unit(s), sacrifice a unit as cost, grant indestructible until end of turn, counter a stack object, or modify a supported target. Implement only effects actually used by the shipped scenarios.
5. Objectives are state predicates, e.g. `survive`, `keepAtLeastNUnits`, `counterThreat`, `winWithRemainingLife`. Do **not** hardcode a single answer sequence when more than one legal solution may exist.
6. A deterministic, side-effect-free transition function drives the UI and the test oracle. Render via text DOM or canvas as you prefer; keep UI divorced from logic.
7. Include undo/restart, an accessible narration of the stack, controls for touch, mouse and keyboard, and a meaningful explanation at the end.

**Strict exclusions until explicitly approved:** full combat, complete layer system, replacement-effect taxonomy, comprehensive Magic Comprehensive Rules implementation, collecting official MTG cards, automatic AI-generated rules answers, multiplayer, public ranked scores, real account keys and D1.

**Rules correctness caveats:** Indestructible prevents destruction, but not sacrifice; sacrificing a source as a cost does not normally remove its already activated ability from the stack. Mana abilities can follow different timing from spells and regular abilities; simplify to prepaid action budgets in v1 and disclose that the game uses an original restricted ruleset. Never present a simplified game as an authoritative MTG judge.

## Launch-level progression (start with 12 authored scenarios)
- **Apprentice (4):** one response, stack order, protect a board, simple counter.
- **Investigator (4):** activate-and-sacrifice, different targets, two responses and resource conservation.
- **Mastermind (4):** 3–4 stack objects, opponent scripted reply, alternate paths, efficiency bonus.
- Increase to 15–20 *after* a validated core. Story flavor stays original and concise.
- Award 1–3 local stars by success and resource efficiency. Never award stars for random speed alone. Be generous about retrying.

## Suggested canonical scenario data schema (illustration, NOT verified shipped content)
```json
{
  "id": "sb-apprentice-001",
  "engineVersion": "sb-core-0.1.0",
  "title": "The Last Shelter",
  "intro": "A sweeping destruction effect is on the stack. Keep two allies alive.",
  "priority": {"activeActor": "opponent", "currentActor": "player"},
  "units": [
    {"id": "warden", "owner": "player", "alive": true, "indestructible": false},
    {"id": "scout", "owner": "player", "alive": true, "indestructible": false},
    {"id": "mage", "owner": "player", "alive": true, "indestructible": false}
  ],
  "stack": [{"id": "storm", "controller": "opponent", "effect": {"type": "destroyAllUnits"}}],
  "availableActions": [{
    "id": "lastShelter", "label": "Warden's final ward",
    "cost": {"type": "sacrifice", "unitId": "warden"},
    "effect": {"type": "grantIndestructible", "scope": "otherFriendlyUnits", "until": "endOfScenario"}
  }],
  "opponentPolicy": {"type": "alwaysPass"},
  "objective": {"type": "friendlyAliveAtLeast", "value": 2},
  "explanation": "Sacrifice the warden to put its ward on top of the sweeping effect. The ward resolves first, so the remaining two allies survive destruction."
}
```
Implement schema validation. `until: endOfScenario` is an **intentional game simplification**. The example must be verified against your own engine; never claim a level is solved just because it was authored.

## Architecture inside your folder
```
incubators/stackbreaker/
  AGENT_STARTER.md     # this file; requirements and boundaries
  index.html           # standalone prototype, linked assets relatively
  styles.css
  src/engine.js        # pure rules transitions
  src/controller.js    # input/render orchestration
  src/schema.js        # puzzle validation
  data/scenarios.json  # authored cases
  tests/engine.test.mjs
  tests/scenarios.test.mjs
  README.md            # run commands + progress
```
Choose ESM and browser-native APIs first. If package management is truly necessary, keep it in this folder, and audit the dependency impact. Do not build data fetches or API requests into the prototype.

## Acceptance gates before asking for integration
- All starter scenarios load, validate and are independently solvable; at least one meaningful failed path per scenario.
- Reducer determinism: same state/actions => same result; no hidden timer/randomness affecting correctness.
- Reject illegal costs/targets. Stack order and pass-priority transitions are tested, including multiple consecutive passes.
- Cover indestructible vs destruction, sacrifice-as-cost, counters, and resolution where source no longer exists.
- All player-generated text treated as plain text; no HTML injection.
- Accessible screen-reader status for stack/state; visible focus, 44px-ish touch targets, no horizontal scrolling at 320, 390, 768 and 1280px.
- No official MTG artwork or branding copied into standalone gameplay; avoid presenting unverified rules as official.
- Full test commands/results recorded in README with screenshot or browser evidence when available.
- Distinct Git branch/workspace verified; no files outside `incubators/stackbreaker/**` changed.

## Milestones / scope and priorities
1. **M0:** Write README, data validator, transition tests and first two scenarios (do not polish visuals first).
2. **M1:** Playable accessible interaction and clear stack resolution plus 12 real scenarios.
3. **M2:** Original illustrated/animated presentation, optional hint mode, sound toggle (never required), 1–3-star local completion.
4. **M3:** Hardening and full browser QA. Prepare handoff to Website Dev; DO NOT SELF-DEPLOY to production.

## Arcade integration contract (Website Dev owns)
- Future URL `/games/stackbreaker`, entirely optional and non-daily.
- Existing Arcade remains one global **ARCADE** tab; no new top-level navigation or giant home banner. In the future, place a compact entry in a “Play anytime” grouping with Hive Run and Mana Heist.
- Browser guest progress may be kept under a uniquely named local key such as `dc-stackbreaker-progress-v1`; never read or overwrite Hive Run/daily-game storage.
- Future Field Network sync/achievements require server authorization and abuse protection; no claims of public ranked scores until validated server-side.

## Important handoff template
`STACKBREAKER | branch <branch> | commit <full SHA> | engine sb-core-<version> | scenarios <N> | tests <commands/results> | unresolved rules caveats <details> | changed paths <list> | request website promotion: YES/NO`

**First task for the new agent:** inspect this file, confirm branch and lane, implement the schema validator + engine reducer and the first two educational cases, then report what tests passed. **Do not start by editing the production Arcade.**
