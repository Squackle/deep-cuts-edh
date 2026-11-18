// Computes the SHA-256 digest of the pinned GRAFTBOUND rules files. Usage: node scripts/graftbound-pin.mjs [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RULES_FILES } from '../src/graftbound-verify/rules-files.mjs';
const root = new URL('../src/graftbound-verify/', import.meta.url);
export function rulesDigest(base = root) {
  const h = createHash('sha256');
  for (const f of RULES_FILES) { h.update(f + '\n'); h.update(readFileSync(new URL(f, base))); h.update('\n'); }
  return h.digest('hex');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const d = rulesDigest(); console.log(d);
  if (process.argv.includes('--write')) { const p = new URL('pinned.js', root); writeFileSync(p, readFileSync(p, 'utf8').replace(/RULES_DIGEST = '[0-9a-f]*'/, `RULES_DIGEST = '${d}'`)); }
}
