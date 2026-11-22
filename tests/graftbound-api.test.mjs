// Main-site GRAFTBOUND integration tests: real Community auth (bearer key + device cookie), launch flag, server
// replay verification, anti-cheat, leaderboards, privacy and the D1 migration/rollback. Uses an in-memory SQLite D1.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { d1 } from './helpers/d1-sqlite.mjs';
import { hash } from '../src/community-core.js';
import * as API from '../functions/api/graftbound.js';
import { RULES_DIGEST, LAB_SOURCE_SHA, BUILD_ID, RULES_VERSION } from '../src/graftbound-verify/server-replay.js';
import { playRanked } from './helpers/graftbound-ranked-bot.mjs';
import { rulesDigest, fileUrl } from '../scripts/graftbound-pin.mjs';
import { RULES_FILES } from '../src/graftbound-verify/rules-files.mjs';
import { createHash } from 'node:crypto';
import { challengeFor } from '../src/graftbound-verify/engine/ranked.js';

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

// Decision bot: the Game Lab's own ranked test bot, driving the pinned engine copy.
const { run: REF, log: LOG } = playRanked();

test('pinned rules: digest matches the copied engine; verifier imports no DOM/rendering code', () => {
  assert.equal(rulesDigest(), RULES_DIGEST);
  const src = readFileSync(new URL('../src/graftbound-verify/server-replay.js', import.meta.url), 'utf8') + readFileSync(new URL('../functions/api/graftbound.js', import.meta.url), 'utf8');
  const imports = src.split('\n').filter(l => /^import /.test(l)).join('\n');
  assert.ok(!/rendering|\/ui\/|audio|live\.js|scryfall-adapter/.test(imports), imports);
  for (const f of ['engine/combat.js', 'engine/ranked.js', 'engine/ai.js']) assert.ok(!/document\.|window\.|getContext\(/.test(readFileSync(new URL('../src/graftbound-verify/' + f, import.meta.url), 'utf8')), f);
  if (process.env.GRAFTBOUND_LAB_SRC) for (const f of ['engine/ranked.js', 'engine/combat.js', 'data/scoring.js']) assert.equal(readFileSync(new URL('../src/graftbound-verify/' + f, import.meta.url), 'utf8'), readFileSync(process.env.GRAFTBOUND_LAB_SRC + '/' + f, 'utf8'), f);
});
test('PIN: verifier copy matches the Game Lab source manifest byte for byte, at a real commit', () => {
  const m = JSON.parse(readFileSync(new URL('../src/graftbound-verify/lab-source-manifest.json', import.meta.url), 'utf8'));
  assert.match(LAB_SOURCE_SHA, /^[0-9a-f]{40}$/); assert.equal(m.sourceCommit, LAB_SOURCE_SHA);
  assert.equal(m.rulesVersion, RULES_VERSION); assert.equal(BUILD_ID, 'graftbound-' + m.gameVersion);
  assert.equal(m.rulesDigestSha256, RULES_DIGEST, 'site digest is computed exactly like the Game Lab manifest');
  assert.deepEqual(RULES_FILES, m.files.map(f => f.path));
  for (const f of m.files) assert.equal(createHash('sha256').update(readFileSync(fileUrl(f.path))).digest('hex'), f.sha256, f.path);
  const challenge = challengeFor(m.challenge.id); assert.equal(challenge.revision, m.challenge.revision); assert.equal(challenge.scoringVersion, m.scoringVersion);
});
test('on-site game client: every rules file is byte-identical to the pinned Game Lab manifest', () => {
  const m = JSON.parse(readFileSync(new URL('../src/graftbound-verify/lab-source-manifest.json', import.meta.url), 'utf8'));
  for (const f of m.files) assert.equal(createHash('sha256').update(readFileSync(new URL('../games/graftbound-play/' + f.path, import.meta.url))).digest('hex'), f.sha256, 'games/graftbound-play/' + f.path);
  assert.match(readFileSync(new URL('../games/graftbound-play/src/config.js', import.meta.url), 'utf8'), new RegExp("version: '" + m.gameVersion.replace(/\./g, '\\.') + "'"));
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
  assert.deepEqual(j.decisions, LOG.slice(0, 10), 'resume returns the accepted decisions so the on-site game can rebuild its replay log');
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
