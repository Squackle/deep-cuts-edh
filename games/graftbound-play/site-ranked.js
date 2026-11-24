// Deep Cuts EDH site bridge for the on-site GRAFTBOUND copy. This file is site-only; every file under src/ is
// byte-identical to the pinned Game Lab commit (see src/graftbound-verify/pinned.js).
// When embedded by /games/graftbound with ?siteRanked=1 it:
//   - receives an authoritative server checkpoint for a verified run and continues the game from it,
//   - forwards each decision the engine accepted to the parent page, which submits it for server replay,
//   - keeps the player's practice adventure save untouched while a verified run is in play.
// It never reports scores; the server replays the decisions and computes the result itself.
import app from './src/main.js';

const embedded = new URLSearchParams(location.search).get('siteRanked') === '1' && window.parent !== window;
const origin = location.origin;
const post = msg => window.parent.postMessage(msg, origin);
const isSiteRun = run => !!(run && run.ranked && run.ranked.siteAttempt);

if (embedded) {
  document.documentElement.classList.add('gb-site-embed');
  const style = document.createElement('style');
  // Inside the site, the Game Lab link and the local "Ranked preview" are replaced by the page's verified-run controls.
  style.textContent = '.gb-site-embed .lab-home-link,.gb-site-embed [data-a="ranked"]{display:none!important}';
  document.head.append(style);
  waitForApp().then(install);
}

function waitForApp() {
  return new Promise(resolve => {
    const tick = () => (app.battle && app.store && app.mode ? resolve() : setTimeout(tick, 100));
    tick();
  });
}

function install() {
  const practiceStore = app.store;
  // Verified runs live on the server; keep them out of the practice save slot.
  const rankedStore = Object.assign({}, practiceStore, { saveRun() {}, loadRun: () => ({ run: null }) });

  const record = app.record.bind(app);
  app.record = d => {
    record(d);
    const run = app.run;
    if (!isSiteRun(run)) return;
    const entry = run.ranked.log[run.ranked.log.length - 1];
    post({ type: 'dc-gb-decision', attemptId: run.ranked.siteAttempt, decision: entry });
  };

  const endRun = app.endRun.bind(app);
  app.endRun = async won => {
    const site = isSiteRun(app.run);
    await endRun(won);
    if (site) location.reload();   // back to the practice adventure, cleanly
  };

  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== origin) return;
    const data = event.data;
    if (!data || data.type !== 'dc-gb-state' || typeof data.attemptId !== 'string' || !data.checkpoint?.ranked) return;
    if (app.mode !== 'title') { location.reload(); return; }   // the parent resends the state once we are ready again
    const run = structuredClone(data.checkpoint);
    const decisions = Array.isArray(data.decisions) ? data.decisions : [];
    run.ranked.log = decisions.length === run.ranked.seq ? decisions.map(d => ({ ...d })) : [];
    run.ranked.siteAttempt = data.attemptId;
    app.store = rankedStore;
    app.run = run; app.earnedThisRun = [];
    app.toast('<b>Verified run</b><small>Every move is checked by Deep Cuts EDH.</small>');
    app.resume();
  });

  // The Game Lab copy labels results as local and unsubmitted; on the site, a verified run's result is submitted.
  const relabel = () => {
    if (!isSiteRun(app.run)) return;
    for (const el of document.querySelectorAll('#screen .badge-local')) {
      if (!el.dataset.site) { el.dataset.site = '1'; el.textContent = 'SUBMITTED · VERIFIED BY THE SERVER, SEE RESULT ABOVE'; }
    }
  };
  new MutationObserver(relabel).observe(document.getElementById('screen'), { childList: true, subtree: true });

  post({ type: 'dc-gb-ready' });
}
