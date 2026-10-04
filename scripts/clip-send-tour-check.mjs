// Release row: a made clip's SEND answers ONE tap during the arena-cam tour (Lead ruling 2026-09-27, from the live CLIP receipt on
// 474ec345: the first tap on SEND fell through to #world because the tour's :root.endgame-fade makes .clip-pick inert, so a phone
// needed two taps). A real browser on the gate's own clock (scripts/lib/harness-clock.mjs): boot against the Veteran, draw, stand
// still until he kills the idle fighter, SHARE -> CLIP, let the clip re-play and stop, wait for the tour, then (1) the page is in
// the tour fade and not the pre-settle hush, (2) Rematch is still pointer-events:none, (3) SEND is what sits under its own centre,
// and (4) one touch tap on SEND reaches the share. navigator.share is stubbed the way a phone behaves: it refuses without a fresh
// tap (NotAllowedError, which leaves SEND up) and resolves with one. Guest only; nothing sent anywhere. QA_URL points it at a
// deployed site; unset, it serves this tree's build.
// MediaRecorder is stubbed (deploy 09-27: the real software H.264 encode of 720x1280 over every harness frame made the row take
// 442 s at load): the stub hands SEND a real File, 12 bytes typed video/mp4. The row tests the tour fade and SEND, not the encoder;
// the encoder is covered by tests/clip.test.ts and the live WebKit receipt (docs/state/web.md 2026-09-27: mp4 9.4 MB, 13 s).
// The death is the walk-away path (main.ts visibilitychange -> owed): the page goes hidden, the clock jumps 90 s, the page comes back and
// the missed fight runs in one frame. CI run 36324999324 spent 1037 s stepping the idle death frame by frame on software GL (~0.5 s a
// frame); the row tests what happens after the kill, not the fight. receipt.pageMs holds each stepped phase's page time. From the
// death to the tour the WebGL draws are skipped (skipDraws: same sim, DOM and timers, no painting): the clip re-play alone took 708 s
// on CI (run 36333230742, ~0.9 s a frame), and the stubbed recorder never looks at the pixels. The tour still is painted.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';

const site = await serveDist(), url = new URL(site.url);
url.searchParams.set('debug', '1'); url.searchParams.set('opponent', 'veteran');
const out = 'artifacts/clip-send-tour'; await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const receipt = { url: url.href, errors: [], passed: false, phases: {}, pageMs: {} };
const t0 = Date.now(), mark = (phase) => { receipt.phases[phase] = Math.round((Date.now() - t0) / 1000); console.log(`phase ${phase} ${receipt.phases[phase]} s (page ${receipt.pageMs[phase] ?? '-'} ms)`); };   // wall seconds at the end of each phase
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.addInitScript(() => {
    // A named guest walks straight in (no first-visit card): deploy 09-27 attempt 1 timed out tapping "Enter the arena" at load 23.
    localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'clip-row-0001', name: 'Wanderer' }));
    window.__shares = [];
    // The walk-away switch: document.hidden / visibilityState read window.__away, flipped by the row with a visibilitychange of its own.
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__away });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__away ? 'hidden' : 'visible') });
    // The stub recorder: same surface clip.ts uses (isTypeSupported, start, stop, ondataavailable, onstop), no encoding. Its events
    // go through microtasks, which the harness clock does not hold.
    window.MediaRecorder = class {
      static isTypeSupported(type) { return type.startsWith('video/mp4'); }
      constructor(stream, options) { this.stream = stream; this.mimeType = options?.mimeType ?? 'video/mp4'; this.state = 'inactive'; this.ondataavailable = null; this.onstop = null; }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        const data = new Blob([new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 109, 112, 52, 50])], { type: 'video/mp4' });   // an 'ftyp mp42' box header
        queueMicrotask(() => { this.ondataavailable?.({ data }); this.onstop?.(); });
      }
    };
    navigator.canShare = () => true;
    navigator.share = (data) => {
      // The page clock outruns the real one, so the CLIP tap's activation can still be live when the file is ready: the row arms
      // the stub just before its SEND tap, and an unarmed call is always the refused automatic one.
      const tapped = !!window.__armed && (navigator.userActivation?.isActive ?? true);
      const file = data?.files?.[0];
      window.__shares.push({ tapped, isFile: file instanceof File, name: file?.name ?? null, type: file?.type ?? null, bytes: file?.size ?? 0 });
      return tapped ? Promise.resolve() : Promise.reject(new DOMException('needs a tap', 'NotAllowedError'));
    };
  });
  await page.addInitScript(() => { try { if (!sessionStorage.getItem('frankendom.dev-kit')) sessionStorage.setItem('frankendom.dev-kit', JSON.stringify({ level: 46 })); } catch {} });   // the Dev kit's level, seeded before boot: a live pick that moves the Centurion's loadout reloads the page (main.ts loadoutMoved)
  await page.goto(url.href, { waitUntil: 'commit' });   // readiness is waitForGame's: at load 65+ the 13 MB page missed a 15 s 'load' (09-27)
  await waitForGame(page, { art: true, timeout: 120000 });
  // RE-PINNED, first-visit name card removed (Dom 2026-09-30): a fresh guest is already in the arena; the click stays for a build that still shows it.
  if (await page.locator('#welcome').isVisible()) await page.locator('#name-form button[type="submit"]').evaluate((b) => b.click());
  await page.waitForFunction(() => document.querySelector('#welcome').hidden, null, { timeout: 30000 });
  mark('boot');
  // Level 46, seeded in the Dev kit above (Combat's #914 did the same for row 22): the Centurion kills an idle player in 15–33 s of
  // fight, where a fresh guest's level 1 took ~23 s here and up to 128 s on other seeds. Every waited 16 ms frame is a software-GL draw.
  assert.equal(await page.locator('#difficulty-select').inputValue(), '46', 'the fight is on level 46');
  const { run, until } = await harnessClock(page);
  await run(200);
  const tap = async (id) => { const b = await page.locator(`#${id}`).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return b; };
  await page.getByRole('button', { name: 'Fight', exact: true }).tap();
  await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 5000);
  // Walk away for 90 s of page time (level 46 kills an idle player in 15–33 s of fight; AFK_CAP is 300 s): fastForward fires each due
  // timer at most once, so the absence costs one frame, and the return owes the fight the whole 90 s.
  const away = (on) => page.evaluate((v) => { window.__away = v; document.dispatchEvent(new Event('visibilitychange')); }, on);
  await skipDraws(page, true);
  await away(true);
  await page.clock.fastForward(90_000);
  await away(false);
  receipt.pageMs.death = await until(() => !document.getElementById('clip-button').hidden, 2000);   // the missed fight runs in the next frame; the ended fight's record shows SHARE + CLIP at once
  receipt.deathRecord = await page.evaluate(() => document.querySelector('#debug').dataset.record ?? null);
  assert.match(receipt.deathRecord ?? '', /\/died\//, `the walk-away fight ended in the idle player's death: ${receipt.deathRecord}`);
  mark('death');
  receipt.pageMs.settled = await until(() => { const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null'); return !!p?.settled && !document.documentElement.classList.contains('endgame-fade'); }, 8000);
  receipt.clipSupported = await page.evaluate(() => typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype);
  assert.ok(receipt.clipSupported, 'this browser records a canvas (else SHARE shows alone and there is no CLIP or SEND)');
  mark('settled');
  await tap('clip-button');
  await until(() => document.getElementById('clip-button').dataset.state === 'recording', 1000);
  receipt.pageMs.clip = await until(() => document.getElementById('clip-button').dataset.state === 'ready', 30000);   // re-play, the finish + 1 s (cap 8 s after the kill), stop, file; the automatic share is refused
  mark('clip');
  receipt.afterStop = await page.evaluate(() => ({ shares: window.__shares.slice(), label: document.getElementById('clip-label').textContent }));
  assert.equal(receipt.afterStop.label, 'SEND', 'a refused automatic share leaves SEND in the slot');
  receipt.pageMs.tour = await until(() => !!JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.touring, 12000);
  mark('tour');
  await skipDraws(page, false); await run(48);   // the still below is a painted frame
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
  const [auto, sent] = receipt.afterTap.shares;
  assert.equal(receipt.afterTap.shares.length, 2, `the automatic share, then exactly one from the tap: ${JSON.stringify(receipt.afterTap)}`);
  assert.ok(!auto.tapped, 'the first call is the refused automatic one');
  assert.deepEqual(sent, { tapped: true, isFile: true, name: 'frankendom-veteran.mp4', type: 'video/mp4', bytes: 12 }, 'one tap on SEND shares the made clip as a File');
  await until(() => document.getElementById('clip-button').dataset.state === 'idle' && !document.documentElement.classList.contains('clip-ready'), 1000);
  assert.deepEqual(receipt.errors, []);
  mark('sent');
  receipt.passed = true;
} finally {
  await writeReceipt(`${out}/receipt.json`, receipt);
  await browser.close(); await site.close();
}
console.log(`clip-send-tour-check: ${JSON.stringify({ phases: receipt.phases, tour: receipt.tour, sent: receipt.afterTap?.shares.at(-1) })}`);
