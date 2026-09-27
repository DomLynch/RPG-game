// A double tap must never zoom the fight (owner's iPhone, 2026-09-26 22:47 on a981f7a5: a double tap on/near an attack button zoomed the
// whole page ~2x, buttons huge, HUD off-screen). WebKit at a 375 phone: a returning fighter reaches the fight, then two quick single-finger
// taps land on an attack button, just outside it (the arena canvas) and on a HUD gap. For each pair the first touchend must go through (a
// single tap keeps working) and the second must be refused at the document (main.ts's double-tap guard); the page scale must stay 1.
// Then the journal's Sound toggle, off the fight surface: a quick double tap there must click twice.
import { chromium, webkit } from 'playwright';
import { serveDist, waitForGame, writeReceipt } from './lib/harness.mjs';
import { harnessClock } from './lib/harness-clock.mjs';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

// WebKit (Safari's engine) where it is installed (the Macs); CI installs Chromium only. The guard is plain JS, so the refusal it asserts
// is the same in both; the receipt names the engine. The page runs on the stepped clock (harness-clock.mjs) and the gaps between taps
// are clock steps (90 ms inside a pair, 600 ms between pairs): headless Chromium draws the arena in software and a real-time tap waited
// behind the frame, so its two "quick" taps landed 6.3 s apart (CI 2026-09-27, prevented [false,false]) and were never a double tap.
// Each pair's touchend timeStamp gap is recorded and asserted, so the row proves the taps it sends are the ones it claims.
const engine = existsSync(webkit.executablePath()) ? webkit : chromium;
const site = await serveDist(), browser = await engine.launch({ headless: true });
const receipt = { url: site.url, engine: engine.name(), viewport: { width: 375, height: 812 }, spots: {}, errors: [], passed: false };
try {
  const page = await browser.newPage({ viewport: receipt.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  page.setDefaultTimeout(30000); page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.addInitScript(() => {
    localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'dtap-row-0001', name: 'Wanderer' }));
    // Registered on window, so it runs after every document listener: it sees whether the page refused each touchend.
    window.__touchends = []; window.addEventListener('touchend', (e) => window.__touchends.push(e.defaultPrevented)); window.__stamps = []; window.addEventListener('touchend', (e) => window.__stamps.push(e.timeStamp));
  });
  await page.goto(site.url); await waitForGame(page, { art: true });
  const { run } = await harnessClock(page);
  const attack = await page.locator('#attack-button').boundingBox();
  const spots = {
    attackButton: { x: attack.x + attack.width / 2, y: attack.y + attack.height / 2 },
    besideButton: { x: Math.max(4, attack.x - 14), y: attack.y + attack.height / 2 },
    hudGap: { x: receipt.viewport.width / 2, y: receipt.viewport.height * 0.4 },
  };
  for (const [name, { x, y }] of Object.entries(spots)) {
    await page.evaluate(() => { window.__touchends.length = 0; window.__stamps.length = 0; });
    await page.touchscreen.tap(x, y); await run(90); await page.touchscreen.tap(x, y);
    await run(600);   // past the guard's 350 ms window, so the next pair starts fresh
    const got = await page.evaluate(() => ({ gap: Math.round(window.__stamps[1] - window.__stamps[0]), prevented: [...window.__touchends], scale: window.visualViewport?.scale ?? 1, width: document.documentElement.clientWidth }));
    receipt.spots[name] = { x: Math.round(x), y: Math.round(y), ...got };
    assert.equal(got.prevented.length, 2, `${name}: two touchends`);
    assert.ok(got.gap > 0 && got.gap < 350, `${name}: the pair is a double tap (${got.gap} ms apart)`);
    assert.equal(got.prevented[0], false, `${name}: a single tap goes through`);
    assert.equal(got.prevented[1], true, `${name}: the second quick tap is refused, so iOS cannot double-tap zoom`);
    assert.equal(got.scale, 1, `${name}: the page is not zoomed`);
  }
  // Off the fight surface every tap counts (Lead, 2026-09-26): a quick double tap on a click-driven journal control registers twice.
  await page.locator('#journal-button').tap(); await page.locator('label[for="journal-tab-settings"]').tap();
  const toggle = await page.locator('#mobile-sound').boundingBox(), before = await page.locator('#mobile-sound').getAttribute('aria-pressed');
  await page.evaluate(() => { window.__touchends.length = 0; window.__stamps.length = 0; window.__clicks = 0; document.querySelector('#mobile-sound').addEventListener('click', () => { window.__clicks++; }); });
  const tx = toggle.x + toggle.width / 2, ty = toggle.y + toggle.height / 2;
  await page.touchscreen.tap(tx, ty); await run(90); await page.touchscreen.tap(tx, ty); await run(400);
  const journal = await page.evaluate(() => ({ gap: Math.round(window.__stamps[1] - window.__stamps[0]), prevented: [...window.__touchends], clicks: window.__clicks, pressed: document.querySelector('#mobile-sound').getAttribute('aria-pressed') }));
  receipt.spots.journalToggle = { x: Math.round(tx), y: Math.round(ty), before, ...journal };
  assert.ok(journal.gap > 0 && journal.gap < 350, `journal: the pair is a double tap (${journal.gap} ms apart)`);
  assert.deepEqual(journal.prevented, [false, false], 'journal: neither tap is refused');
  assert.equal(journal.clicks, 2, 'journal: both quick taps click the Sound toggle');
  assert.equal(journal.pressed, before, 'journal: two toggles land back where they started');
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await writeReceipt('artifacts/double-tap-browser-check.json', receipt);
  console.log(JSON.stringify(receipt));
  await browser.close(); await site.close();
}
