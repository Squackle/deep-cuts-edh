// End-to-end: /games/graftbound page + on-site game iframe + real /api/graftbound with an in-memory D1.
// Drives a verified run through the iframe's real app.record path (the same hook the game UI calls after the engine
// accepts a decision), then checks server replay, resume, tamper resync, the verified result and the leaderboard.
import test from 'node:test'; import assert from 'node:assert/strict';
import { launchBrowser } from './helpers/browser.mjs';
import { serve } from './helpers/graftbound-site-server.mjs';
import { d1 } from './helpers/d1-sqlite.mjs';
import { hash } from '../src/community-core.js';

const SCHEMA = ['db/community.sql', 'db/community-avatar-focus.sql', 'db/community-bio-emoji.sql', 'db/portrait-and-device-sessions.sql', 'db/graftbound-ranked-v1.sql'];
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

// Runs inside the game iframe: play `count` bot decisions (or until the run ends) through app.record.
async function drive(frame, count) {
  return frame.evaluate(async count => {
    const { nextDecision } = await import('/__test/ranked-bot.mjs');
    const { applyDecision } = await import('/games/graftbound-play/src/engine/ranked.js');
    const app = window.__LC; let n = 0;
    while (n < count && app.run && !['won', 'lost'].includes(app.run.phase)) {
      const run = app.run, step = nextDecision(run);
      applyDecision(run, { seq: run.ranked.seq, ...step }); run.ranked.seq--;   // engine accepts it, then record() logs it
      app.record(step); n++;
    }
    return { n, seq: app.run?.ranked.seq, phase: app.run?.phase };
  }, count);
}
const gameFrame = page => page.frames().find(f => f.url().includes('/games/graftbound-play/'));
async function hydrated(page, seq) {
  const diag = () => page.evaluate(() => { const w = document.querySelector('iframe').contentWindow; return JSON.stringify({ state: document.getElementById('rankedRunState').textContent, mode: w.__LC?.mode, seq: w.__LC?.run?.ranked?.seq, site: w.__LC?.run?.ranked?.siteAttempt }); }).catch(e => String(e));
  await page.waitForFunction(seq => {
    const f = [...document.querySelectorAll('iframe')][0]; const app = f?.contentWindow?.__LC;
    return app?.run?.ranked?.siteAttempt && app.run.ranked.seq === seq;
  }, seq, { timeout: 90000 }).catch(async e => { throw new Error(e.message + ' ' + await diag()); });
}

test('verified GRAFTBOUND run: start, submit, resume, tamper resync, finish, leaderboard', { timeout: 240000 }, async () => {
  const db = d1(SCHEMA); db.raw.exec('UPDATE graftbound_launch_v1 SET enabled=1');
  const id = hex(16), key = `dcprofile1_${id}_${hex(32)}`;
  db.raw.prepare('INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)').run(id, 'Grafter', await hash(key));
  const { server, origin } = await serve({ db, authorization: 'Bearer ' + key });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(origin + '/games/graftbound');
    await page.waitForFunction(() => document.getElementById('rankedRun').textContent === 'START VERIFIED RUN', null, { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('frameStatus').hidden, null, { timeout: 60000 });
    await page.click('#rankedRun', { noWaitAfter: true });   // the game frame may reload itself to load the run
    await hydrated(page, 0);
    assert.equal(await gameFrame(page).evaluate(() => window.__LC.mode !== 'title'), true, 'the game left the title screen for the verified run');

    // 1. Submit 20 decisions; the server must accept all of them.
    assert.equal((await drive(gameFrame(page), 20)).n, 20);
    await page.waitForFunction(() => /20 moves accepted/.test(document.getElementById('rankedRunState').textContent), null, { timeout: 30000 });
    const row = () => db.raw.prepare('SELECT id, accepted_decisions, status FROM graftbound_attempts_v1 WHERE profile_id=? ORDER BY rowid DESC').get(id);
    assert.equal(row().accepted_decisions, 20);

    // 2. Reload the page and resume: the game rebuilds from the server checkpoint and the accepted decision log.
    await page.reload();
    await page.waitForFunction(() => document.getElementById('rankedRun').textContent === 'RESUME VERIFIED RUN', null, { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('frameStatus').hidden, null, { timeout: 60000 });
    await page.click('#rankedRun', { noWaitAfter: true });   // the game frame may reload itself to load the run
    await hydrated(page, 20);
    assert.equal(await gameFrame(page).evaluate(() => window.__LC.run.ranked.log.length), 20);

    // 3. A decision the server rejects makes the page resync to the last accepted move.
    await gameFrame(page).evaluate(() => { window.__beforeResync = true; window.__LC.record({ type: 'move', x: 999, y: 999 }); });
    await page.waitForFunction(() => { const w = document.querySelector('iframe').contentWindow; return !w.__beforeResync && w.__LC?.run?.ranked?.siteAttempt; }, null, { timeout: 60000 });
    await hydrated(page, 20);
    assert.equal(row().accepted_decisions, 20, 'the rejected decision was not stored');

    // 4. Play to the end; the page shows the server-verified result and the leaderboard lists the player.
    const end = await drive(gameFrame(page), 4000);
    assert.ok(['won', 'lost'].includes(end.phase), JSON.stringify(end));
    await page.waitForFunction(() => !document.getElementById('verifiedResult').hidden, null, { timeout: 30000 });
    const r = row(); assert.equal(r.status, end.phase); assert.equal(r.accepted_decisions, end.seq);
    const shown = await page.textContent('#verifiedResult');
    const best = db.raw.prepare('SELECT score FROM graftbound_best_v1 WHERE profile_id=?').get(id);
    assert.match(shown, new RegExp('Server-verified result: ' + best.score.toLocaleString('en-US') + ' points'));
    await page.waitForFunction(() => /Grafter/.test(document.getElementById('rankings').textContent), null, { timeout: 30000 });
  } finally { await browser.close(); server.close(); }
});

test('ranked off: the page explains it and the game is still playable as practice', { timeout: 120000 }, async () => {
  const db = d1(SCHEMA);
  const { server, origin } = await serve({ db });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(origin + '/games/graftbound');
    await page.waitForFunction(() => document.getElementById('rankedRun').textContent === 'RANKED NOT OPEN YET', null, { timeout: 60000 });
    assert.equal(await page.isVisible('#restartRun'), false);
    assert.equal(await page.isVisible('header.site-header'), true);
    await page.waitForFunction(() => document.getElementById('frameStatus').hidden, null, { timeout: 60000 });
    const f = gameFrame(page);
    assert.equal(await f.evaluate(() => window.__LC.mode), 'title');
    assert.equal(await f.evaluate(() => getComputedStyle(document.querySelector('[data-a="ranked"]')).display), 'none', 'local ranked preview is hidden on the site');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal scroll at phone width');
  } finally { await browser.close(); server.close(); }
});
