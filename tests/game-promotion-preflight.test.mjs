import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {auditPromotion, validateManifest} from '../scripts/game-promotion-preflight.mjs';

const h = data => createHash('sha256').update(data).digest('hex');
const evidence = Object.fromEntries([
  'developerCandidateUrl', 'ownerApprovalUrl', 'releaseManagerReviewUrl', 'securityDispositionUrl',
  'replayTestUrl', 'historyTestUrl', 'browserTestUrl', 'rightsReviewUrl', 'fileOwnershipUrl'
].map(k => [k, 'https://github.com/Squackle/deep-cuts-edh/issues/14']));
evidence.rollbackPlan = 'Revert only this isolated integration PR; preserve historic verified records.';
function setup(t, {game = 'graftbound'} = {}) {
  const scratch = mkdtempSync(join(tmpdir(), 'dc-promotion-'));
  t.after(() => rmSync(scratch, {recursive: true, force: true}));
  const labRoot = join(scratch, 'lab'), siteRoot = join(scratch, 'site');
  mkdirSync(labRoot); mkdirSync(siteRoot);
  const source = game === 'hive-run' ? 'src/engine.js' : 'graftbound/src/engine/run.js';
  const target = game === 'hive-run' ? 'games/hive-run/src/engine.js' : 'src/graftbound-verify/engine/run.js';
  const body = 'export const n = 7;\n';
  for (const [root, path] of [[labRoot, source], [siteRoot, target]]) {
    mkdirSync(dirname(join(root, path)), {recursive: true}); writeFileSync(join(root, path), body);
  }
  const git = (...args) => execFileSync('git', args, {cwd: labRoot, encoding: 'utf8'}).trim();
  git('init', '-q'); git('config', 'user.email', 'synthetic@example.invalid'); git('config', 'user.name', 'Synthetic QA');
  git('add', '.'); git('commit', '-q', '-m', 'synthetic source');
  const manifest = {schemaVersion: 1, game, labRepository: 'Squackle/deep-cuts-game-lab-',
    websiteRepository: 'Squackle/deep-cuts-edh', labSourceSha: git('rev-parse', 'HEAD'),
    websiteBaseSha: 'f'.repeat(40), rulesVersion: game === 'hive-run' ? 'hive-1.5.4' : 'graftbound-rules-1.8.3-beta',
    status: 'hold', evidence: {...evidence}, files: [{source, target, bytes: Buffer.byteLength(body), sha256: h(body)}]};
  return {labRoot, siteRoot, manifest, source, target, git};
}

test('valid exact source and destination, no I/O mutation', t => {
  const x = setup(t); const before = readFileSync(join(x.siteRoot, x.target));
  const report = auditPromotion(x.manifest, x);
  assert.equal(report.ok, true); assert.equal(report.checked, 1);
  assert.deepEqual(readFileSync(join(x.siteRoot, x.target)), before);
  assert.match(report.note, /independent review/);
});
test('source-only plan is explicitly not a destination parity check', t => {
  const x = setup(t); writeFileSync(join(x.siteRoot, x.target), 'wrong');
  assert.equal(auditPromotion(x.manifest, {...x, sourceOnly: true}).ok, true);
  assert.deepEqual(auditPromotion(x.manifest, x).differences.map(d => d.reason), ['content differs']);
});
test('manifest pins the actual checked-out source SHA', t => {
  const x = setup(t); x.manifest.labSourceSha = 'a'.repeat(40);
  assert.throws(() => auditPromotion(x.manifest, x), /HEAD mismatch/);
});
test('changed tracked source is rejected even if an old manifest exists', t => {
  const x = setup(t); writeFileSync(join(x.labRoot, x.source), 'tampered');
  assert.throws(() => auditPromotion(x.manifest, x), /modified tracked files/);
});
test('changed source bytes are rejected even without git mode', t => {
  const x = setup(t); writeFileSync(join(x.labRoot, x.source), 'tampered');
  assert.throws(() => auditPromotion(x.manifest, {...x, checkGit: false}), /Source hash mismatch/);
});
test('missing site destination is a reported nonzero parity failure', t => {
  const x = setup(t); unlinkSync(join(x.siteRoot, x.target));
  const report = auditPromotion(x.manifest, x);
  assert.equal(report.ok, false); assert.match(report.differences[0].reason, /ENOENT/);
});
test('rejects symlinked destination even when its contents match', t => {
  const x = setup(t); const p = join(x.siteRoot, x.target), copy = join(x.siteRoot, 'copy.js');
  writeFileSync(copy, readFileSync(p)); unlinkSync(p); symlinkSync(copy, p);
  const report = auditPromotion(x.manifest, x);
  assert.equal(report.ok, false); assert.match(report.differences[0].reason, /Symlink/);
});
test('rejects symlinked source even when same content', t => {
  const x = setup(t); const p = join(x.labRoot, x.source), copy = join(x.labRoot, 'copy.js');
  writeFileSync(copy, readFileSync(p)); unlinkSync(p); symlinkSync(copy, p);
  assert.throws(() => auditPromotion(x.manifest, {...x, checkGit: false}), /Symlink/);
});
test('rejects outside-lane and traversal destinations', t => {
  const x = setup(t);
  for (const value of ['../functions/api/leaderboard.js', 'games/graftbound-play/../../db/players.sql', 'games/hive-run/src/engine.js', 'src/graftbound-verify/director/cheat.js', 'src/graftbound-verify\\evil.js']) {
    assert.throws(() => validateManifest({...x.manifest, files: [{...x.manifest.files[0], target: value}]}));
  }
});
test('rejects director code, Lab APIs and site-owned bridges', t => {
  const x = setup(t);
  const files = [
    {...x.manifest.files[0], source: 'graftbound/src/director/engine.js'},
    {...x.manifest.files[0], source: 'graftbound/functions/api/scores.js'},
    {...x.manifest.files[0], target: 'games/graftbound-play/site-ranked.js'}
  ];
  for (const entry of files) assert.throws(() => validateManifest({...x.manifest, files: [entry]}));
});
test('rejects duplicate destination aliases and bad byte hashes', t => {
  const x = setup(t); const file = x.manifest.files[0];
  assert.throws(() => validateManifest({...x.manifest, files: [file, file]}), /Duplicate/);
  assert.throws(() => validateManifest({...x.manifest, files: [{...file, sha256: 'abc'}]}), /SHA-256/);
  assert.throws(() => validateManifest({...x.manifest, files: [{...file, bytes: -1}]}), /byte size/);
});
test('gate blocks held releases even with all evidence populated', t => {
  const x = setup(t); assert.throws(() => validateManifest(x.manifest, {gate: true}), /owner-approved/);
});
test('gate blocks missing approval and malformed security evidence', t => {
  const x = setup(t); x.manifest.status = 'owner-approved';
  delete x.manifest.evidence.securityDispositionUrl;
  assert.throws(() => validateManifest(x.manifest, {gate: true}), /securityDispositionUrl/);
  x.manifest.evidence.securityDispositionUrl = 'http://insecure.test/';
  assert.throws(() => validateManifest(x.manifest, {gate: true}), /must be HTTPS/);
});
test('gate can validate completeness without inventing source approvals', t => {
  const x = setup(t); x.manifest.status = 'owner-approved';
  assert.equal(auditPromotion(x.manifest, {...x, gate: true}).ok, true);
});
test('supports separate Hive Run source and website file mapping', t => {
  const x = setup(t, {game: 'hive-run'});
  assert.equal(auditPromotion(x.manifest, x).checked, 1);
  assert.throws(() => validateManifest({...x.manifest, files: [{...x.manifest.files[0], target: 'games/hive-run/src/main.js'}]}), /Site-owned/);
});
test('unknown game or wrong repository is rejected', t => {
  const x = setup(t);
  assert.throws(() => validateManifest({...x.manifest, game: 'other'}), /Unknown game/);
  assert.throws(() => validateManifest({...x.manifest, websiteRepository: 'attacker/repo'}), /Unexpected website/);
});
