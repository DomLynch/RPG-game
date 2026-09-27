// Release row: a made clip's SEND answers ONE tap during the arena-cam tour (Lead ruling 2026-09-27, from the live CLIP receipt on
// 474ec345: the first tap on SEND fell through to #world because the tour's :root.endgame-fade makes .clip-pick inert, so a phone
// needed two taps). A real browser on the gate's own clock (scripts/lib/harness-clock.mjs): boot against the Veteran, draw, stand
// still until he kills the idle fighter, SHARE -> CLIP, let the clip re-play and stop, wait for the tour, then (1) the page is in
// the tour fade and not the pre-settle hush, (2) Rematch is still pointer-events:none, (3) SEND is what sits under its own centre,
// and (4) one touch tap on SEND reaches the share. navigator.share is stubbed the way a phone behaves: it refuses without a fresh
// tap (NotAllowedError, which leaves SEND up) and resolves with one. Guest only; nothing sent anywhere. QA_URL points it at a
// deployed site; unset, it serves this tree's build.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { harnessClock } from './lib/harness-clock.mjs';
import { serveDist, writeReceipt } from './lib/harness.mjs';

const site = await serveDist(), url = new URL(site.url);
url.searchParams.set('debug', '1'); url.searchParams.set('opponent', 'veteran');
const out = 'artifacts/clip-send-tour'; await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const receipt = { url: url.href, errors: [], passed: false };
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.addInitScript(() => {
    window.__shares = [];
    navigator.canShare = () => true;
    navigator.share = (data) => {
      // The page clock outruns the real one, so the CLIP tap's activation can still be live when the file is ready: the row arms
      // the stub just before its SEND tap, and an unarmed call is always the refused automatic one.
      const tapped = !!window.__armed && (navigator.userActivation?.isActive ?? true);
      window.__shares.push({ tapped, type: data?.files?.[0]?.type ?? null, bytes: data?.files?.[0]?.size ?? 0 });
      return tapped ? Promise.resolve() : Promise.reject(new DOMException('needs a tap', 'NotAllowedError'));
    };
  });
  await page.goto(url.href);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  const { run, until } = await harnessClock(page);
  await run(200);
  const tap = async (id) => { const b = await page.locator(`#${id}`).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return b; };
  await page.getByRole('button', { name: 'Draw sword', exact: true }).tap();
  await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 5000);
  await until(() => !document.getElementById('share-button').hidden, 6000 * 16.7);   // the idle fighter dies; the ended fight's record shows SHARE
  await until(() => { const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null'); return !!p?.settled && !document.documentElement.classList.contains('endgame-fade'); }, 8000);
  receipt.clipSupported = await page.evaluate(() => typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype);
  assert.ok(receipt.clipSupported, 'this browser records a canvas (else SHARE is the one-tap link and there is no SEND)');
  await tap('share-button');
  await until(() => !document.getElementById('clip-button').hidden, 1000);
  await tap('clip-button');
  await until(() => document.getElementById('clip-button').dataset.state === 'recording', 1000);
  await until(() => document.getElementById('clip-button').dataset.state === 'ready', 30000);   // re-play, 3 s hold, stop, file; the automatic share is refused
  receipt.afterStop = await page.evaluate(() => ({ shares: window.__shares.slice(), label: document.getElementById('clip-label').textContent }));
  assert.equal(receipt.afterStop.label, 'SEND', 'a refused automatic share leaves SEND in the slot');
  await until(() => !!JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.touring, 12000);
  await page.waitForTimeout(400);   // the 250 ms opacity fade runs on the browser's real clock
  const box = await page.locator('#clip-button').boundingBox();
  receipt.tour = await page.evaluate(([x, y]) => {
    const root = document.documentElement.classList, send = document.getElementById('clip-button'), rematch = document.getElementById('reset-button'), hit = document.elementFromPoint(x, y);
    return { fade: root.contains('endgame-fade'), hush: root.contains('endgame-hush'), rematchPointer: getComputedStyle(rematch).pointerEvents, sendPointer: getComputedStyle(send).pointerEvents, sendOpacity: getComputedStyle(send).opacity, hit: hit ? `${hit.tagName}#${hit.id}` : null, hitIsSend: !!hit && send.contains(hit) };
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  await page.screenshot({ path: `${out}/tour-send.png` });
  assert.ok(receipt.tour.fade && !receipt.tour.hush, `the tour fade, not the pre-settle hush: ${JSON.stringify(receipt.tour)}`);
  assert.equal(receipt.tour.rematchPointer, 'none', 'Rematch stays inert under the tour');
  assert.ok(receipt.tour.hitIsSend, `SEND is under its own centre during the tour (got ${receipt.tour.hit})`);
  await page.evaluate(() => { window.__armed = true; });
  await tap('clip-button');
  await until(() => window.__shares.length >= 2, 2000);
  receipt.afterTap = await page.evaluate(() => ({ shares: window.__shares.slice(), state: document.getElementById('clip-button').dataset.state }));
  const sent = receipt.afterTap.shares.at(-1);
  assert.ok(sent.tapped && sent.bytes > 0, `one tap on SEND reaches the share with the clip: ${JSON.stringify(receipt.afterTap)}`);
  await until(() => document.getElementById('clip-button').dataset.state === 'idle' && !document.documentElement.classList.contains('clip-ready'), 1000);
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await writeReceipt(`${out}/receipt.json`, receipt);
  await browser.close(); await site.close();
}
console.log(`clip-send-tour-check: ${JSON.stringify({ tour: receipt.tour, sent: receipt.afterTap?.shares.at(-1) })}`);
