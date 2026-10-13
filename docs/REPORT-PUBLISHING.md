# Rescue Report publishing checklist — standard layout and free-play links

As of October 13, 2026, **every published or preview Commander case file must prominently display the free Moxgate browser-play CTA**. This editorial standard applies to new reports, partner Commander articles, and existing articles. It is unrelated to paid membership.

## Existing case files

- `reports/chainer-dementia-master.html` — full modern Commander Mustard template; CTA directly below the hero artwork
- `reports/alena-and-gilanra.html` — CTA directly below the partner portraits in the hero right column
- `reports/commander-mustard.html` — CTA directly below the commander art in the hero right column
- `reports/ekthi-contaminator-priest.html` — CTA below the hero artwork, with a **pre-release / Commander legality** qualification

All current articles link to `https://www.moxgate.com/` using `target="_blank" rel="noopener noreferrer"`.

## For all future standard reports

1. Copy the structural pattern used in `reports/commander-mustard.html` (or `alena-and-gilanra.html` for partners).
2. Include both `<link rel="stylesheet" href="guide.css">` and `<link rel="stylesheet" href="moxgate.css">`.
3. Include `<script defer src="guide.js"></script>` and the `#rescue-data` JSON. The shared script **automatically inserts the Moxgate CTA** in the report hero when its markup was accidentally omitted, provided the page uses `.report-hero` with `.report-hero-media`.
4. Preferred explicit markup is within the right column, immediately after card art:

```html
<div class="report-hero-right">
  <div class="report-hero-media">...commander artwork...</div>
  <div class="report-moxgate-cta">
    <a class="report-moxgate-button" href="https://www.moxgate.com/"
       target="_blank" rel="noopener noreferrer"
       aria-label="Open Moxgate for free deckbuilding and play (new tab)">
      PLAY FREE ON MOXGATE <span aria-hidden="true">↗</span>
    </a>
    <p>Build and play your own version of this Commander deck for free—solo or with friends.</p>
  </div>
</div>
```

5. For pre-release or preview commanders, **do not promise legal Commander play**. Replace the caption with "Explore free browser deckbuilding and play. Check this preview card's release and Commander legality first."
6. For every published case file, use the same modern report page structure as Mustard, including `.report-guide`, `.report-wrap`, `.report-breadcrumb`, `.report-hero`, `.report-hero-right`, `.report-facts`, `.report-main`, `.report-content`, `.report-side`, and `.report-next`. Chainer was migrated from the legacy layout on October 13, 2026. The standard `guide.js` safeguard only covers pages that include that script and use the modern hero classes.
7. Verify exactly one CTA is visible in the first hero/sidebar area, that the link opens `www.moxgate.com`, that card artwork is not obscured, and that both desktop and phone views remain readable.

## Mandatory layout parity (all published case files)

Commander Mustard (`reports/commander-mustard.html`) is the source-of-truth visual template. For future case files, copy that document, then replace its commander-specific content and JSON. Avoid reviving the original Chainer prototype layout.

Every report must have:
- The same green-and-gold split hero, full-width report title, metadata tags, right-side commander art, prominent Moxgate action and short caption
- Identically styled four-field summary strip: color identity, plan, budget, status
- Article and research-link sidebar with seven numbered sections (diagnosis, prescription, game plan, six interesting cards, rules, weaknesses, budget/starter challenge) plus editorial verdict and references
- Shared copy starter core, open-in-workshop action when the commander is released/legal, expandable card list and a case-board link
- Consistent site navigation, responsive styles and profile shortcut

Partner commanders may have two card images using `.report-hero-partners`. Pre-release articles must keep their legality warning and deliberately omit the ready-to-play Workshop action. Content varies by commander; the page structure must not.

Before shipping, compare against Mustard at desktop and narrow mobile widths and verify navigation, Moxgate, research links and every deck button.

## Scope and caveat

The CTA points to Moxgate's homepage; it does **not** auto-import or load the article's starter deck. Our Rescue Report starter cores are incomplete and not guaranteed to be legal or competitively tested. Do not claim Moxgate automatically imports a completed 100-card list unless such functionality is implemented and verified.
