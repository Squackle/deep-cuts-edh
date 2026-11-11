// Minimal Cloudflare D1 shim over node:sqlite for tests (prepare/bind/first/all/run/batch with transactional batch).
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function d1(files = []) {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON;');
  for (const f of files) db.exec(readFileSync(new URL('../../' + f, import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    _exec: () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  return { raw: db, prepare: sql => stmt(sql), batch: async list => { db.exec('BEGIN'); try { const out = list.map(s => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}
