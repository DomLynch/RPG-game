// Release row: the ladder's difficulty is the career's LEVEL, not a pick (Dom via Strategy, 2026-09-27: level = 1 + wins; was: the pick
// persists, 2026-09-26). At a phone size (375x812) and a desktop size (1280x800): a fresh fighter fights at level 1 and has no Sparring tab
// (Dom 2026-09-29: the rank decides; admins and ?debug get the tab's 46 levels), an old stored 'hard' is ignored after a reload, and 15 wins fight at level 16. A still of the player's journal (no Sparring tab) is the receipt. Guest only; nothing sent anywhere.
// QA_URL points it at a deployed site; unset, it serves this tree's build.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { preview } from 'vite';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.DIFFICULTY_RECEIPT_DIR || 'artifacts/difficulty-persist'; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { origin, revision: null, sizes: {}, errors: [], passed: false };
const SIZES = [['375x812', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }], ['1280x800', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }]];
try {
  receipt.revision = await fetch(new URL('/release.json', origin)).then(r => r.json()).catch(() => null);
  for (const [name, options] of SIZES) {
    const page = await (await browser.newContext(options)).newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', e => receipt.errors.push(`${name}: ${e}`));
    await page.route('**/*sentry.io/**', route => route.abort());
    await page.addInitScript(() => { try { localStorage.setItem('frankendom.firstloss.v1', '1'); } catch {} });   // a plain fresh visit is the scripted first loss now (#1396; row 51 covers it): the lesson is done, so this row meets the normal fresh fighter
    const ready = () => page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
    const options_ = async () => { await page.locator('#journal-button').click(); await page.waitForSelector('#journal[open]'); await page.evaluate(() => { const r = document.getElementById('journal-tab-arena'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); };
    const label = () => page.locator('#difficulty-select').inputValue();   // the Sparring tab's control names the fight's level even while hidden
    await page.goto(new URL('/', origin).href); await ready();
    await options_();
    assert.equal(await label(), '1', `${name}: a fresh fighter meets the Centurion at level 1`);
    assert.equal(await page.locator('#sparring-tab').isHidden(), true, `${name}: a player has no Sparring tab, so no Difficulty control (Dom 2026-09-29)`);
    await page.locator('#journal').screenshot({ path: `${dir}/${name}-fresh.png` });
    await page.evaluate(() => localStorage.setItem('frankendom.difficulty.v1', 'hard'));
    await page.reload(); await ready(); await options_();
    const stored = await page.evaluate(() => localStorage.getItem('frankendom.difficulty.v1'));
    assert.equal(await label(), '1', `${name}: the old stored pick is not read`);
    await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('frankendom.fighter.v1') || 'null'); localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'difficulty-row-0001', name: 'Wanderer', ...p, career: { victoryMarks: 15 } })); });
    await page.reload(); await ready(); await options_();
    const after = await label();
    await page.locator('#journal').screenshot({ path: `${dir}/${name}-legionary.png` });
    await page.screenshot({ path: `${dir}/${name}-options-legionary.png` });
    assert.equal(after, '16', `${name}: 15 wins fight at level 16`);
    receipt.sizes[name] = { stored, after };
    await page.context().close();
  }
  assert.deepEqual(receipt.errors, []);
  receipt.passed = true;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await server?.close();
}
console.log(`difficulty-persist-check: ${JSON.stringify(receipt.sizes)} receipts in ${dir}`);
