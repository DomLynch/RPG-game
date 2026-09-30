// Release row: the name card. (Auditer's desktop rows, #853, 2026-09-26; the phone half and the no-first-card ruling: Dom 2026-09-30.)
// Three faults on 13a90467: the card was drawn over the HUD bars, the fps readout sat inside the #actions grid, and the page-wide footer
// (later in the DOM) took the mouse off the card's lower half so "Enter the arena" never got the click. The phone had no rule at all, so
// the fight cluster (SKILL over the name field, FIGHT over "Enter the arena") sat on the card on Dom's phone (live c59d4a46).
// RE-PINNED, first-visit name card removed, Dom 2026-09-30: a fresh guest now loads straight into the arena as "Wanderer" with the
// normal Tap Fight cue, so the card no longer appears on a first visit. What still shows it: Rename in the Profile and the kill-link
// "THIS FIGHT HAS FADED" screen. Per size (three desktops with a mouse, and 375x812 on a phone): (1) fresh storage shows NO card and the
// fight controls are visible; (2) with the card open, no fight control is visible or hit-testable over it, nothing but the button answers
// at its centre and its lower third, the card and the HUD do not meet, #performance and #actions do not meet, then a real click/tap on
// "Enter the arena" goes in; (3) the faded kill link shows the card with the same guarantees. Guest only; nothing sent anywhere.
// QA_URL points it at a deployed site; unset, it serves this tree's build.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.DESKTOP_INTRO_RECEIPT_DIR || 'artifacts/desktop-intro'; await fs.mkdir(dir, { recursive: true });
// Full Chromium (new headless), as the sibling desktop-layout row and the account rows launch it: bare `headless: true` picks Playwright's
// chromium-headless-shell (old headless), the one row 46 build that lost two consecutive releases (runs G and H, 2026-09-28) — the game
// renders the whole arena behind the intro card on every frame (main.ts frame → view.render, no pause gate), and at desktop sizes under
// load the shell's compositor produced no frame for Page.captureScreenshot inside 60 s.
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { origin, sizes: {}, errors: [], passed: false };
const meet = (a, b) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
try {
  const SIZES = [[1024, 768, false], [1280, 800, false], [1440, 900, false], [375, 812, true]];   // [w, h, phone]
  // Everything of the fight that must not be drawn or hit-testable over the card, and what proves the card is answering.
  const probe = () => {
    const box = (el) => { if (!el || getComputedStyle(el).visibility === 'hidden' || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
    const card = document.querySelector('#welcome'), button = document.querySelector('#name-form button[type="submit"]'), r = button.getBoundingClientRect();
    const hitAt = (x, y) => { const hit = document.elementFromPoint(x, y); return { is: !!hit && button.contains(hit), tag: hit?.tagName ?? null }; };
    const controls = [...document.querySelectorAll('#actions button, #joystick, .combat-hud')].filter((el) => box(el));   // drawn = visible
    const over = controls.filter((el) => { const c = card.getBoundingClientRect(), e = el.getBoundingClientRect(); return e.x < c.x + c.width && c.x < e.x + e.width && e.y < c.y + c.height && c.y < e.y + e.height; });
    const hiddenNow = Object.fromEntries(['#joystick', '#actions', '.combat-hud'].map((sel) => [sel, getComputedStyle(document.querySelector(sel)).visibility === 'hidden']));   // nothing of the fight stays drawn or tappable under the card
    return { hiddenNow, centre: hitAt(r.x + r.width / 2, r.y + r.height / 2), lower: hitAt(r.x + r.width / 2, r.y + r.height * 0.85), button: box(button), welcome: box(card), hud: box(document.querySelector('.combat-hud')), performance: box(document.querySelector('#performance')), actions: box(document.querySelector('#actions')), fightControlsOverCard: over.map((el) => el.id || el.className || el.tagName) };
  };
  const checkCard = async (page, name) => {
    const got = await page.evaluate(probe);
    await page.screenshot({ path: `${dir}/${name}.png` });
    assert.ok(got.welcome, `${name}: the card is drawn`);
    assert.ok(got.centre.is, `${name}: the pointer reaches "Enter the arena" at its centre (got ${got.centre.tag})`);
    assert.ok(got.lower.is, `${name}: ... and at its lower third (got ${got.lower.tag})`);
    assert.deepEqual(got.hiddenNow, { '#joystick': true, '#actions': true, '.combat-hud': true }, `${name}: the stick, the cluster and the HUD are hidden (not merely elsewhere) while the card is open`);
    assert.deepEqual(got.fightControlsOverCard, [], `${name}: no fight control is drawn over the card`);
    assert.ok(!meet(got.welcome, got.hud), `${name}: the card and the HUD bars do not meet`);
    assert.ok(!meet(got.performance, got.actions), `${name}: the fps readout sits outside the #actions grid`);
    return got;
  };
  for (const [width, height, phone] of SIZES) {
    const name = `${width}x${height}`, context = await browser.newContext({ viewport: { width, height }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) }), page = await context.newPage();
    page.setDefaultTimeout(60000); page.on('pageerror', (e) => receipt.errors.push(`${name}: ${e}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
    // (1) A fresh first visit: no card, the fight controls are there, the game is not paused behind anything.
    await page.goto(origin, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.querySelector('#attack-button'), null, { timeout: 120000 });   // the page's own readiness: the button exists once main.ts has run
    await page.waitForFunction(() => document.querySelector('#welcome').hidden, null, { timeout: 60000 });
    const first = await page.evaluate(() => { const shown = (el) => { const r = el?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }; return { card: shown(document.querySelector('#welcome')), actions: shown(document.querySelector('#actions')), hud: shown(document.querySelector('.combat-hud')) }; });
    await page.screenshot({ path: `${dir}/${name}-first-visit.png` });
    assert.equal(first.card, false, `${name}: a first visit shows no name card`);
    assert.ok(first.actions && first.hud, `${name}: the fight controls and the HUD are visible on a first visit`);
    // (2) Rename opens the card: it must clear the fight at this width, and entering closes it.
    await page.evaluate(() => document.getElementById('name-button').click());
    await page.waitForSelector('#welcome:not([hidden])');
    const got = await checkCard(page, `${name}-rename`);
    if (phone) await page.touchscreen.tap(got.button.x + got.button.w / 2, got.button.y + got.button.h / 2); else await page.mouse.click(got.button.x + got.button.w / 2, got.button.y + got.button.h / 2);
    await page.waitForFunction(() => document.querySelector('#welcome').hidden, null, { timeout: 10000 });
    // (3) The faded kill link: the same card, the same guarantees. With a fight store in the build the real flow runs (the store answers "no such
    // fight"); a build without one (no VITE_SUPABASE_URL: the CI/VPS build) cannot resolve a link, so the card is put up as the faded screen shows it
    // and the receipt says so. The overlap this row guards is CSS on the card, the same either way.
    await page.route('**/rest/v1/fight_records*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${origin}/s/zzzzzz`, { waitUntil: 'commit' });
    let faded = 'real flow';
    try { await page.waitForFunction(() => document.querySelector('#welcome-eyebrow')?.textContent === 'THIS FIGHT HAS FADED' && !document.querySelector('#welcome').hidden, null, { timeout: 45000 }); }
    catch { faded = 'emulated (this build has no fight store)'; await page.waitForFunction(() => document.querySelector('#attack-button'), null, { timeout: 120000 }); await page.evaluate(() => { document.querySelector('#welcome-eyebrow').textContent = 'THIS FIGHT HAS FADED'; document.querySelector('#welcome-title').textContent = 'Sign in and your kills are kept forever.'; document.querySelector('#welcome-lead').hidden = true; document.querySelector('#welcome').hidden = false; }); }
    await checkCard(page, `${name}-faded`);
    receipt.sizes[name] = { firstVisit: first, renamed: true, faded };
    await context.close();
  }
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(`desktop-intro-check: ${JSON.stringify(receipt.sizes)} receipts in ${dir}`);
