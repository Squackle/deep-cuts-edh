# Rescue Report publishing checklist — required Moxgate play link

As of October 13, 2026, **every published or preview Commander case file must prominently display the free Moxgate browser-play CTA**. This editorial standard applies to new reports, partner Commander articles, and existing articles. It is unrelated to paid membership.

## Existing case files

- `reports/chainer-dementia-master.html` — CTA immediately below card artwork in the legacy intro sidebar
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
6. When publishing an unusual page layout, explicitly include `moxgate.css` and the same link near the top artwork (the old Chainer article is the example). The modern `guide.js` safeguard only covers reports that include that script and use the modern hero classes.
7. Verify exactly one CTA is visible in the first hero/sidebar area, that the link opens `www.moxgate.com`, that card artwork is not obscured, and that both desktop and phone views remain readable.

## Scope and caveat

The CTA points to Moxgate's homepage; it does **not** auto-import or load the article's starter deck. Our Rescue Report starter cores are incomplete and not guaranteed to be legal or competitively tested. Do not claim Moxgate automatically imports a completed 100-card list unless such functionality is implemented and verified.
