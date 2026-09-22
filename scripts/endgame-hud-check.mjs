// Release check: no end-of-fight HUD element covers the fallen body (owner brief, 2026-09-22: the drop line, the autopsy and the
// Wear/Store buttons used to float centred over the arena and hide the gore and the finisher). A real browser, the gate's own
// clock (scripts/lib/harness-clock.mjs): boot against the Veteran, draw the sword, stand still — the idle fighter dies — then,
// once view.finishPhase().settled is true AND the 250 ms HUD fade has finished, assert (1) no top-band text intersects
// view.fallenRect() and (2) the cluster's buttons sit inside the #actions box (both read from the #debug dataset, debug=1's
// existing frame probe — src/main.ts; the fade wait makes the sample deterministic under load, see below). The autopsy's
// own content is scripts/autopsy-browser-check.mjs's job; this check is purely about geometry, and it is the same DOM/CSS for a
// win (drop + Wear/Store) as for a death (autopsy), so one path — the reliable, deterministic one — proves both.
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`);
url.searchParams.set('debug', '1'); url.searchParams.set('opponent', 'veteran');
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: url.href, errors: [] };
const out = 'artifacts/presentation/endgame-hud'; await fs.mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  page.setDefaultTimeout(15000);
  await page.route('**/*sentry.io/**', r => r.abort());
  page.on('pageerror', e => receipt.errors.push(String(e)));
  await page.goto(url.href);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  const { run, until } = await harnessClock(page);
  await run(200);
  await page.evaluate(() => { window.__finish = null; window.addEventListener('frankendom:combat', e => { const k = e.detail.events.find(x => x.type === 'Killed'); if (k) window.__finish = k; }); });
  await page.getByRole('button', { name: 'Draw sword', exact: true }).tap();
  await until(() => document.querySelector('#guard-button').getAttribute('aria-disabled') === 'false', 5000);
  const died = await until(() => window.__finish !== null, 6000 * 16.7);
  assert.ok(died, 'the fight ends within budget');
  receipt.killed = await page.evaluate(() => window.__finish);
  // Middle-of-screen check (brief 3): before the camera settles, nothing new shows — the elements this check gates were hidden or
  // faded a moment ago, so this also proves the fade actually started (endgame-fade set) rather than everything showing at once.
  await until(() => document.documentElement.classList.contains('endgame-fade'), 2000);
  receipt.fadedBeforeSettle = true;
  // Settle: poll the same clock the HUD polls (view.finishPhase(), via #debug's frame probe) until it reports settled.
  await until(() => { const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null'); return !!p?.settled; }, 8000);
  const phase = await page.evaluate(() => JSON.parse(document.querySelector('#debug').dataset.finishPhase));
  receipt.settledAge = phase.age;
  assert.ok(!phase.touring, 'settle happens well before the 5 s tour starts');
  // Deterministic sample (lead, deploy #94 flake): the old sample ran at the settle frame and skipped any element whose computed
  // opacity was still '0' — i.e. it raced the 250 ms endgame-fade transition, which runs on the browser's real clock, not the
  // harness clock. Idle: Rematch still at 0, skipped, "pass". Loaded: opacity already rising, counted, "fail" — with the SAME
  // fallenRect both times. The corpse always reaches the bottom of a phone screen (feet at y ≈ 865 on 844), so the thumb cluster
  // necessarily overlaps its shins; that is the layout the owner approved on his phone. So: wait for the fade to finish (real
  // time), then assert what the brief actually says — (1) the TOP-BAND text never intersects the body ("the text blocks the gore
  // and the finisher"), and (2) the cluster's buttons stay entirely inside the #actions box, never floating over the arena.
  await page.waitForFunction(() => getComputedStyle(document.getElementById('reset-button')).opacity === '1', null, { timeout: 3000 });
  const sample = await page.evaluate(() => {
    const fallen = JSON.parse(document.querySelector('#debug').dataset.fallenRect || 'null');
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const visible = (el) => el && !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).opacity !== '0' && el.getBoundingClientRect().width > 0;
    const pick = (ids) => Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]).filter(([, el]) => visible(el)).map(([id, el]) => [id, box(el)]));
    return { fallen, topBand: pick(['combat-status', 'autopsy', 'loot-panel']), cluster: pick(['reset-button', 'share-button']), actions: box(document.getElementById('actions')), resetOpacity: getComputedStyle(document.getElementById('reset-button')).opacity };
  });
  receipt.fallenRect = sample.fallen; receipt.topBand = sample.topBand; receipt.cluster = sample.cluster; receipt.actionsBox = sample.actions;
  assert.ok(receipt.fallenRect, 'the fallen body has a screen rect after settle');
  assert.equal(sample.resetOpacity, '1', 'sampled after the fade, so every shown element is counted');
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
  const overlaps = Object.entries(sample.topBand).filter(([, r]) => intersects(r, sample.fallen)).map(([id]) => id);
  const floating = Object.entries(sample.cluster).filter(([, r]) => !inside(r, sample.actions)).map(([id]) => id);
  receipt.overlaps = overlaps; receipt.floating = floating;
  assert.ok(Object.keys(sample.topBand).length > 0, 'the top band shows at least the status line');
  assert.ok(Object.keys(sample.cluster).includes('reset-button'), 'Rematch/Next is shown after the fade');
  assert.equal(overlaps.length, 0, `no top-band text intersects the fallen body; overlapping: ${overlaps.join(', ')}`);
  assert.equal(floating.length, 0, `cluster buttons stay inside the #actions box; floating: ${floating.join(', ')}`);
  await page.screenshot({ path: `${out}/gate-settle.png` });
  // Lead review, 2026-09-22: an invisible Rematch under the tour must not fire. Fake the fade class (this check doesn't wait
  // for the real 5 s tour) and confirm the three buttons actually go inert, then confirm they wake again when it lifts.
  const pointerEvents = await page.evaluate(() => {
    document.documentElement.classList.add('endgame-fade');
    const faded = ['reset-button', 'share-button'].map((id) => getComputedStyle(document.getElementById(id)).pointerEvents);
    document.documentElement.classList.remove('endgame-fade');
    const restored = ['reset-button', 'share-button'].map((id) => getComputedStyle(document.getElementById(id)).pointerEvents);
    return { faded, restored };
  });
  receipt.pointerEvents = pointerEvents;
  assert.ok(pointerEvents.faded.every((v) => v === 'none'), `faded buttons must be inert: ${pointerEvents.faded}`);
  assert.ok(pointerEvents.restored.every((v) => v !== 'none'), `buttons must wake once the fade lifts: ${pointerEvents.restored}`);
  // (1) Evidence (Auditer's ask, 2026-09-22): with NO touch at all, Rematch/Next is live in the window between settle and the
  // tour's start — settle + ~0.6 s, still attached. finishAge advances per rendered frame on the page clock, which the harness
  // owns (scripts/lib/harness-clock.mjs: `until` budgets are page time, stepped 16 ms at a time), so the wait is deterministic —
  // settle lands near 1.9 s, the tour starts at 5 s, and a 4 s budget cannot be starved by a loaded runner. `!!p &&` covers the
  // frames before #debug carries a phase.
  await until(() => { const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null'); return !!p && p.age >= 2.5; }, 4000);
  const window1 = await page.evaluate(() => {
    const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase);
    const rb = document.getElementById('reset-button');
    const r = rb.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);   // what a tap at Rematch's centre would actually land on
    return { age: p.age, settled: p.settled, touring: p.touring, faded: document.documentElement.classList.contains('endgame-fade'), pointerEvents: getComputedStyle(rb).pointerEvents, opacity: getComputedStyle(rb).opacity, text: rb.textContent, hitIsRematch: hit === rb || rb.contains(hit), hit: hit ? `${hit.tagName}#${hit.id}` : null };
  });
  receipt.windowBeforeTour = window1;
  assert.ok(window1.settled && !window1.touring && !window1.faded, `between settle and tour, no touch: HUD visible (${JSON.stringify(window1)})`);
  assert.equal(window1.pointerEvents, 'auto', 'Rematch/Next is tappable before the tour without any touch');
  assert.equal(window1.opacity, '1', `Rematch/Next is fully visible before the tour (opacity ${window1.opacity})`);
  assert.ok(window1.hitIsRematch, `a tap at Rematch's centre lands on Rematch, not on ${window1.hit}`);
  await page.screenshot({ path: `${out}/rematch-live-before-tour.png` });
  // (2) Product: the tour hands the camera back on a touch ANYWHERE, not only on the canvas — a thumb landing where Rematch was
  // hits the inert #actions box during the tour. Wait for the tour, tap that box, and the HUD must be back within its 250 ms fade.
  await until(() => { const p = JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null'); return !!p?.touring; }, 9000);
  const touring = await page.evaluate(() => ({ faded: document.documentElement.classList.contains('endgame-fade'), pointerEvents: getComputedStyle(document.getElementById('reset-button')).pointerEvents }));
  assert.ok(touring.faded && touring.pointerEvents === 'none', `during the tour the HUD is faded and inert: ${JSON.stringify(touring)}`);
  const box = await page.locator('#reset-button').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);   // where Rematch was: lands on #actions, not the canvas
  await until(() => !document.documentElement.classList.contains('endgame-fade'), 1500);
  const handedBack = await page.evaluate(() => ({ touring: JSON.parse(document.querySelector('#debug').dataset.finishPhase).touring, pointerEvents: getComputedStyle(document.getElementById('reset-button')).pointerEvents }));
  receipt.handedBack = handedBack;
  assert.ok(!handedBack.touring && handedBack.pointerEvents === 'auto', `a touch off the canvas stops the tour and wakes the HUD: ${JSON.stringify(handedBack)}`);
  await page.screenshot({ path: `${out}/hud-back-after-tour-touch.png` });
  await page.locator('#reset-button').tap();   // and now the real tap goes through (Playwright would throw if anything intercepted it)
  receipt.passed = true;
} catch (error) {
  receipt.passed = false; receipt.error = String(error);
  throw error;
} finally {
  await browser.close(); if (server) await server.httpServer.close();
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 1));
  console.log(JSON.stringify({ passed: receipt.passed, settledAge: receipt.settledAge, fallenRect: receipt.fallenRect, overlaps: receipt.overlaps, floating: receipt.floating, errors: receipt.errors }));
}
