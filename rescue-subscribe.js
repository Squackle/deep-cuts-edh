/* Deep Cuts EDH — lightweight, consent-based follow.it signup on the homepage.
   This is a public publisher-provided form endpoint, not a site secret. */
(() => {
  'use strict';
  const reports = document.querySelector('.hub-reports');
  if (!reports || document.querySelector('.dc-subscribe')) return;
  const section = document.createElement('section');
  section.className = 'dc-subscribe';
  section.setAttribute('aria-labelledby', 'dcSubscribeHeading');
  section.innerHTML = `<div class="wrap dc-subscribe-grid">
    <div class="dc-subscribe-copy">
      <span class="dc-subscribe-kicker">DISPATCHES FROM THE ARCHIVE / STAY IN THE LOOP</span>
      <h2 class="dc-subscribe-heading" id="dcSubscribeHeading">The next rescue.<br><em>Delivered to you.</em></h2>
      <p>Be the first to see new Commander Rescue Reports. Subscribe for free; no Deep Cuts account required.</p>
    </div>
    <div class="dc-follow-box">
      <form class="dc-follow-form" method="post" action="https://api.follow.it/subscription-form/ZGY5eUdvK3BUVXRMdWdaMys5NVRWcUg4L3QrQkZTcUY3RlBDVWQ3SkJ4cmNVblgzMUVUNWVIaHZlUkRsaUdCUGlsWkcxQTlPMCtzUVVubTZTRkE3M2loNk9JRTRTM254MWtEaWRvVEEyUU9jd2JtQndTbEhybGQ3eFdDbzk1YkZ8K0hwc1F1K1AveXlvNGlhbzl0OVB1VHA0dk5UQ1A5YlFtT1pHSUdOY2t2az0=/8">
        <label for="dcFollowEmail">Get new Rescue Reports by email</label>
        <div class="dc-follow-fields">
          <input id="dcFollowEmail" type="email" name="email" autocomplete="email" placeholder="Your email address" required>
          <button type="submit">SUBSCRIBE ↗</button>
        </div>
      </form>
      <p class="dc-follow-fine">Email delivery is provided by follow.it. Deep Cuts EDH may see the email you submit. Unsubscribe anytime. <a href="/privacy">Privacy details ↗</a></p>
      <p class="dc-follow-direct"><a href="https://follow.it/deep-cuts-edh-commander-rescue-reports?leanpub" target="_blank" rel="noopener noreferrer">Or subscribe directly on follow.it ↗</a></p>
      <a class="dc-follow-powered" href="https://follow.it/" target="_blank" rel="noopener noreferrer">Powered by <img src="https://follow.it/images/colored-logo.svg" alt="follow.it" width="67" height="16" loading="lazy"></a>
    </div>
  </div>`;
  reports.insertAdjacentElement('afterend', section);
})();
