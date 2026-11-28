/* Server-rendered public weekly reports. User data and report text always escaped. */
import {rescueCardModel,shareMetaTags,sharePanelHtml} from './share-card.js';
const BASE='https://deep-cuts-weekly-publisher.logan-ottfamily.workers.dev';
export const WORKER_ORIGIN=BASE;
export const escaped=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
// Only Scryfall's image CDN may supply card art. This prevents arbitrary
// external URLs or injected HTML from entering public report pages.
export const safeCardImage=url=>{
 if(typeof url!=='string')return null;
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='cards.scryfall.io'&&/^\/normal\/(?:front|back)\/[a-f0-9]\/[a-f0-9]\/[a-f0-9-]{36}\.jpg$/.test(u.pathname)?u.href:null}
 catch{return null}
};
const VHATI_IMAGE='https://cards.scryfall.io/normal/front/a/8/a8564611-b678-4336-87e0-5a00a930de48.jpg?1783938448';
export const commanderArt=item=>safeCardImage(item?.commander?.imageUrl)||
 (item?.date==='2026-10-30'&&item?.commander?.name==='Vhati il-Dal'?VHATI_IMAGE:null);
const safeLink=url=>{if(typeof url!=='string'||!/^https:\/\/scryfall\.com\//.test(url))return 'https://scryfall.com/';try{const u=new URL(url);u.searchParams.delete('utm_source');return u.href}catch{return 'https://scryfall.com/'}};
export {safeLink as scryfallLink};
export async function remoteJson(path){const r=await fetch(BASE+path,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Weekly report service unavailable ('+r.status+')');return r.json()}
const header=`<header class="site-header"><div class="wrap header-inner"><a class="wordmark" href="/" aria-label="Deep Cuts EDH home"><span class="wordmark-symbol" aria-hidden="true"><img src="/assets/deep-cuts-mark.svg" width="46" height="56" alt=""></span><span class="wordmark-copy">DEEP CUTS <em>EDH</em><small>ODD STRATEGIES. NEW PURPOSE.</small></span></a><nav class="primary-nav" aria-label="Main navigation"><a href="/#latest">RESCUE REPORT</a><a href="/#archive">COMMANDERS</a><a href="/library">CARD LIBRARY</a><a href="/deck">TOOLS &amp; RESOURCES</a><a class="daily-games-nav-link" href="/games">ARCADE</a><a href="/nominations">NOMINATIONS</a><a href="/community">COMMUNITY</a><a class="member-nav-link" href="/members">MEMBERS' LOUNGE</a></nav></div></header>`;
const footer=`<footer class="site-footer"><div class="wrap footer-content"><div><strong>DEEP CUTS <span>EDH</span></strong><p>Bad commanders. Good decks. No excuses.</p></div><div class="footer-links"><a href="/privacy">PRIVACY &amp; ADS</a><a href="/library">CARD LIBRARY ↗</a><a href="/deck">TOOLS &amp; RESOURCES ↗</a><a href="/games">ARCADE ↗</a><a href="/supporters">SUPPORT</a><a href="https://scryfall.com/" target="_blank" rel="noopener noreferrer">CARD DATA: SCRYFALL ↗</a><a href="https://company.wizards.com/en/legal/fancontentpolicy" target="_blank" rel="noopener noreferrer">FAN CONTENT POLICY ↗</a></div></div><div class="wrap fine-print">Deep Cuts EDH is unofficial Magic: The Gathering fan content permitted under the Fan Content Policy, not approved or endorsed by Wizards of the Coast. Portions of these materials are property of Wizards of the Coast LLC. Card data and images via Scryfall. We are not affiliated with Scryfall or EDHREC. Community posts and gameplay results are user-submitted; card prices, rankings and legality can change.</div></footer>`;
const page=(title,description,path,body,extraHead='')=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#172522"><title>${escaped(title)} | Deep Cuts EDH</title><meta name="description" content="${escaped(description)}">${extraHead}<link rel="canonical" href="https://deep-cuts-edh.pages.dev${path}"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/retro.css"><link rel="stylesheet" href="/theme-v2.css"><link rel="stylesheet" href="/header-profile.css"><link rel="stylesheet" href="/games.css"><link rel="stylesheet" href="/release-polish.css"><link rel="stylesheet" href="/weekly-rescues.css"><script defer src="/header-profile.js"></script><script type="module" src="/weekly-card-art.mjs"></script>${extraHead?'<link rel="stylesheet" href="/share-card.css"><script defer src="/share-card.js"></script>':''}</head><body><a href="#main" class="skip-link">Skip to report</a>${header}<main id="main" class="games-main weekly-main"><div class="games-wrap"><nav class="games-breadcrumbs" aria-label="Breadcrumbs"><a href="/">HOME</a><span>/</span><a href="/rescues">WEEKLY RESCUE REPORTS</a></nav>${body}</div></main>${footer}</body></html>`;
const row=item=>`<a class="weekly-index-card" href="/rescues/${encodeURIComponent(item.date)}"><span>CASE FILE · ${escaped(item.date)}</span><strong>${escaped(item.commander)}</strong><small>${escaped(item.theme)}</small><b>READ THE REPORT ↗</b></a>`;
export function listHtml(rows){const reports=Array.isArray(rows)?rows:[];const body=`<section class="games-masthead"><span class="games-kicker">THE FIELD JOURNAL / WEEKLY</span><h1>Find a <em>different way.</em></h1><p>A fresh Commander strategy investigation is scheduled every Friday at 10:00 AM Central. From overlooked legends to unexpected angles on familiar commanders.</p><div class="games-page-links"><a href="/#archive">← ORIGINAL RESCUE REPORTS</a><a href="/nominations">SUGGEST A COMMANDER ↗</a></div></section><section class="weekly-paper"><h2>Weekly investigations</h2><p class="weekly-note">Automated research proposes unusual builds using current Scryfall card text and legality checks. These articles are labeled AI-assisted, and originality is a hypothesis, not a verified deck-adoption statistic.</p>${reports.length?`<div class="weekly-index">${reports.map(row).join('')}</div>`:'<p class="weekly-empty">No autonomous weekly report has been released yet. The first scheduled edition is Friday, October 30, 2026 at 10:00 AM Central, subject to passing source and quality checks.</p>'}</section>`;return page('Weekly Commander Rescue Reports','An unusual Commander strategy investigation every Friday.','/rescues',body)}
const WEEKLY_PLACEHOLDER='<p>Checking the weekly archive…</p>';
// The canonical /rescues URL is served by a Pages Function. Compose its SSR
// listing into the *same* static editorial source as the fallback HTML to prevent
// Google and actual visitors from seeing two different Rescue Report pages.
export function staticArchiveHtml(html,rows,{unavailable=false}={}){
 if(typeof html!=='string'||!html.includes('id="weeklyReportList"')||!html.includes(WEEKLY_PLACEHOLDER)||!html.includes('id="budget-commander-ideas"'))
  throw Error('Canonical Rescue Report asset missing expected editorial sections');
 const reports=Array.isArray(rows)?rows.filter(x=>x&&typeof x.date==='string'&&/^20\d\d-\d\d-\d\d$/.test(x.date)): [];
 const list=unavailable
  ?(reports.length
   ?'<p class="weekly-empty">Some newer weekly reports may be missing while the archive service is unavailable.</p>'+reports.map(row).join('')
   :'<p class="weekly-empty">The weekly archive is temporarily unavailable; the original Rescue Reports and budget guide remain available.</p>')
  :reports.length
   ?reports.map(row).join('')
   :'<p class="weekly-empty">No autonomous weekly report has been released yet. The first scheduled edition is Friday, October 30, 2026 at 10:00 AM Central, subject to passing source and quality checks.</p>';
 return html.replace(WEEKLY_PLACEHOLDER,list);
}
const p=(val)=>`<p>${escaped(val)}</p>`;
// Link the first mention of each named key card to its Scryfall page. Names are
// matched on the escaped text, so no report text can inject markup.
export function linkCards(text,cards){
 let html=escaped(text);const used=new Set();
 const list=(Array.isArray(cards)?cards:[]).filter(x=>x&&typeof x.name==='string'&&x.name.length>2).sort((a,b)=>b.name.length-a.name.length);
 for(const card of list){
  const name=escaped(card.name);if(used.has(name))continue;
  const at=html.indexOf(name);if(at<0)continue;
  // Skip a match inside an existing link.
  const before=html.slice(0,at);if(before.lastIndexOf('<a ')>before.lastIndexOf('</a>'))continue;
  html=before+`<a class="weekly-card-link" href="${escaped(safeLink(card.url))}" target="_blank" rel="noopener noreferrer">${name}</a>`+html.slice(at+name.length);
  used.add(name);
 }
 return html;
}
// Generic automated headlines ("Kruphix Rescue Report") read as placeholders.
export const genericHeadline=(headline,commander)=>{
 const h=String(headline||'').trim().toLowerCase(),first=String(commander||'').split(',')[0].trim().toLowerCase();
 return !h||/rescue report$/.test(h)||h===first||h===String(commander||'').trim().toLowerCase();
};
export function reportHtml(item){if(!item||!item.commander||!item.sections||!Array.isArray(item.synergies))throw Error('Invalid published report');const c=item.commander,s=item.sections;const cardHref=safeLink(c.scryfall);const preparedAt=Date.parse(item.createdAt||'');
const rank=Number.isSafeInteger(c.edhrecCardUseRank)&&c.edhrecCardUseRank>0?c.edhrecCardUseRank:'Unavailable';
const cards=item.synergies;const lp=val=>`<p>${linkCards(val,cards)}</p>`;
const section=(i,title,content)=>`<section class="weekly-prose"><h2>${i} / ${escaped(title)}</h2>${lp(content)}</section>`;
const headline=genericHeadline(s.headline,c.name)?`${c.name}: ${item.theme}`:s.headline;
const revisedAt=Date.parse(item.revisedAt||'');
const longDate=t=>new Date(t).toLocaleDateString('en-US',{timeZone:'America/Chicago',month:'long',day:'numeric',year:'numeric'});
const revisedNote=Number.isFinite(revisedAt)?`<p class="weekly-note"><strong>EDITOR'S REVISION:</strong> Updated ${escaped(longDate(revisedAt))}. The card notes were rewritten and rechecked against Scryfall.</p>`:'';
const image=commanderArt(item);
const art=image?`<img data-weekly-card-img src="${escaped(image)}" width="220" height="307" alt="Full Magic: The Gathering Commander card: ${escaped(c.name)}" decoding="async" loading="eager">`:'';
const cardArt=`<figure class="weekly-commander-art" data-weekly-art-state="${image?'loading':'unavailable'}">${art}<span class="weekly-art-fallback">Card artwork is unavailable here. View the original card on Scryfall.</span><figcaption><a href="${escaped(cardHref)}" target="_blank" rel="noopener noreferrer">VIEW FULL CARD ON SCRYFALL ↗</a></figcaption></figure>`;
const backfillNote=/editorial backfill/i.test(String(item.status||''))?
 `<p class="weekly-note"><strong>EDITORIAL BACKFILL:</strong> Prepared ${escaped(Number.isFinite(preparedAt)?longDate(preparedAt):'after the scheduled release')} for the ${escaped(item.date)} issue. This article was not published on its original scheduled date.</p>`:'';
const body=`<section class="games-masthead weekly-report-hero"><div class="weekly-report-copy"><span class="games-kicker">WEEKLY RESCUE · ${escaped(item.date)}</span><h1>${escaped(c.name)}: <em>${escaped(item.theme)}</em></h1><p>${escaped(item.hook)}</p><div class="games-page-links"><a href="/rescues">← ALL WEEKLY RESCUES</a><a href="${escaped(cardHref)}" target="_blank" rel="noopener noreferrer">VIEW COMMANDER ORACLE ↗</a></div></div>${cardArt}</section><article class="weekly-paper"><div class="weekly-status"><span>AI-ASSISTED · SOURCE-CHECKED</span><span>${escaped(item.date)}</span></div>${backfillNote}${revisedNote}<h2 class="weekly-title">${escaped(headline)}</h2><p class="weekly-lead">${escaped(item.selectionReason)}</p><div class="weekly-facts"><div><small>COMMANDER</small><strong>${escaped(c.name)}</strong></div><div><small>PROPOSED ANGLE</small><strong>${escaped(item.theme)}</strong></div><div><small>CONVENTIONAL BUILD (APPROXIMATE)</small><strong>${escaped(item.usualBuild)}</strong></div><div><small>EDHREC CARD-USE RANK</small><strong>${rank} · NOT leader deck count</strong></div></div>${section('01','The diagnosis',s.diagnosis)}${section('02','The prescription',s.prescription)}<section class="weekly-prose"><h2>03 / Pilot the deck</h2><h3>Early game</h3>${lp(s.earlyGame)}<h3>Midgame</h3>${lp(s.midGame)}<h3>Late game</h3>${lp(s.lateGame)}</section>${section('04','What could go wrong',s.risks)}${section('05','Our provisional verdict',s.verdict)}</article><section class="weekly-paper" aria-label="Continue exploring"><h2>Continue the investigation</h2><p>Find a new angle in the <a href="/matchmaker">Commander Matchmaker</a>, research card roles in the <a href="/deep-cut-finder">Deep Cut Finder</a>, or compare <a href="/rescues#budget-commander-ideas">budget Commander starter cores</a>.</p><p>Take a break with the <a href="/games">Deep Cuts Arcade's MTG puzzles</a>.</p></section>`;const title=`${c.name} — Weekly Rescue ${item.date}`,description=`Unusual Commander strategy: ${item.theme}. AI-assisted, source-checked card research.`;
// Share card + Open Graph only for a well-formed published report date.
let share=null;try{share=rescueCardModel(item)}catch{}
return page(title,description,`/rescues/${encodeURIComponent(item.date)}`,share?body+sharePanelHtml(share):body,share?shareMetaTags(share,{title,description}):'')}
export const htmlResponse=(html,status=200)=>new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=300, s-maxage=300','X-Content-Type-Options':'nosniff'}});
