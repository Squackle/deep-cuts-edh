# Hive Run 2.0 — Dominion production promotion candidate

**Owner request:** October 19, 2026, "deploy next step" following the previously authorized Dominion Game Lab QA milestone.

- **Lab source SHA:** `0cd41cd1fa5db1cb0bc453952c541e08a5825a42`
- **Last Hive Run QA merge:** `90828ec5e06d0004d208650fc51e3dfe7f974315`
- **Expected deterministic replay:** `hive-1.5.4`
- **Production branch:** `main`; staging work is ONLY on `game/dominion-2-0-promotion-20261019`, PR #77
- **Game scope:** approved seven-segment Predator Hunt; five bosses ending at Broodmother; growing Brood Trail and real board clear; two separately earned original finales; five WUBRG mutations.
- **Permanent exclusion:** no `director/**`, invulnerability, forced wins, super orbs, Lab-only profiles/sessions, or public score writes from Lab.
- **Score safety:** production-only authenticated service performs exact deterministic server replay; Hatchling Ward is an explicit replay event; client/server must agree on terminal outcome. Continue one-use session, profile ID and rate-limit checks. Retain historical `hive-1.3` ranked rows (including legacy markings). Do not mutate production D1 or its schema during this release.
- **Tests:** GitHub First-party Hive Run verification, site quality/navigation, release coordination and security sweep have passed at promotion branch commit `5214b6c71595d39272e3f29c3e70c85c4785183b` before this documentation-only commit. Rerun checks on the final head and verify Cloudflare Preview exact head SHA.
- **Acceptance still pending:** real Chrome/Edge desktop and physical iPhone Safari/Android Chrome owner checks for both endings, responsive buttons, Game Only, focus, real scores, boss fairness, audio/mute and reduced motion.
- **Production merge:** blocked until device acceptance and reviewed preview, despite automated checks. A Preview deployment is NOT a public production release.
- **Rollback:** revert the single main-site promotion PR if authorized after final QA. Production D1 records remain unchanged.
- **Cloudflare preview:** repository Pages preview deployment setting was previously `none`. It was temporarily scoped to `custom` including ONLY the Dominion promotion branch, without changing production deployments. Return this setting to its intended post-release configuration after owner acceptance.

This is a release-specific record, not a claim that physical signoff or public deployment has already occurred.
