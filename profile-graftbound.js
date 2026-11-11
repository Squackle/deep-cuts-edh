// My Profile — GRAFTBOUND verified records. Reads only server-verified data for the signed-in profile
// (same-origin session cookie or the in-tab key header used by community.js). Local Game Lab saves never count.
import { state } from "./community.js";
const root = document.getElementById('graftboundVerified');
if (root) {
  const $ = s => root.querySelector(s);
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = String(text); if (cls) n.className = cls; return n; };
  const stat = (label, value) => { const b = node('div', null, 'passport-stat'); b.append(node('strong', value), node('span', label)); return b; };
  const STAGE = { blank: 'Blank', stirring: 'Stirring', awakened: 'Awakened', ascendant: 'Ascendant' };
  let seq = 0;
  async function refresh() {
    const mine = ++seq, status = $('[data-gb-status]'), stats = $('[data-gb-stats]'), awards = $('[data-gb-awards]'), board = $('[data-gb-board]');
    const headers = {}; if (state.key) headers.Authorization = 'Bearer ' + state.key;
    let r; try { r = await fetch('/api/graftbound?view=me', { credentials: 'same-origin', cache: 'no-store', headers }); } catch { status.textContent = 'GRAFTBOUND records are currently unavailable.'; return; }
    if (mine !== seq) return;
    if (r.status === 503) { status.textContent = 'Verified GRAFTBOUND records are not launched yet. The Game Lab preview is local and unranked.'; stats.replaceChildren(); awards.replaceChildren(); return; }
    if (r.status === 401) { status.textContent = 'Sign in to your Community profile to see verified GRAFTBOUND records.'; return; }
    let d; try { d = await r.json(); } catch { status.textContent = 'Invalid server response.'; return; }
    if (!d.ok) { status.textContent = d.error || 'Records unavailable.'; return; }
    status.textContent = `Verified by server replay · ${d.challenge.challengeId} rev ${d.challenge.revision}`;
    const b = d.best, s = d.stats;
    stats.replaceChildren(stat('Personal best', b ? b.score.toLocaleString() : '—'), stat('Verified expeditions', s.expeditions), stat('Completed', s.completions), stat('Best act reached', s.bestActs ? ['I', 'II', 'III'][Math.min(2, s.bestActs)] + (s.completions ? ' (finished)' : '') : '—'),
      stat('Grafts recorded', s.grafts), stat('Best evolution', STAGE[s.bestStage] || '—'), stat('Best no-damage encounter', d.bestNoDamageEncounter ? `${d.bestNoDamageEncounter.name} · ${d.bestNoDamageEncounter.score}` : '—'));
    awards.replaceChildren(); if (!d.achievements.length) awards.append(node('p', 'No verified GRAFTBOUND achievements yet.', 'cm-note'));
    for (const a of d.achievements) { const it = node('article', null, 'passport-award'); it.append(node('strong', a.title), node('span', a.detail)); awards.append(it); }
    try { const lb = await (await fetch('/api/graftbound?view=leaderboard', { credentials: 'same-origin', cache: 'no-store', headers })).json(); if (mine !== seq) return;
      board.replaceChildren(); const ol = node('ol', null, 'gb-board');
      for (const e of (lb.entries || []).slice(0, 10)) { const li = node('li'); const a = node('a', '@' + e.handle); a.href = e.profileUrl; li.append(a, node('span', ` ${e.score.toLocaleString()} · ${e.actions} actions · ${e.damage} damage`)); ol.append(li); }
      board.append(ol); if (lb.me) board.append(node('p', `Your rank: #${lb.me.position}`, 'cm-note'));
    } catch { /* leaderboard optional */ }
  }
  window.addEventListener('deepcuts:profile-change', refresh); refresh();
}
