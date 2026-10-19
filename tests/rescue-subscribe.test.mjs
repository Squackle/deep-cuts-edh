import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = file => readFileSync(file,'utf8');
const homepage = read('index.html');
const script = read('rescue-subscribe.js');
const page = read('subscribe.html');
const css = read('rescue-subscribe.css');
const privacy = read('privacy.html');
const expectedAction = 'https://api.follow.it/subscription-form/ZGY5eUdvK3BUVXRMdWdaMys5NVRWcUg4L3QrQkZTcUY3RlBDVWQ3SkJ4cmNVblgzMUVUNWVIaHZlUkRsaUdCUGlsWkcxQTlPMCtzUVVubTZTRkE3M2loNk9JRTRTM254MWtEaWRvVEEyUU9jd2JtQndTbEhybGQ3eFdDbzk1YkZ8K0hwc1F1K1AveXlvNGlhbzl0OVB1VHA0dk5UQ1A5YlFtT1pHSUdOY2t2az0=/8';

test('Homepage discovers the opt-in signup unobtrusively and has a static fallback link', () => {
  assert.ok(/href="\\/rescue-subscribe\\.css"/.test(homepage) ||
    (homepage.includes('href="/home-styles.css"') &&
      read('home-styles.css').includes('/* SOURCE: rescue-subscribe.css */')),
    'Newsletter signup stylesheet must load directly or via exact homepage bundle');
  assert.match(homepage, /src="\/rescue-subscribe\.js"/);
  assert.match(homepage, /href="\/subscribe">EMAIL UPDATES/);
  assert.ok(homepage.includes('<meta name="follow.it-verification-code" content="yWX0twQw2GDWNdJWL78F"/>'));
  assert.equal((homepage.match(/follow\.it-verification-code/g)||[]).length,1);
  assert.ok(script.includes('https://follow.it/deep-cuts-edh-commander-rescue-reports?leanpub'));
  assert.ok(page.includes('https://follow.it/deep-cuts-edh-commander-rescue-reports?leanpub'));
  assert.match(script, /\.hub-reports/);
  assert.match(script, /reports\.insertAdjacentElement\('afterend', section\)/);
});

test('Both signup surfaces post only explicitly entered emails to the user-provided follow.it endpoint', () => {
  for (const [filename, source] of [['rescue-subscribe.js',script],['subscribe.html',page]]) {
    assert.ok(source.includes('action="'+expectedAction+'"'), filename+' uses the exact publisher endpoint');
    assert.match(source, /method="post"/, filename);
    assert.match(source, /type="email" name="email"/, filename);
    assert.match(source, /autocomplete="email"/, filename);
    assert.match(source, /placeholder="Your email address" required/, filename);
    assert.match(source, /type="submit"/, filename);
    assert.match(source, /provided by follow\.it/, filename);
    assert.match(source, /may see the email you submit/, filename);
    assert.match(source, /href="\/privacy"/, filename);
    assert.match(source, /href="https:\/\/follow\.it\/"/, filename);
    assert.doesNotMatch(source, /fetch\s*\(|addEventListener\s*\(\s*['"]submit|localStorage|document\.cookie/, filename+' does not intercept or prefill address submission');
  }
  assert.match(privacy, /follow\.it Privacy Policy/);
  assert.match(privacy, /We do not automatically enroll Community members/);
  assert.match(page, /<meta name="robots" content="noindex,follow">/);
  assert.match(page, /rel="canonical" href="https:\/\/deep-cuts-edh\.pages\.dev\/subscribe"/);
});

test('Subscribe form colors and responsive styles use the actual Deep Cuts EDH palette', () => {
  assert.match(css, /#172522/);
  assert.match(css, /#315348/);
  assert.match(css, /#b58c56/);
  assert.match(css, /#d9b879/);
  assert.match(css, /#f4f0e6/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /focus-visible/);
});
