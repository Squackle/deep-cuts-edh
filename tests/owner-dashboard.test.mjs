import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('owner console loads compact dashboard assets and retains secured forms', () => {
  const html = read('member-operations.html');
  for (const id of ['opsForm','ownerConsole','complimentaryForm','ownerEvidenceForm','ownerAdFreeForm','issuedKeySection','ownerTable']) {
    assert.match(html, new RegExp('id="'+id+'"'), id);
  }
  assert.match(html, /href="owner-dashboard\.css"/);
  assert.match(html, /defer src="owner-dashboard\.js"/);
  assert.match(html, /name="operatorKey" type="password"/);
});

test('dashboard retains authorization contracts and does not persist bearer secrets', () => {
  const js = read('owner-dashboard.js');
  assert.match(js, /setAttribute\("form", "opsForm"\)/);
  assert.match(js, /ownerLock/);
  assert.match(js, /15 \* 60 \* 1000/);
  assert.match(js, /keyInput\.value = ""/);
  assert.match(js, /issuedKey.*textContent = ""/);
  assert.doesNotMatch(js, /localStorage|sessionStorage|document\.cookie/);
  assert.match(js, /ownerUnlock/);
  assert.match(js, /fetch\("\/api\/owner-ops\?view=overview"/);
  assert.match(js, /method: "GET"/);
  assert.doesNotMatch(js, /method: "(?:POST|PUT|PATCH|DELETE)"/);
  assert.match(js, /unlockGeneration/); // pending auth cannot resurrect a locked UI
  for (const panel of ['overview','members','directory','grants','evidence','adfree','tools']) {
    assert.match(js, new RegExp('"'+panel+'"'));
  }
});

test('owner route has restrictive static response headers', () => {
  const headers = read('_headers');
  const h = headers.split('/member-operations.html')[1] || '';
  assert.match(h, /Cache-Control: no-store/);
  assert.match(h, /Referrer-Policy: no-referrer/);
  assert.match(h, /X-Robots-Tag: noindex/);
});
