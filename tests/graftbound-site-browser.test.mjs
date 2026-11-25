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
// Keep headless desktop clicks responsive with the game's supported lower-cost WebGL preset.
async function usePerformanceGraphics(page, origin) {
  const framePath = '/games/graftbound-play/?siteRanked=1';
  await page.route(origin + framePath, route => route.fulfill({
    status: 302,
    headers: { location: framePath + '&gfx=performance' },
  }));
}
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
    await usePerformanceGraphics(page, origin);
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

test('restarting a verified run ignores a delayed segment from the previous run', { timeout: 150000 }, async () => {
  const db = d1(SCHEMA); db.raw.exec('UPDATE graftbound_launch_v1 SET enabled=1');
  const id = hex(16), key = `dcprofile1_${id}_${hex(32)}`;
  db.raw.prepare('INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)').run(id, 'Grafter', await hash(key));
  const { server, origin } = await serve({ db, authorization: 'Bearer ' + key });
  const browser = await launchBrowser();
  const oldSegmentAccepted = Promise.withResolvers();
  const releaseOldResponse = Promise.withResolvers();
  try {
    const page = await browser.newPage();
    await usePerformanceGraphics(page, origin);
    await page.goto(origin + '/games/graftbound');
    await page.waitForFunction(() => document.getElementById('rankedRun').textContent === 'START VERIFIED RUN');
    await page.waitForFunction(() => document.getElementById('frameStatus').hidden);
    await page.click('#rankedRun', { noWaitAfter: true });
    await hydrated(page, 0);
    const oldAttemptId = await gameFrame(page).evaluate(() => window.__LC.run.ranked.siteAttempt);
    await page.route('**/api/graftbound', async route => {
      const request = route.request();
      const body = request.method() === 'POST' ? request.postDataJSON() : null;
      if (body?.action !== 'segment' || body.attemptId !== oldAttemptId) return route.continue();
      const response = await route.fetch();
      oldSegmentAccepted.resolve(response.ok());
      await releaseOldResponse.promise;
      await route.fulfill({ response });
    });
    assert.equal((await drive(gameFrame(page), 3)).n, 3);
    assert.equal(await oldSegmentAccepted.promise, true);

    await page.click('#restartRun');
    await page.click('#restartRun', { noWaitAfter: true });
    await page.waitForFunction(oldId => {
      const attemptId = document.querySelector('iframe').contentWindow?.__LC?.run?.ranked?.siteAttempt;
      return attemptId && attemptId !== oldId;
    }, oldAttemptId);
    await hydrated(page, 0);
    const newAttemptId = await gameFrame(page).evaluate(() => window.__LC.run.ranked.siteAttempt);

    // The new run can submit while the prior response is still held.
    assert.equal((await drive(gameFrame(page), 1)).n, 1);
    await page.waitForFunction(() => /1 moves accepted/.test(document.getElementById('rankedRunState').textContent));
    const oldResponse = page.waitForResponse(response => {
      const request = response.request();
      return request.method() === 'POST' && request.url().endsWith('/api/graftbound')
        && request.postDataJSON()?.attemptId === oldAttemptId;
    });
    releaseOldResponse.resolve();
    await oldResponse;

    assert.equal((await drive(gameFrame(page), 1)).n, 1);
    await page.waitForFunction(() => /2 moves accepted/.test(document.getElementById('rankedRunState').textContent));
    const row = db.raw.prepare('SELECT accepted_decisions, status FROM graftbound_attempts_v1 WHERE id=?').get(newAttemptId);
    assert.equal(row.accepted_decisions, 2);
    assert.equal(row.status, 'started');
  } finally {
    releaseOldResponse.resolve();
    await browser.close();
    server.close();
  }
});
