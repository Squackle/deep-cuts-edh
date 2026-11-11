// Main-site GRAFTBOUND integration tests: real Community auth (bearer key + device cookie), launch flag, server
// replay verification, anti-cheat, leaderboards, privacy and the D1 migration/rollback. Uses an in-memory SQLite D1.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { d1 } from './helpers/d1-sqlite.mjs';
import { hash } from '../src/community-core.js';
import * as API from '../functions/api/graftbound.js';
import { RULES_DIGEST, LAB_SOURCE_SHA, BUILD_ID, RULES_VERSION } from '../src/graftbound-verify/server-replay.js';
import { startRanked, applyDecision } from '../src/graftbound-verify/engine/ranked.js';
import { availableNodes } from '../src/graftbound-verify/engine/campaign.js';
import { moveOptions, attackTargets, castOptions, enemies, player, interactOptions } from '../src/graftbound-verify/engine/combat.js';
import { resolveCard } from '../src/graftbound-verify/cards/catalog.js';
import { graftsFull } from '../src/graftbound-verify/engine/run.js';
import { eventChoices } from '../src/graftbound-verify/engine/events.js';
import { manhattan } from '../src/graftbound-verify/core/grid.js';
import { rulesDigest } from '../scripts/graftbound-pin.mjs';

const SCHEMA = ['db/community.sql', 'db/community-avatar-focus.sql', 'db/community-bio-emoji.sql', 'db/portrait-and-device-sessions.sql', 'db/graftbound-ranked-v1.sql'];
const ORIGIN = 'https://deep-cuts-edh.pages.dev';
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
async function profile(db, handle) { const id = hex(16), key = `dcprofile1_${id}_${hex(32)}`; db.raw.prepare('INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)').run(id, handle, await hash(key)); return { id, key, handle }; }
async function deviceFor(db, p) { const tok = 'dcdevice1_' + hex(32); db.raw.prepare('INSERT INTO community_device_sessions(token_hash,profile_id,expires_at) VALUES(?,?,unixepoch()+3600)').run(await hash(tok), p.id); return tok; }
const env = db => ({ DB: db, TURNSTILE_SECRET: 'test-secret' });
const req = (method, path, { key, cookie, body, origin = ORIGIN } = {}) => new Request(ORIGIN + path, { method, headers: { 'CF-Connecting-IP': '203.0.113.' + (key ? key.length % 200 : 9), ...(origin ? { Origin: origin } : {}), ...(key ? { Authorization: 'Bearer ' + key } : {}), ...(cookie ? { Cookie: '__Host-dc_device=' + cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
const post = async (db, who, b, extra = {}) => { const r = await API.onRequestPost({ request: req('POST', '/api/graftbound', { key: who.key, body: { rulesVersion: RULES_VERSION, buildId: BUILD_ID, ...b }, ...extra }), env: env(db) }); return { status: r.status, json: await r.json() }; };
const get = async (db, q, who) => { const r = await API.onRequestGet({ request: req('GET', '/api/graftbound?' + q, { key: who && who.key }), env: env(db) }); return { status: r.status, json: await r.json() }; };
const enable = db => db.raw.exec("UPDATE graftbound_launch_v1 SET enabled=1");

// Decision bot (server-side copy of the Game Lab test bot, using the pinned engine).
function next(run) {
  if (run.phase === 'map') { const o = availableNodes(run.map, run.current); return { type: 'node', node: (o.find(n => n.type === 'shrine') || o[0]).id }; }
  if (run.phase === 'shrine') { const o = run.shrine.options; const k = ['spark', 'restoration', 'arcane', 'offering'].find(x => o.includes(x)) || o[0]; return { type: 'shrine', choice: k, ...(k === 'inscribe' ? { arg: run.spellbook.find(s => s.level < 3).id } : k === 'graftsmith' ? { arg: 0 } : {}) }; }
  if (run.phase === 'event') return { type: 'event', choice: 'leave' };
  if (run.phase === 'reward') { const id = run.pending.cards.find(c => !(run.pending.tier === 'graftsmith' && resolveCard(c).kind !== 'creature') && !(run.pending.tier === 'archivist' && resolveCard(c).kind !== 'spell')); if (!id) return { type: 'skip' }; return { type: 'reward', card: id, ...(resolveCard(id).kind === 'creature' && graftsFull(run) ? { release: 0 } : {}) }; }
  const s = run.battle, p = player(s);
  for (const sp of s.spellbook) { const c = resolveCard(sp.id), o = castOptions(s, sp.id); if (!o.length || c.target === 'empty' || (c.category === 'healing' && p.hp > p.maxHp * 0.6)) continue; return { type: 'cast', id: sp.id, x: o[0].x, y: o[0].y }; }
  const at = attackTargets(s); if (at.length) return { type: 'attack', uid: at[0].uid };
  const near = o => Math.min(...enemies(s).map(e => manhattan(o, e)));
  const mv = moveOptions(s).sort((a, b) => near(a) - near(b) || a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
  if (mv && near(mv) < near(p)) return { type: 'move', x: mv.x, y: mv.y };
  return { type: 'end' };
}
function fullLog(limit = 3000) { const run = startRanked(); const log = []; while (!['won', 'lost'].includes(run.phase) && log.length < limit) { const d = { seq: run.ranked.seq, ...next(run) }; applyDecision(run, d); log.push(d); } return { run, log }; }
const { run: REF, log: LOG } = fullLog();

test('pinned rules: digest matches the copied engine; verifier imports no DOM/rendering code', () => {
  assert.equal(rulesDigest(), RULES_DIGEST);
  const src = readFileSync(new URL('../src/graftbound-verify/server-replay.js', import.meta.url), 'utf8') + readFileSync(new URL('../functions/api/graftbound.js', import.meta.url), 'utf8');
  const imports = src.split('\n').filter(l => /^import /.test(l)).join('\n');
  assert.ok(!/rendering|\/ui\/|audio|live\.js|scryfall-adapter/.test(imports), imports);
  for (const f of ['engine/combat.js', 'engine/ranked.js', 'engine/ai.js']) assert.ok(!/document\.|window\.|getContext\(/.test(readFileSync(new URL('../src/graftbound-verify/' + f, import.meta.url), 'utf8')), f);
  if (process.env.GRAFTBOUND_LAB_SRC) for (const f of ['engine/ranked.js', 'engine/combat.js', 'data/scoring.js']) assert.equal(readFileSync(new URL('../src/graftbound-verify/' + f, import.meta.url), 'utf8'), readFileSync(process.env.GRAFTBOUND_LAB_SRC + '/' + f, 'utf8'), f);
});
test('LAUNCH GATE: production stays blocked until LAB_SOURCE_SHA is a real 40-char Game Lab commit', () => {
  assert.equal(/^[0-9a-f]{40}$/.test(LAB_SOURCE_SHA), false, 'expected to be PENDING in this review PR — replace before enabling the flag');
});
test('migration applies cleanly on the existing community schema, is idempotent, defaults OFF, and rolls back', () => {
  const db = d1(SCHEMA); db.raw.exec(readFileSync(new URL('../db/graftbound-ranked-v1.sql', import.meta.url), 'utf8'));
  assert.equal(db.raw.prepare("SELECT enabled FROM graftbound_launch_v1").get().enabled, 0);
  db.raw.exec(readFileSync(new URL('../db/graftbound-ranked-v1.rollback.sql', import.meta.url), 'utf8'));
  assert.equal(db.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name LIKE 'graftbound_%'").get().n, 0);
  assert.ok(db.raw.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='community_profiles'").get().n === 1, 'existing tables untouched');
});
test('disabled by default (503); unauthenticated (401); cross-origin (403); stale build (409)', async () => {
  const db = d1(SCHEMA); const p = await profile(db, 'Alpha');
  assert.equal((await post(db, p, { action: 'start' })).status, 503);
  enable(db);
  assert.equal((await post(db, { key: null }, { action: 'start' })).status, 401);
  assert.equal((await post(db, p, { action: 'start' }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post(db, p, { action: 'start', rulesVersion: 'graftbound-rules-0.5.0' })).status, 409);
});
test('valid replay accepted in segments; server score equals the engine score; achievements derived from replay', async () => {
  const db = d1(SCHEMA); enable(db); const p = await profile(db, 'Alpha');
  const s = await post(db, p, { action: 'start' }); assert.equal(s.status, 201); const id = s.json.attempt.attemptId;
  let last; for (let i = 0; i < LOG.length; i += 60) { last = await post(db, p, { action: 'segment', attemptId: id, fromSeq: i, decisions: LOG.slice(i, i + 60) }); assert.equal(last.status, 200, JSON.stringify(last.json)); }
  assert.equal(last.json.status, REF.phase); assert.ok(last.json.totals.total > 0);
  const me = await get(db, 'view=me', p); assert.equal(me.json.best.score, last.json.totals.total); assert.ok(me.json.achievements.some(a => a.id === 'first-graft'));
  const again = await post(db, p, { action: 'segment', attemptId: id, fromSeq: LOG.length, decisions: [{ seq: LOG.length, type: 'end' }] });
  assert.equal(again.status, 404, 'a completed run cannot be resubmitted or extended');
});
test('cheating is rejected: fabricated score, modified move, duplicated/skipped decision, wrong seq, tampered fields', async () => {
  const db = d1(SCHEMA); enable(db); const p = await profile(db, 'Bravo'); const id = (await post(db, p, { action: 'start' })).json.attempt.attemptId;
  const seg = LOG.slice(0, 30);
  assert.equal((await post(db, p, { action: 'segment', attemptId: id, fromSeq: 0, decisions: seg.map((d, i) => i === 3 ? { ...d, score: 999999 } : d) })).status, 422);
  const mi = seg.findIndex(d => d.type === 'move'); assert.equal((await post(db, p, { action: 'segment', attemptId: id, fromSeq: 0, decisions: seg.map((d, i) => i === mi ? { ...d, x: 0, y: 0 } : d) })).status, 422);
  assert.equal((await post(db, p, { action: 'segment', attemptId: id, fromSeq: 0, decisions: [seg[0], seg[0]] })).status, 422);
  assert.equal((await post(db, p, { action: 'segment', attemptId: id, fromSeq: 5, decisions: seg.slice(5, 10) })).status, 409);
  assert.equal((await post(db, p, { action: 'segment', attemptId: id, fromSeq: 0, decisions: [{ seq: 0, type: 'node', node: 0, hp: 999 }] })).status, 422);
  const ok = await post(db, p, { action: 'segment', attemptId: id, fromSeq: 0, decisions: seg }); assert.equal(ok.status, 200);
  assert.equal((await post(db, p, { action: 'segment', attemptId: id, fromSeq: 0, decisions: seg })).status, 409, 'save rollback: earlier decisions cannot be re-applied');
  const cp = JSON.parse(db.raw.prepare('SELECT checkpoint FROM graftbound_attempts_v1 WHERE id=?').get(id).checkpoint); assert.equal(cp.ranked.seq, 30);
});
test('profile identity comes only from the session: another player cannot use your attempt id; resume works (bearer and device cookie)', async () => {
  const db = d1(SCHEMA); enable(db); const a = await profile(db, 'Carol'), b = await profile(db, 'Delta');
  const id = (await post(db, a, { action: 'start' })).json.attempt.attemptId;
  assert.equal((await post(db, b, { action: 'segment', attemptId: id, fromSeq: 0, decisions: LOG.slice(0, 5), profileId: a.id })).status, 404);
  await post(db, a, { action: 'segment', attemptId: id, fromSeq: 0, decisions: LOG.slice(0, 10) });
  const cookie = await deviceFor(db, a);
  const r = await API.onRequestPost({ request: req('POST', '/api/graftbound', { cookie, body: { action: 'start', rulesVersion: RULES_VERSION, buildId: BUILD_ID } }), env: env(db) });
  const j = await r.json(); assert.equal(j.resumed, true); assert.equal(j.attempt.attemptId, id); assert.equal(j.checkpoint.ranked.seq, 10, 'resume from the authoritative server state');
  const fresh = await post(db, a, { action: 'start', restart: true }); assert.equal(fresh.status, 201); assert.notEqual(fresh.json.attempt.attemptId, id);
  assert.equal(db.raw.prepare('SELECT status FROM graftbound_attempts_v1 WHERE id=?').get(id).status, 'abandoned');
});
test('two players submit independently; leaderboard = one row per profile, deterministic ties, public fields only', async () => {
  const db = d1(SCHEMA); enable(db); const players = [await profile(db, 'Echo'), await profile(db, 'Foxtrot')];
  for (const pl of players) { const id = (await post(db, pl, { action: 'start' })).json.attempt.attemptId; for (let i = 0; i < LOG.length; i += 200) assert.equal((await post(db, pl, { action: 'segment', attemptId: id, fromSeq: i, decisions: LOG.slice(i, i + 200) })).status, 200); }
  const id2 = (await post(db, players[0], { action: 'start' })).json.attempt.attemptId; for (let i = 0; i < LOG.length; i += 200) await post(db, players[0], { action: 'segment', attemptId: id2, fromSeq: i, decisions: LOG.slice(i, i + 200) });
  const lb = await get(db, 'view=leaderboard', players[1]); assert.equal(lb.json.entries.length, 2, 'no duplicate rows for repeat attempts');
  assert.deepEqual(lb.json.entries.map(e => e.handle), ['Echo', 'Foxtrot'], 'equal score/actions/damage/turns: earliest verified first');
  assert.equal(lb.json.me.position, 2);
  const blob = JSON.stringify(lb.json); for (const pl of players) { assert.ok(!blob.includes(pl.id)); assert.ok(!blob.includes(pl.key)); }
  assert.ok(!/key_hash|email|profile_id|checkpoint/.test(blob));
  const enc = await get(db, 'view=encounter&key=0:0'); assert.ok(enc.json.entries.length >= 1 && enc.json.entries.every(e => e.handle && !('profile_id' in e)));
  const pub = await get(db, 'view=profile&handle=echo'); assert.equal(pub.json.handle, 'Echo'); assert.ok(!JSON.stringify(pub.json).includes(players[0].id));
});
