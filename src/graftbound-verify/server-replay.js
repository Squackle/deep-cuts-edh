// GRAFTBOUND authoritative verifier for the main website. Imports ONLY the pinned rules-only engine copy — no DOM,
// WebGL, audio or Game Lab runtime. The browser never supplies damage, scores, RNG or profile ids.
import { installReferenceSet } from './cards/reference-set.js';
import { startRanked, applySegment, verifiedAchievements, challengeFor, ACTIVE_CHALLENGE, RULES_VERSION, CARD_POOL_VERSION, MAX_SEGMENT, MAX_DECISIONS, ACHIEVEMENT_IDS } from './engine/ranked.js';
import { expeditionTotals } from './engine/scoring.js';
import { SCORING_VERSION } from './data/scoring.js';
import { LAB_SOURCE_SHA, BUILD_ID, RULES_DIGEST } from './pinned.js';
installReferenceSet();
export { ACTIVE_CHALLENGE, RULES_VERSION, CARD_POOL_VERSION, SCORING_VERSION, LAB_SOURCE_SHA, BUILD_ID, RULES_DIGEST, MAX_SEGMENT, MAX_DECISIONS, ACHIEVEMENT_IDS, challengeFor };

export const ACHIEVEMENTS = {
  'first-graft': { title: '🧬 First Graft', detail: 'Absorb a creature in a verified expedition.' },
  'untouched-victory': { title: '🛡️ Untouched Victory', detail: 'Win a ranked encounter without losing health.' },
  'efficient-hunter': { title: '🎯 Efficient Hunter', detail: 'Clear a ranked encounter within its action benchmark.' },
  'hollow-conqueror': { title: '🌿 Hollow Conqueror', detail: 'Defeat the Thornmother.' },
  'ashen-conqueror': { title: '🔥 Ashen Conqueror', detail: 'Defeat the Pyre Matron.' },
  'unwritten-end': { title: '📜 The Unwritten End', detail: 'Defeat the Unwritten.' },
  'perfect-expedition': { title: '✨ Perfect Expedition', detail: 'Finish a ranked expedition averaging ≥480 efficiency points per cleared encounter with ≤60 total damage taken.' },
  'graftbound': { title: '👑 Graftbound', detail: 'Finish a verified three-act expedition.' },
};
export function newCheckpoint(challengeId = ACTIVE_CHALLENGE) { return startRanked(challengeId); }
/** Verify one bounded segment against the stored authoritative checkpoint. Throws on any illegal decision. */
export function verifySegment(checkpoint, decisions) {
  const { run, totals } = applySegment(checkpoint, decisions);
  const done = run.phase === 'won' || run.phase === 'lost';
  return { run, totals, done, status: done ? run.phase : 'started', achievements: done ? verifiedAchievements(run) : [], encounters: run.scoring.encounters };
}
export { expeditionTotals };
