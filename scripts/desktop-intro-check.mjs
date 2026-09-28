// Release row: the first-visit intro card at desktop sizes with a mouse (Auditer's desktop rows, #853, 2026-09-26). Three faults on
// 13a90467: the card was drawn over the HUD bars, the fps readout sat inside the #actions grid, and the page-wide footer (later in the DOM)
// took the mouse off the card's lower half so "Enter the arena" never got the click. Per size: nothing but the button answers at its
// centre, the card and the visible HUD do not meet, #performance and #actions do not meet, then a real mouse click enters the arena.
// Guest only; nothing sent anywhere. QA_URL points it at a deployed site; unset, it serves this tree's build.
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
  for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
    const name = `${width}x${height}`, page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(60000); page.on('pageerror', (e) => receipt.errors.push(`${name}: ${e}`)); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(origin, { waitUntil: 'commit' }); await page.waitForSelector('#welcome:not([hidden])');   // readiness is the card's own wait: at load 44 the 13 MB page missed a 60 s 'load' (run G, 09-28), as row 47 found on 09-27
    const got = await page.evaluate(() => {
      const box = (el) => { if (!el || getComputedStyle(el).visibility === 'hidden' || el.hidden) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; };
      const button = document.querySelector('#name-form button[type="submit"]'), r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { hitIsButton: !!hit && button.contains(hit), hit: hit?.tagName ?? null, button: box(button), welcome: box(document.querySelector('#welcome')), hud: box(document.querySelector('.combat-hud')), performance: box(document.querySelector('#performance')), actions: box(document.querySelector('#actions')) };
    });
    await page.screenshot({ path: `${dir}/${name}-intro.png` });
    assert.ok(got.hitIsButton, `${name}: the mouse reaches "Enter the arena" (got ${got.hit})`);
    assert.ok(!meet(got.welcome, got.hud), `${name}: the intro card and the HUD bars do not meet`);
    assert.ok(!meet(got.performance, got.actions), `${name}: the fps readout sits outside the #actions grid`);
    await page.mouse.click(got.button.x + got.button.w / 2, got.button.y + got.button.h / 2);
    await page.waitForFunction(() => document.querySelector('#welcome').hidden, null, { timeout: 10000 });
    receipt.sizes[name] = { hit: got.hit, entered: true };
    await page.close();
  }
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(`desktop-intro-check: ${JSON.stringify(receipt.sizes)} receipts in ${dir}`);
