// GRAFTBOUND Ranked Expedition API (main website). Identity comes ONLY from the existing Community session
// (community-core auth: Bearer recovery key or the HttpOnly remembered-device cookie). Disabled until the
// graftbound_launch_v1 flag is enabled after owner-approved review. Scores are computed by server replay only.
import { send, fail, auth, originOK, quota, body, rnd, safe } from '../../src/community-core.js';
import { newCheckpoint, verifySegment, challengeFor, ACTIVE_CHALLENGE, RULES_VERSION, CARD_POOL_VERSION, SCORING_VERSION, BUILD_ID, RULES_DIGEST, LAB_SOURCE_SHA,
  MAX_SEGMENT, MAX_DECISIONS, ACHIEVEMENTS } from '../../src/graftbound-verify/server-replay.js';

async function ready(env) {
  if (!env.DB) return false;
  try { const r = await env.DB.prepare("SELECT enabled FROM graftbound_launch_v1 WHERE feature='ranked'").first(); return Number(r?.enabled) === 1; } catch { return false; }
}
const ch = () => challengeFor(ACTIVE_CHALLENGE);
const pinned = () => ({ challengeId: ch().id, revision: ch().revision, rulesVersion: RULES_VERSION, cardPoolVersion: CARD_POOL_VERSION, scoringVersion: SCORING_VERSION, buildId: BUILD_ID, rulesDigest: RULES_DIGEST });
async function ensureChallenge(db) {
  const c = ch();
  await db.prepare('INSERT OR IGNORE INTO graftbound_challenges_v1(id,revision,rules_version,card_pool_version,scoring_version,build_id,rules_digest) VALUES(?,?,?,?,?,?,?)')
    .bind(c.id, c.revision, RULES_VERSION, CARD_POOL_VERSION, SCORING_VERSION, BUILD_ID, RULES_DIGEST).run();
}
const publicAttempt = r => r && ({ attemptId: r.id, status: r.status, acceptedDecisions: r.accepted_decisions, score: r.score, actions: r.actions, damage: r.damage, turns: r.turns, actsCompleted: r.acts_completed, finishedAt: r.finished_at || null });
const isHandle = h => /^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(h || '');
const ORDER = 'b.score DESC, b.actions ASC, b.damage ASC, b.turns ASC, b.verified_at ASC, b.attempt_id ASC';

async function leaderboard(db, profileId) {
  const c = ch();
  const rows = await db.prepare(`SELECT p.handle AS handle, b.score, b.actions, b.damage, b.turns, b.acts_completed AS actsCompleted, b.completed
    FROM graftbound_best_v1 b JOIN community_profiles p ON p.id = b.profile_id WHERE b.challenge_id=? AND b.challenge_revision=? ORDER BY ${ORDER} LIMIT 50`).bind(c.id, c.revision).all();
  const entries = (rows.results || []).map((r, i) => ({ rank: i + 1, handle: String(r.handle).slice(0, 24), score: r.score, actions: r.actions, damage: r.damage, turns: r.turns, actsCompleted: r.actsCompleted, completed: !!r.completed, profileUrl: '/community?profile=' + encodeURIComponent(r.handle) }));
  let me = null;
  if (profileId) me = await db.prepare(`SELECT position, score, actions, damage, turns FROM (SELECT b.profile_id, b.score, b.actions, b.damage, b.turns, ROW_NUMBER() OVER (ORDER BY ${ORDER}) AS position
    FROM graftbound_best_v1 b WHERE b.challenge_id=? AND b.challenge_revision=?) WHERE profile_id=?`).bind(c.id, c.revision, profileId).first() || null;
  return { challenge: pinned(), entries, me, method: 'SERVER_REPLAY_ONLY' };
}
async function encounterBoard(db, key) {
  const c = ch();
  const rows = await db.prepare(`SELECT handle, score, actions, damage, turns, name, act, nodeType FROM (
      SELECT p.handle AS handle, e.score, e.actions, e.damage, e.turns, e.name, e.act, e.node_type AS nodeType,
        ROW_NUMBER() OVER (PARTITION BY e.profile_id ORDER BY e.score DESC, e.actions ASC, e.damage ASC, e.turns ASC, e.created_at ASC) AS k, e.created_at AS t
      FROM graftbound_encounters_v1 e JOIN community_profiles p ON p.id = e.profile_id WHERE e.challenge_id=? AND e.challenge_revision=? AND e.encounter_key=? AND e.score > 0)
    WHERE k=1 ORDER BY score DESC, actions ASC, damage ASC, turns ASC, t ASC LIMIT 25`).bind(c.id, c.revision, key).all();
  return { challenge: pinned(), encounterKey: key, entries: (rows.results || []).map((r, i) => ({ rank: i + 1, ...r, handle: String(r.handle).slice(0, 24) })) };
}
async function awardsOf(db, profileId) {
  const r = await db.prepare('SELECT achievement_id, awarded_at FROM graftbound_awards_v1 WHERE profile_id=? ORDER BY awarded_at').bind(profileId).all();
  return (r.results || []).filter(x => ACHIEVEMENTS[x.achievement_id]).map(x => ({ id: x.achievement_id, ...ACHIEVEMENTS[x.achievement_id], awardedAt: x.awarded_at }));
}
async function personal(db, profileId) {
  const c = ch();
  const best = await db.prepare('SELECT score, actions, damage, turns, acts_completed AS actsCompleted, completed, verified_at AS verifiedAt FROM graftbound_best_v1 WHERE profile_id=? AND challenge_id=? AND challenge_revision=?').bind(profileId, c.id, c.revision).first();
  const agg = await db.prepare(`SELECT COUNT(*) AS expeditions, SUM(CASE WHEN status='won' THEN 1 ELSE 0 END) AS completions, MAX(acts_completed) AS bestActs, SUM(grafts) AS grafts,
      MIN(CASE WHEN status='won' THEN damage END) AS lowestDamage, MIN(CASE WHEN status='won' THEN actions END) AS fewestActions FROM graftbound_attempts_v1 WHERE profile_id=? AND status IN ('won','lost')`).bind(profileId).first();
  const stage = await db.prepare(`SELECT best_stage FROM graftbound_attempts_v1 WHERE profile_id=? AND status IN ('won','lost') ORDER BY CASE best_stage WHEN 'ascendant' THEN 3 WHEN 'awakened' THEN 2 WHEN 'stirring' THEN 1 ELSE 0 END DESC LIMIT 1`).bind(profileId).first();
  const flawless = await db.prepare('SELECT name, score FROM graftbound_encounters_v1 WHERE profile_id=? AND damage=0 AND score>0 ORDER BY score DESC LIMIT 1').bind(profileId).first();
  const encBest = await db.prepare('SELECT encounter_key AS encounterKey, MAX(score) AS score FROM graftbound_encounters_v1 WHERE profile_id=? AND challenge_id=? AND challenge_revision=? GROUP BY encounter_key ORDER BY encounter_key').bind(profileId, c.id, c.revision).all();
  const hist = await db.prepare(`SELECT id, status, score, actions, damage, turns, acts_completed, accepted_decisions, finished_at FROM graftbound_attempts_v1 WHERE profile_id=? AND status IN ('won','lost') ORDER BY finished_at DESC LIMIT 20`).bind(profileId).all();
  return { best: best || null, stats: { expeditions: agg?.expeditions || 0, completions: agg?.completions || 0, bestActs: agg?.bestActs || 0, grafts: agg?.grafts || 0, lowestDamage: agg?.lowestDamage ?? null, fewestActions: agg?.fewestActions ?? null, bestStage: stage?.best_stage || 'blank' },
    bestNoDamageEncounter: flawless || null, encounterBests: encBest.results || [], history: (hist.results || []).map(publicAttempt) };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), view = url.searchParams.get('view') || 'me';
  if (!await ready(env)) return send({ ok: true, enabled: false, challenge: pinned(), method: 'SERVER_REPLAY_ONLY' }, view === 'me' ? 503 : 200);
  try {
    if (view === 'leaderboard') { const a = await auth(request, env.DB); return send({ ok: true, enabled: true, ...await leaderboard(env.DB, a?.id) }); }
    if (view === 'encounter') { const k = safe(url.searchParams.get('key'), 12); if (!/^[0-2]:\d{1,2}$/.test(k)) return fail('Unknown encounter.'); return send({ ok: true, enabled: true, ...await encounterBoard(env.DB, k) }); }
    if (view === 'profile') {
      const h = url.searchParams.get('handle'); if (!isHandle(h)) return fail('Invalid profile handle.');
      const p = await env.DB.prepare('SELECT id, handle FROM community_profiles WHERE handle=? COLLATE NOCASE').bind(h).first(); if (!p) return fail('Profile not found.', 404);
      const per = await personal(env.DB, p.id);
      return send({ ok: true, handle: p.handle, best: per.best, stats: per.stats, achievements: await awardsOf(env.DB, p.id) });
    }
    const a = await auth(request, env.DB); if (!a) return fail('Sign in to your community profile first.', 401);
    const open = await env.DB.prepare("SELECT * FROM graftbound_attempts_v1 WHERE profile_id=? AND challenge_id=? AND challenge_revision=? AND status='started'").bind(a.id, ch().id, ch().revision).first();
    return send({ ok: true, enabled: true, handle: a.handle, challenge: pinned(), openAttempt: publicAttempt(open), ...await personal(env.DB, a.id), achievements: await awardsOf(env.DB, a.id), verification: 'SERVER_REPLAY_VERIFIED' });
  } catch (e) { console.error('graftbound GET', String(e?.message || e)); return fail('GRAFTBOUND records temporarily unavailable.', 503); }
}

export async function onRequestPost({ request, env }) {
  if (!request.headers.get('Origin') || !originOK(request)) return fail('Origin not allowed.', 403);
  if (!await ready(env)) return fail('Ranked GRAFTBOUND is not yet enabled.', 503);
  const a = await auth(request, env.DB); if (!a) return fail('Sign in to your community profile first.', 401);
  let d; try { d = await body(request); } catch { return fail('Invalid or oversized request.', 413); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return fail('Invalid request.');
  const action = String(d.action || '');
  if (!['start', 'segment', 'abandon'].includes(action)) return fail('Unsupported action.');
  const limit = { start: 20, segment: 1500, abandon: 20 }[action];
  if (!await quota(env.DB, env, request, 'gb-' + action, limit, a)) return fail('Rate limit reached. Try again later.', 429);
  const c = ch(), db = env.DB;
  if (d.rulesVersion !== RULES_VERSION || d.buildId !== BUILD_ID) return fail('This game build is out of date. Refresh to continue.', 409);
  try {
    await ensureChallenge(db);
    const open = await db.prepare("SELECT * FROM graftbound_attempts_v1 WHERE profile_id=? AND challenge_id=? AND challenge_revision=? AND status='started'").bind(a.id, c.id, c.revision).first();
    if (action === 'start') {
      if (open && !d.restart) return send({ ok: true, resumed: true, attempt: publicAttempt(open), checkpoint: JSON.parse(open.checkpoint), challenge: pinned() });
      const stmts = [];
      if (open) stmts.push(db.prepare("UPDATE graftbound_attempts_v1 SET status='abandoned', updated_at=unixepoch(), finished_at=unixepoch() WHERE id=? AND status='started'").bind(open.id));
      const id = rnd(16), cp = newCheckpoint(c.id);
      stmts.push(db.prepare('INSERT INTO graftbound_attempts_v1(id,profile_id,challenge_id,challenge_revision,rules_version,build_id,rules_digest,checkpoint) VALUES(?,?,?,?,?,?,?,?)').bind(id, a.id, c.id, c.revision, RULES_VERSION, BUILD_ID, RULES_DIGEST, JSON.stringify(cp)));
      await db.batch(stmts);
      return send({ ok: true, resumed: false, attempt: { attemptId: id, status: 'started', acceptedDecisions: 0 }, checkpoint: cp, challenge: pinned() }, 201);
    }
    if (!open || open.id !== d.attemptId) return fail('No open attempt with that id for your profile.', 404);
    if (open.rules_version !== RULES_VERSION || open.build_id !== BUILD_ID || open.rules_digest !== RULES_DIGEST) return fail('This attempt is pinned to another rules build.', 409);
    if (action === 'abandon') { await db.prepare("UPDATE graftbound_attempts_v1 SET status='abandoned', updated_at=unixepoch(), finished_at=unixepoch() WHERE id=? AND status='started'").bind(open.id).run(); return send({ ok: true }); }
    // ── segment ──
    const decisions = d.decisions;
    if (!Number.isSafeInteger(d.fromSeq) || d.fromSeq !== open.accepted_decisions) return fail('Out-of-order segment: resume from the server state.', 409);
    if (!Array.isArray(decisions) || !decisions.length || decisions.length > MAX_SEGMENT || open.accepted_decisions + decisions.length > MAX_DECISIONS) return fail('Bad segment size.', 400);
    let res; try { res = verifySegment(JSON.parse(open.checkpoint), decisions); } catch (err) { return fail('Replay rejected: ' + String(err?.message || 'illegal decision').slice(0, 140), 422); }
    const t = res.totals, run = res.run, newSeq = open.accepted_decisions + decisions.length;
    if (run.ranked.seq !== newSeq) return fail('Replay sequence mismatch.', 422);
    const prevKeys = new Set(JSON.parse(open.checkpoint).scoring.encounters.map(e => e.key));
    const stage = ({ 0: 'blank' })[run.evo.absorbed.length] || (run.evo.absorbed.length < 4 ? 'stirring' : run.evo.absorbed.length < 9 ? 'awakened' : 'ascendant');
    const grafts = (run.journal?.entries || []).filter(e => e.kind === 'graft').length;
    // Segment INSERT first: its (attempt, seq_start) primary key makes a concurrent duplicate fail the WHOLE batch.
    const stmts = [db.prepare('INSERT INTO graftbound_segments_v1(attempt_id,seq_start,seq_end,decisions) VALUES(?,?,?,?)').bind(open.id, open.accepted_decisions, newSeq, JSON.stringify(decisions)),
      db.prepare(`UPDATE graftbound_attempts_v1 SET checkpoint=?, accepted_decisions=?, status=?, score=?, actions=?, damage=?, turns=?, acts_completed=?, grafts=?, best_stage=?, updated_at=unixepoch(),
        finished_at=CASE WHEN ?='started' THEN NULL ELSE unixepoch() END WHERE id=? AND accepted_decisions=? AND status='started'`)
        .bind(JSON.stringify(run), newSeq, res.status, t.total, t.actions, t.damage, t.turns, t.actsCompleted, grafts, stage, res.status, open.id, open.accepted_decisions)];
    // Every dependent write is conditional on the attempt having advanced to THIS segment (guards abandon races).
    const GUARD = "WHERE EXISTS (SELECT 1 FROM graftbound_attempts_v1 WHERE id=? AND accepted_decisions=?)";
    for (const e of res.encounters.filter(e => !prevKeys.has(e.key)))
      stmts.push(db.prepare(`INSERT INTO graftbound_encounters_v1(attempt_id,profile_id,challenge_id,challenge_revision,encounter_key,act,node_type,name,score,actions,damage,turns,par_actions,damage_budget) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? ${GUARD}`)
        .bind(open.id, a.id, c.id, c.revision, e.key, e.act, e.nodeType, e.name, e.total, e.actions, e.damage, e.turns, e.parActions, e.damageBudget, open.id, newSeq));
    if (res.done) {
      stmts.push(db.prepare(`INSERT INTO graftbound_best_v1(profile_id,challenge_id,challenge_revision,attempt_id,score,actions,damage,turns,acts_completed,completed,verified_at) SELECT ?,?,?,?,?,?,?,?,?,?,CAST(unixepoch('subsec')*1000 AS INTEGER) ${GUARD}
        ON CONFLICT(profile_id,challenge_id,challenge_revision) DO UPDATE SET attempt_id=excluded.attempt_id, score=excluded.score, actions=excluded.actions, damage=excluded.damage, turns=excluded.turns,
          acts_completed=excluded.acts_completed, completed=excluded.completed, verified_at=excluded.verified_at
        WHERE excluded.score > graftbound_best_v1.score OR (excluded.score = graftbound_best_v1.score AND (excluded.actions < graftbound_best_v1.actions
          OR (excluded.actions = graftbound_best_v1.actions AND (excluded.damage < graftbound_best_v1.damage OR (excluded.damage = graftbound_best_v1.damage AND excluded.turns < graftbound_best_v1.turns)))))`)
        .bind(a.id, c.id, c.revision, open.id, t.total, t.actions, t.damage, t.turns, t.actsCompleted, t.completed ? 1 : 0, open.id, newSeq));
      for (const ach of res.achievements) stmts.push(db.prepare(`INSERT OR IGNORE INTO graftbound_awards_v1(profile_id,achievement_id,attempt_id) SELECT ?,?,? ${GUARD}`).bind(a.id, ach, open.id, open.id, newSeq));
    }
    let out; try { out = await db.batch(stmts); } catch { return fail('Concurrent submission: refresh your attempt.', 409); }
    if ((out[1].meta?.changes || 0) !== 1) return fail('Concurrent submission: refresh your attempt.', 409);
    return send({ ok: true, acceptedDecisions: newSeq, status: res.status, totals: t, encounters: res.encounters.filter(e => !prevKeys.has(e.key)),
      achievements: res.done ? res.achievements.map(id => ({ id, ...ACHIEVEMENTS[id] })) : [], verification: 'SERVER_REPLAY_VERIFIED', labSourceSha: LAB_SOURCE_SHA });
  } catch (e) { console.error('graftbound POST', String(e?.message || e)); return fail('GRAFTBOUND verification unavailable.', 503); }
}
