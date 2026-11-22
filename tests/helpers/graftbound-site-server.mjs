// Test-only local server for the GRAFTBOUND site page: serves repository files and routes /api/graftbound to the
// real Pages Function with an in-memory D1. `authorization` is injected into API requests to stand in for a signed-in
// Community session (the API's own auth tests live in tests/graftbound-api.test.mjs).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as API from '../../functions/api/graftbound.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };

export function serve({ db, authorization }) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://' + req.headers.host);
      if (url.pathname === '/api/graftbound') {
        const chunks = []; for await (const c of req) chunks.push(c);
        const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        if (authorization) headers.set('Authorization', authorization);
        headers.set('CF-Connecting-IP', '203.0.113.7');
        const request = new Request(url, { method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
        const env = { DB: db, TURNSTILE_SECRET: 'test-secret' };
        const out = req.method === 'POST' ? await API.onRequestPost({ request, env }) : await API.onRequestGet({ request, env });
        res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); return;
      }
      if (url.pathname.startsWith('/__test/')) {   // the Game Lab bot, re-pointed at the on-site game's own modules
        const name = { '/__test/ranked-bot.mjs': 'graftbound-ranked-bot.mjs', '/__test/graftbound-legal.mjs': 'graftbound-legal.mjs' }[url.pathname];
        if (!name) { res.writeHead(404); res.end(); return; }
        const code = (await readFile(join(root, 'tests/helpers', name), 'utf8')).replaceAll('../../src/graftbound-verify/', '/games/graftbound-play/src/').replace("'./graftbound-legal.mjs'", "'/__test/graftbound-legal.mjs'");
        res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(code); return;
      }
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (path.includes('..')) { res.writeHead(400); res.end(); return; }
      let file = join(root, path);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { if (!extname(file)) file += '.html'; }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, origin: 'http://127.0.0.1:' + server.address().port })));
}
