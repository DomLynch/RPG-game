// The gear sheet's app nav (Fitting rail, Strategy 2026-10-01): Gear & pack | Arena as a tab bar under the header (Dom via Strategy 2026-10-01: top, not
// the foot) at 375x812 touch. The Pit tab went with the Pit room (2026-10-08). Stats is a header link and Gear & pack returns; Arena closes the sheet.
// Stills: artifacts/gear-sheet/nav-*.png. Guest only; serves this tree's build (run `npm run build` first).
import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const dir = process.env.GEAR_RECEIPT_DIR || 'artifacts/gear-sheet'; await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const KIT = { head: 'shieldmaiden.Helmet', chest: 'shieldmaiden.Body' };
const profile = { version: 1, id: 'gear-nav-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: [...Object.values(KIT), 'veteran.Body'], equipped: KIT, pack: ['veteran.Body'] } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const receipt = { origin, errors: [], nav: {}, passed: false };
const fresh = async (opponent) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((p) => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
  const page = await context.newPage(); page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.goto(`${origin}/?opponent=${opponent}&debug=1`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
  if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
  await page.waitForFunction(() => document.querySelector('#welcome').hidden);
  return page;
};
const navState = (page) => page.evaluate(() => { const b = (id) => document.getElementById(id), r = b('app-nav').getBoundingClientRect(); return { gearCurrent: b('nav-gear').getAttribute('aria-current'), bar: [r.x, r.y, r.width, r.height].map(Math.round), buttons: ['nav-gear', 'nav-arena'].map((id) => Math.round(b(id).getBoundingClientRect().height)) }; });
try {
  const page = await fresh('goblin');
  await page.locator('#journal-button').tap(); await page.waitForSelector('#journal[open][data-gear="live"]'); await page.waitForTimeout(2500);
  receipt.nav.bar = await navState(page);
  assert.ok(receipt.nav.bar.buttons.every((h) => h >= 44), 'nav buttons >= 44');
  assert.ok(receipt.nav.bar.bar[1] < 260 && receipt.nav.bar.bar[1] > 100, 'the bar sits under the header, at the top');
  assert.equal(await page.locator('#nav-pit').count(), 0, 'The Pit tab is gone');
  await page.screenshot({ path: `${dir}/nav-1-bar.png` });
  // Stats is a header link; Gear & pack returns
  await page.locator('label[for=journal-tab-fighter]').tap(); await page.waitForTimeout(300);
  assert.equal(await page.locator('#journal .pane-fighter').isVisible(), true, 'Stats header link opens Stats');
  await page.locator('#nav-gear').tap(); await page.waitForTimeout(300);
  assert.equal(await page.locator('#fitting-wear').count() >= 0 && await page.locator('#journal .pane-profile').isVisible(), true, 'Gear & pack returns to the sheet');
  await page.locator('#nav-arena').tap(); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelector('#journal').open), false, 'Arena closes the sheet');
  await page.context().close();
  receipt.passed = true;
} catch (error) { receipt.errors.push(String(error)); process.exitCode = 1; }
finally { await fs.writeFile(`${dir}/nav-receipt.json`, JSON.stringify(receipt, null, 1)); console.log(JSON.stringify({ passed: receipt.passed, errors: receipt.errors })); await browser.close(); server.httpServer.close(); }
