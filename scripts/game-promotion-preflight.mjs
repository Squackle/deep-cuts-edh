/**
 * Read-only, offline cross-repository promotion parity check.
 * No network, no writes to either repository, no authentication or scoring.
 * Usage: node scripts/game-promotion-preflight.mjs --manifest <json> --lab <checkout> --site <checkout> [--gate]
 */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync, lstatSync, realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const PATH = /^[a-zA-Z0-9_.@/+-]+$/;
const GAME = Object.freeze({
  'hive-run': {sources: ['src/', 'assets/', 'hive-run/'], targets: ['games/hive-run/']},
  graftbound: {sources: ['graftbound/src/', 'graftbound/assets/'], targets: ['games/graftbound-play/src/', 'games/graftbound-play/assets/', 'src/graftbound-verify/']},
  stackbreaker: {sources: ['stackbreaker/src/', 'stackbreaker/assets/'], targets: ['games/stackbreaker-play/', 'games/stackbreaker/classic/']},
  'mana-heist': {sources: ['mana-heist/src/', 'mana-heist/assets/'], targets: ['games/mana-heist/']},
  archemancy: {sources: ['archamancy/src/', 'archamancy/assets/', 'archemancy/src/', 'archemancy/assets/'], targets: ['games/archemancy/']}
});
const EXCLUDED = /(^|\/)(?:director|DIRECTOR_ONLY|functions|api|db|\.git|node_modules)(?:\/|$)/i;
const SITE_OWNED = /(?:^|\/)(?:site-ranked|site-shell|profile|auth|leaderboard)(?:\.[\w-]+)*\.(?:js|mjs|html)$/i;
const PROTECTED_TARGETS = new Set([
  'games/hive-run/src/main.js', 'games/hive-run/index.html',
  'games/graftbound-play/src/main.js', 'games/graftbound-play/index.html',
  'games/mana-heist/src/main.js', 'games/mana-heist/index.html',
  'games/stackbreaker/classic/index.html'
]);
const REQUIRED = [
  'developerCandidateUrl', 'ownerApprovalUrl', 'releaseManagerReviewUrl',
  'securityDispositionUrl', 'replayTestUrl', 'historyTestUrl',
  'browserTestUrl', 'rightsReviewUrl', 'fileOwnershipUrl', 'rollbackPlan'
];

function assert(condition, message) { if (!condition) throw new Error(message); }
function repoPath(value, prefixes, label) {
  assert(typeof value === 'string' && value.length > 0 && PATH.test(value), `Invalid ${label} path`);
  assert(!isAbsolute(value) && !value.startsWith('/') && !value.includes('\\'), `Unsafe ${label} path: ${value}`);
  assert(value.split('/').every(part => part && part !== '.' && part !== '..'), `Unsafe ${label} path: ${value}`);
  assert(!EXCLUDED.test(value), `Excluded ${label} path: ${value}`);
  assert(prefixes.some(prefix => value.startsWith(prefix)), `${label} path is outside game lane: ${value}`);
  return value;
}
function within(root, path) {
  const resolved = resolve(root, path);
  const rel = relative(root, resolved);
  assert(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `Path escapes checkout: ${path}`);
  const rootReal = realpathSync(root);
  let at = rootReal;
  for (const segment of path.split('/')) {
    at = resolve(at, segment);
    const stat = lstatSync(at); // fails closed on missing files and symlink ancestors
    assert(!stat.isSymbolicLink(), `Symlink is not allowed: ${path}`);
  }
  assert(lstatSync(at).isFile(), `Not a regular file: ${path}`);
  return at;
}
function digestFile(root, path, pinnedBlob) {
  const bytes = readFileSync(within(root, path));
  if (pinnedBlob) {
    const committed = execFileSync('git', ['cat-file', 'blob', pinnedBlob], {
      cwd: root, maxBuffer: 50 * 1024 * 1024 + 1
    });
    assert(bytes.equals(committed), `Source bytes differ from the pinned Git blob: ${path}`);
  }
  return {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
}
function sourceBlobs(root, commit) {
  const tree = execFileSync('git', ['ls-tree', '-rz', '--full-tree', commit], {
    cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024
  });
  const files = new Map();
  for (const entry of tree.split('\0')) {
    const match = /^(?:100644|100755) blob ([0-9a-f]{40})\t([\s\S]+)$/.exec(entry);
    if (match) files.set(match[2], match[1]);
  }
  return files;
}
function verifySiteBaseline(root, expected) {
  const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert(SHA.test(head), 'Website checkout must have an exact Git HEAD');
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', expected, head], {cwd: root, stdio: 'pipe'});
  } catch {
    throw new Error(`Website checkout does not contain declared baseline ${expected}; refresh against current main`);
  }
}
function gitSha(root) {
  const head = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  assert(SHA.test(head), 'Git checkout must have an exact 40-character HEAD SHA');
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {cwd: root, encoding: 'utf8'}).trim();
  assert(!dirty, 'Lab checkout has modified tracked files; use a clean detached source commit');
  return head;
}
export function validateManifest(manifest, {gate = false} = {}) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Manifest must be an object');
  assert(manifest.schemaVersion === 1, 'Unknown manifest schema');
  const lane = GAME[manifest.game];
  assert(lane, 'Unknown game lane');
  assert(manifest.labRepository === 'Squackle/deep-cuts-game-lab-', 'Unexpected Lab repository');
  assert(manifest.websiteRepository === 'Squackle/deep-cuts-edh', 'Unexpected website repository');
  assert(SHA.test(manifest.labSourceSha), 'A full tested Lab source SHA is required');
  assert(SHA.test(manifest.websiteBaseSha), 'A full website baseline SHA is required');
  assert(typeof manifest.rulesVersion === 'string' && /^[a-z0-9][a-z0-9.-]{2,79}$/i.test(manifest.rulesVersion), 'Exact rules version required');
  assert(['hold', 'developer-confirmed', 'owner-approved'].includes(manifest.status), 'Invalid release status');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 3000, 'Manifest must list 1–3000 exact files');
  const targets = new Set();
  for (const [i, entry] of manifest.files.entries()) {
    assert(entry && typeof entry === 'object', `Invalid file entry ${i}`);
    repoPath(entry.source, lane.sources, 'source');
    repoPath(entry.target, lane.targets, 'target');
    assert(!SITE_OWNED.test(entry.target) && !PROTECTED_TARGETS.has(entry.target), `Site-owned bridge/auth path requires a separate reviewed patch: ${entry.target}`);
    assert(!targets.has(entry.target), `Duplicate website destination: ${entry.target}`);
    targets.add(entry.target);
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0 && entry.bytes <= 50 * 1024 * 1024, `Invalid byte size: ${entry.source}`);
    assert(DIGEST.test(entry.sha256), `Invalid SHA-256: ${entry.source}`);
  }
  if (gate) {
    assert(manifest.status === 'owner-approved', 'Promotion gate: explicit owner-approved state is required');
    for (const field of REQUIRED) {
      const value = manifest.evidence?.[field];
      assert(typeof value === 'string' && value.trim().length > 0, `Promotion evidence missing: ${field}`);
      if (field.endsWith('Url')) {
        const url = new URL(value);
        assert(url.protocol === 'https:' && url.hostname, `Promotion evidence must be HTTPS: ${field}`);
      }
    }
  }
  return manifest;
}
export function auditPromotion(manifest, {labRoot, siteRoot, gate = false, sourceOnly = false, checkGit = true}) {
  validateManifest(manifest, {gate});
  assert(!(gate && sourceOnly), 'Promotion gate requires actual website parity, not a source-only plan');
  assert(labRoot && siteRoot, 'Both Lab and site checkout roots are required');
  const sourceRoot = realpathSync(labRoot), destRoot = realpathSync(siteRoot);
  assert(sourceRoot !== destRoot, 'Lab and website checkouts must be different');
  let pinned;
  if (checkGit) {
    const actual = gitSha(sourceRoot);
    assert(actual === manifest.labSourceSha, `Lab source HEAD mismatch: expected ${manifest.labSourceSha}, got ${actual}`);
    verifySiteBaseline(destRoot, manifest.websiteBaseSha);
    pinned = sourceBlobs(sourceRoot, actual);
  }
  const differences = [], plan = [];
  for (const item of manifest.files) {
    const blob = pinned?.get(item.source);
    assert(!pinned || blob, `Source is not a regular file in the pinned Lab commit: ${item.source}`);
    const original = digestFile(sourceRoot, item.source, blob);
    assert(original.bytes === item.bytes && original.sha256 === item.sha256, `Source hash mismatch: ${item.source}`);
    plan.push({source: item.source, target: item.target, bytes: item.bytes, sha256: item.sha256});
    if (!sourceOnly) {
      try {
        const mirrored = digestFile(destRoot, item.target);
        if (mirrored.bytes !== item.bytes || mirrored.sha256 !== item.sha256) differences.push({target: item.target, reason: 'content differs'});
      } catch (error) {
        differences.push({target: item.target, reason: error.message});
      }
    }
  }
  return {ok: differences.length === 0, differences, plan, checked: plan.length, mode: sourceOnly ? 'source-inventory-only' : 'source-and-site-parity',
    note: 'Offline byte parity only. Evidence URLs, rights, approval, browser behavior, score integrity and scanner closure require independent review.'};
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--gate' || arg === '--source-only') {assert(!result[arg], `Repeated ${arg}`); result[arg] = true; continue;}
    assert(['--manifest', '--lab', '--site'].includes(arg), `Unknown argument ${arg}`);
    assert(argv[i + 1] && !argv[i + 1].startsWith('--') && !result[arg], `Missing/repeated ${arg}`);
    result[arg] = argv[++i];
  }
  assert(result['--manifest'] && result['--lab'] && result['--site'], 'Usage: --manifest <json> --lab <repo> --site <repo> [--source-only] [--gate]');
  return result;
}
const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const manifest = JSON.parse(readFileSync(args['--manifest'], 'utf8'));
    const report = auditPromotion(manifest, {labRoot: args['--lab'], siteRoot: args['--site'], gate: args['--gate'], sourceOnly: args['--source-only']});
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.ok) process.exitCode = 1;
  } catch (error) { console.error(`Promotion preflight blocked: ${error.message}`); process.exitCode = 1; }
}
