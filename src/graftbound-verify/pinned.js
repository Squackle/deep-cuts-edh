// Pinned GRAFTBOUND rules build. The server ONLY verifies replays against this exact rules digest.
// Source: Squackle/deep-cuts-game-lab- main at LAB_SOURCE_SHA, graftbound/ 1.8.3-beta, graftbound-rules-1.8.3-beta,
// real-pool-133-v7, gb-score-2, challenge gb-expedition-01 revision 30.
// RULES_DIGEST must equal rulesDigestSha256 in lab-source-manifest.json (checked by tests/graftbound-api.test.mjs).
// Re-pin: copy the files listed by a new Game Lab manifest, replace lab-source-manifest.json, update LAB_SOURCE_SHA
// and BUILD_ID, then run node scripts/graftbound-pin.mjs --write.
export const LAB_SOURCE_SHA = '367c15af26231b0ea707bd5d3e4ca75d78f32bfa';
export const BUILD_ID = 'graftbound-1.8.3-beta';
export const RULES_DIGEST = '6ddba82f23c4af1790910ce7ef8647f746e4b9eb0a33145297328095d4ccc51e';
