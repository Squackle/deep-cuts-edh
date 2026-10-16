# DeepCutsEDH — MTG rules verification standard

**Applies to all DeepCutsEDH agents:** website developer, Project Assistant, Hive Run developer when making MTG rules claims, Stackbreaker and Mana Heist developers, reviewers, content researchers, and future game agents. Effective as a proposed shared policy once reviewed/merged in both repositories. This is a research/testing policy, **not** a dependency-install, game-engine migration, deployment, or authorization to alter production.

## Source-of-truth order

1. **Official Wizards of the Coast current Comprehensive Rules** — https://magic.wizards.com/en/rules . Open the latest published version; record its effective date and the relevant numbered rules/subrules. An older cached PDF may be superseded.
2. **Official current Oracle text and card rulings** in Gatherer — https://gatherer.wizards.com/ . Verify *the actual card name, wording, and applicable face(s)* rather than reasoning from older printed text or another card's effect.
3. **Official Wizards release notes / rules update bulletins / format and banned-list materials**, when relevant (especially new mechanics, set releases, Commander legality). Official rules and Oracle text take precedence over explanatory summaries when they disagree.
4. **Supporting references** such as Scryfall may help discover cards, search text, or link users to information, but are not a substitute for current official rules or Oracle wording.

## Independent cross-check: Forge

- For complex, ambiguous, newly implemented, or contested MTG interactions, **also consult Card-Forge/forge when reasonably practical**: https://github.com/Card-Forge/forge . Check relevant documented behavior, card implementation, tests, or reproduce the situation in a real Forge build if available.
- Forge is **an independent, unofficial Java implementation**, not an official judge or a source of rules authority. A result from Forge may expose a bug or unsupported corner case, in either Forge or our game.
- Distinguish **“inspected Forge source/test,” “reproduced in Forge [build/commit],”** and **“Forge not checked/unavailable.”** Never describe a repository search as an executed gameplay test.
- If Forge and official sources disagree, **follow the official rules/Oracle text**, record the discrepancy and evaluate a focused regression test. Do not revise published game logic solely to match Forge.
- Reading Forge as a reference does not authorize copying its GPL-3.0 source, including it in browser bundles, adding a Java runtime/service, or importing assets. Any integration requires a separately scoped architecture, licensing, security, and owner-approval review.

## When agents must verify

Verify before publishing or changing a concrete rules-dependent claim: priority, the stack, targeting, casting timing, triggers, replacement/prevention effects, damage/state-based actions, continuous-effect layers, Commander color identity/legality, card descriptions, puzzle solutions, or legal game outcomes. This covers Stackbreaker, Mana Heist, the Deck Workshop, rules Q&A, editorial content, daily games, and future MTG-themed tools. Invented/original Hive Run mechanics should not be incorrectly presented as official MTG rules.

## Evidence expected in work orders / PRs / answers

- **Rules question / scenario:** exact starting objects, controller, target, timing, format, and desired result.
- **Official verification:** link to current rules document, its date, applicable rule numbers, and linked official Oracle card text/ruling; link official format/release notes if relevant.
- **Forge cross-check:** link to code/test or report build/commit and observed result; otherwise state plainly that it was not verified in Forge. Treat this as a second opinion, not a substitute.
- **Conclusion and confidence:** distinguish what official sources prove, what Forge corroborates, and what is still uncertain. Cite conflicting evidence.
- **Project regression:** for game or rules-engine changes, add a positive and negative test for the interaction, run the relevant suites, and maintain game rules-version / deterministic replay parity where applicable. Preserve old scores, progress and existing level IDs unless a separate approved migration specifies otherwise.

**Do not claim a rules interaction is verified merely because a simulated scenario passes the project's own tests.** Likewise, do not block a routine factual answer solely because Forge is temporarily inaccessible once current official sources establish the answer.
