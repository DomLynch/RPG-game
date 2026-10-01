// The gear sheet's app nav (Fitting rail, Strategy 2026-10-01): The Pit | Gear & pack | Arena at the foot of the sheet at 375x812 touch.
// DIMMED: no kill screen, so The Pit is aria-disabled and a tap shows "Win a fight to open the gate" for 2 s. LIT: after a career kill
// screen (the idle fighter dies, endgame-hud-check's loss, which raises the same door as a win) The Pit is live and opens the gate. Arena
// closes the sheet. Stills: artifacts/gear-sheet/nav-*.png. Guest only; serves this tree's build (run `npm run build` first).
import { chromium } from 'playwright';
import { preview } from 'vite';
import { harnessClock } from './lib/harness-clock.mjs';
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
const navState = (page) => page.evaluate(() => { const b = (id) => document.getElementById(id), r = b('app-nav').getBoundingClientRect(); return { pitDisabled: b('nav-pit').getAttribute('aria-disabled'), gearCurrent: b('nav-gear').getAttribute('aria-current'), noteHidden: b('nav-note').hidden, note: b('nav-note').textContent, bar: [r.x, r.y, r.width, r.height].map(Math.round), buttons: ['nav-pit', 'nav-gear', 'nav-arena'].map((id) => Math.round(b(id).getBoundingClientRect().height)) }; });
try {
  // dimmed
  let page = await fresh('goblin');
  await page.locator('#journal-button').tap(); await page.waitForSelector('#journal[open][data-gear="live"]'); await page.waitForTimeout(2500);
  receipt.nav.dimmed = await navState(page);
  assert.equal(receipt.nav.dimmed.pitDisabled, 'true'); assert.ok(receipt.nav.dimmed.buttons.every((h) => h >= 44), 'nav buttons >= 44');
  assert.equal(receipt.nav.dimmed.bar[1] + receipt.nav.dimmed.bar[3] <= 812, true, 'the bar sits inside the viewport');
  await page.screenshot({ path: `${dir}/nav-1-pit-dimmed.png` });
  await page.locator('#nav-pit').tap({ force: true }); await page.waitForTimeout(300);   // aria-disabled: Playwright refuses it, a finger does not
  receipt.nav.dimmedTap = await navState(page);
  assert.equal(receipt.nav.dimmedTap.noteHidden, false); assert.equal(receipt.nav.dimmedTap.note, 'Win a fight to open the gate');
  await page.screenshot({ path: `${dir}/nav-2-pit-dimmed-tap.png` });
  await page.waitForTimeout(2300);
  assert.equal((await navState(page)).noteHidden, true, 'the line fades after 2 s');
  assert.equal(await page.evaluate(() => document.body.dataset.pit ?? null), null, 'a dimmed tap opens nothing');
  // Stats is a header link; Gear & pack returns
  await page.locator('label[for=journal-tab-fighter]').tap(); await page.waitForTimeout(300);
  assert.equal(await page.locator('#journal .pane-fighter').isVisible(), true, 'Stats header link opens Stats');
  await page.locator('#nav-gear').tap(); await page.waitForTimeout(300);
  assert.equal(await page.locator('#fitting-wear').count() >= 0 && await page.locator('#journal .pane-profile').isVisible(), true, 'Gear & pack returns to the sheet');
  await page.locator('#nav-arena').tap(); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelector('#journal').open), false, 'Arena closes the sheet');
  await page.context().close();
  // lit: a career kill screen (the idle fighter dies)
  page = await fresh('veteran');
  const { run, until } = await harnessClock(page);
  await page.getByRole('button', { name: 'Fight', exact: true }).tap();
  assert.ok(await until(() => +document.querySelector('#player-health').value === 0, 6000 * 16.7), 'the idle fighter dies within budget');
  await until(() => !!JSON.parse(document.querySelector('#debug').dataset.finishPhase || 'null')?.settled, 8000);
  await page.waitForFunction(() => { const d = document.getElementById('pit-button'); return !!d && !d.hidden && getComputedStyle(d).opacity === '1'; }, null, { timeout: 8000 });
  await page.locator('#journal-button').tap(); await page.waitForSelector('#journal[open][data-gear="live"]'); await run(600); await page.waitForTimeout(500);   // the harness clock only draws frames when run
  receipt.nav.lit = await navState(page);
  assert.equal(receipt.nav.lit.pitDisabled, 'false', 'The Pit is lit on a kill screen');
  await page.screenshot({ path: `${dir}/nav-3-pit-lit.png` });
  await page.locator('#nav-pit').tap();
  await page.waitForFunction(() => !document.querySelector('#journal').open && ['on', 'opening'].includes(document.body.dataset.pit) || document.getElementById('pit-button')?.textContent.includes('Opening'), null, { timeout: 20000 });
  await page.screenshot({ path: `${dir}/nav-4-pit-opening.png` });
  await page.context().close();
  receipt.passed = true;
} catch (error) { receipt.errors.push(String(error)); process.exitCode = 1; }
finally { await fs.writeFile(`${dir}/nav-receipt.json`, JSON.stringify(receipt, null, 1)); console.log(JSON.stringify({ passed: receipt.passed, errors: receipt.errors })); await browser.close(); server.httpServer.close(); }
