// GRAFTBOUND Ranked Expedition front end. The on-site game (same-origin iframe) plays with the pinned rules and
// reports each accepted decision. This page batches decisions into segments for /api/graftbound, which replays
// them on the server and alone decides the score. Nothing the game reports counts as proof of a result.
const frame = document.getElementById('graftboundGame');
const loaded = document.getElementById('frameStatus');
const runButton = document.getElementById('rankedRun');
const restartButton = document.getElementById('restartRun');
const runState = document.getElementById('rankedRunState');
const boardStatus = document.getElementById('rankedStatus');
const list = document.getElementById('rankings');
const verified = document.getElementById('verifiedResult');
const gameOrigin = new URL(frame.src, location.href).origin;
if (gameOrigin !== location.origin) throw Error('GRAFTBOUND must be served from this site');

const FLUSH_DELAY = 700, MAX_BATCH = 40;
let pin = null, enabled = false, frameReady = false, attempt = null, checkpoint = null, decisions = [];
let accepted = 0, queue = [], flushTimer = 0, flushingAttempt = null, resyncing = false, restartArmed = false;
const say = text => { runState.textContent = text; };
const fmt = n => Number(n || 0).toLocaleString();

async function api(payload, query = '') {
  const init = { cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (payload) Object.assign(init, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ rulesVersion: pin?.rulesVersion, buildId: pin?.buildId, ...payload }), keepalive: payload.action === 'segment' });
  const response = await fetch('/api/graftbound' + query, init);
  const data = await response.json().catch(() => ({ error: 'Invalid server response' }));
  if (!response.ok && !(response.status === 503 && data.enabled === false)) {
    const err = Error(data.error || 'Server unavailable'); err.status = response.status; throw err;
  }
  return data;
}
function post(message) { if (frameReady) frame.contentWindow.postMessage(message, gameOrigin); }
function sendState() {
  if (!attempt || !checkpoint) return;
  post({ type: 'dc-gb-state', attemptId: attempt.attemptId, checkpoint, decisions });
}
function showAttempt() {
  if (!attempt) return;
  const open = attempt.status === 'started';
  runButton.textContent = open ? 'PLAYING VERIFIED RUN' : 'START VERIFIED RUN';
  runButton.disabled = open;
  restartButton.hidden = !open;
  say(open ? `Verified run in progress · ${fmt(accepted)} moves accepted by the server.` : `Run ${attempt.status}.`);
}
function adopt(data) {
  attempt = data.attempt; checkpoint = data.checkpoint; decisions = data.decisions || [];
  accepted = attempt.acceptedDecisions || 0; queue = [];
  showAttempt(); sendState();
}

async function checkRanked() {
  try {
    const data = await api();
    pin = data.challenge || pin; enabled = data.enabled === true;
    if (!enabled) {
      runButton.disabled = true; runButton.textContent = 'RANKED NOT OPEN YET'; restartButton.hidden = true;
      say('Ranked Expedition scoring is not switched on yet. Adventure mode in the game window is free practice.');
      return;
    }
    if (data.openAttempt) {
      runButton.disabled = false; runButton.textContent = 'RESUME VERIFIED RUN'; restartButton.hidden = false;
      say(`You have a verified run in progress · ${fmt(data.openAttempt.acceptedDecisions)} moves accepted.`);
    } else {
      runButton.disabled = false; runButton.textContent = 'START VERIFIED RUN'; restartButton.hidden = true;
      say(data.best ? `Your verified best: ${fmt(data.best.score)} points.` : 'Every move is replayed by the server. Practice first if you like.');
    }
  } catch (e) {
    runButton.disabled = true; restartButton.hidden = true;
    if (e.status === 401) { runButton.textContent = 'SIGN IN TO RANK'; say('Sign in to your Community profile to play a verified run. Adventure mode works without an account.'); }
    else { runButton.textContent = 'RANKED UNAVAILABLE'; say('Ranked Expedition is unavailable right now. Adventure mode still works.'); }
  }
}
async function start(restart = false) {
  if (!enabled || !pin) return;
  runButton.disabled = true; restartButton.disabled = true;
  try {
    const data = await api({ action: 'start', ...(restart ? { restart: true } : {}) });
    verified.hidden = true;
    adopt(data);
    if (!frameReady) say('Waiting for the game to load…');
  } catch (e) {
    say('Could not start the verified run: ' + e.message);
    await checkRanked();
  } finally { restartButton.disabled = false; restartArmed = false; restartButton.textContent = 'START OVER'; }
}
runButton.addEventListener('click', () => start(false));
restartButton.addEventListener('click', () => {
  if (!restartArmed) { restartArmed = true; restartButton.textContent = 'CONFIRM: ABANDON AND RESTART'; return; }
  start(true);
});

function schedule() {
  clearTimeout(flushTimer);
  if (queue.length >= MAX_BATCH) flush(); else flushTimer = setTimeout(flush, FLUSH_DELAY);
}
async function flush() {
  if (!attempt || flushingAttempt === attempt || resyncing || !queue.length) return;
  const currentAttempt = attempt;
  flushingAttempt = currentAttempt;
  const batch = queue.slice(0, MAX_BATCH);
  try {
    const res = await api({ action: 'segment', attemptId: currentAttempt.attemptId, fromSeq: accepted, decisions: batch });
    if (attempt !== currentAttempt) return;
    queue = queue.slice(batch.length); accepted = res.acceptedDecisions; decisions = decisions.concat(batch);
    attempt.status = res.status; attempt.acceptedDecisions = accepted;
    if (res.status === 'won' || res.status === 'lost') finished(res);
    else say(`Verified run in progress · ${fmt(accepted)} moves accepted · ${fmt(res.totals?.total)} points so far.`);
  } catch (e) {
    if (attempt === currentAttempt) {
      await resync(e.status === 422 ? 'The server could not verify a move' : 'The connection was interrupted');
    }
  } finally {
    if (flushingAttempt === currentAttempt) flushingAttempt = null;
    if (attempt === currentAttempt && queue.length) schedule();
  }
}
async function resync(reason) {
  if (resyncing) return;
  const currentAttempt = attempt;
  resyncing = true; queue = []; clearTimeout(flushTimer);
  say(reason + '. Returning to the last move the server accepted…');
  try {
    const data = await api({ action: 'start' });
    if (attempt === currentAttempt) adopt(data);
  } catch {
    if (attempt === currentAttempt) say('Could not reach the server. Reload the page to resume your verified run.');
  }
  finally {
    resyncing = false;
    if (queue.length) schedule();
  }
}
function finished(res) {
  const t = res.totals || {};
  attempt.status = res.status;
  runButton.disabled = false; runButton.textContent = 'START VERIFIED RUN'; restartButton.hidden = true;
  say(res.status === 'won' ? 'Expedition complete and verified.' : 'Expedition over. Your result is verified.');
  const ach = (res.achievements || []).map(a => a.title).join(', ');
  verified.textContent = `Server-verified result: ${fmt(t.total)} points · ${fmt(t.actions)} actions · ${fmt(t.damage)} damage taken · ${fmt(t.turns)} turns · ${t.actsCompleted || 0} acts cleared.` + (ach ? ` Achievements: ${ach}.` : '');
  verified.hidden = false;
  attempt = null; checkpoint = null;
  board();
}

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== gameOrigin) return;
  const data = event.data; if (!data || typeof data !== 'object') return;
  if (data.type === 'dc-gb-ready') {
    frameReady = true; loaded.hidden = true;
    if (attempt && attempt.status === 'started') sendState();
    return;
  }
  if (data.type !== 'dc-gb-decision' || !attempt || attempt.status !== 'started' || data.attemptId !== attempt.attemptId) return;
  const d = data.decision;
  if (!d || typeof d !== 'object' || d.seq !== accepted + queue.length) { resync('The game and server fell out of step'); return; }
  queue.push(d); schedule();
});
frame.addEventListener('load', () => { if (!frameReady) { loaded.hidden = false; loaded.textContent = 'Loading GRAFTBOUND…'; } });
addEventListener('pagehide', flush);

async function board() {
  boardStatus.textContent = 'Checking verified rankings…';
  list.replaceChildren();
  try {
    const payload = await api(null, '?view=leaderboard');
    if (!payload.ok || payload.method !== 'SERVER_REPLAY_ONLY') throw Error('Invalid ranking response');
    if (!payload.enabled) {
      boardStatus.textContent = 'Ranked scoring is not switched on yet.';
      const li = document.createElement('li'); li.textContent = 'No verified runs are being accepted yet.'; list.append(li);
      return;
    }
    const c = payload.challenge || {}; pin = pin || c;
    boardStatus.textContent = `Verified rankings · ${c.challengeId || 'expedition'} revision ${c.revision ?? '?'}` + (payload.me ? ` · you are #${payload.me.position}` : '');
    for (const row of payload.entries || []) {
      if (!Number.isInteger(row.rank)) continue;
      const li = document.createElement('li'), name = document.createElement('a'), score = document.createElement('strong');
      name.textContent = `#${row.rank}  ${String(row.handle || '').slice(0, 24)}`;
      name.href = '/community?profile=' + encodeURIComponent(row.handle || '');
      score.textContent = fmt(row.score) + ' pts';
      li.append(name, score); list.append(li);
    }
    if (!(payload.entries || []).length) { const li = document.createElement('li'); li.textContent = 'No verified runs yet. Be the first.'; list.append(li); }
  } catch { boardStatus.textContent = 'Verified rankings are temporarily unavailable.'; }
}
document.getElementById('refreshLeaderboard').addEventListener('click', board);
board(); checkRanked();
