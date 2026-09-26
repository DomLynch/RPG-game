// Release row: the difficulty a player picks in the journal's Options tab survives a reload (Dom via Strategy, 2026-09-26: it reset to
// normal on every boot and on the Rematch reload of #770). At a phone size (375x812) and a desktop size (1280x800): pick hard, read the
// stored key, reload, the control still says hard. A still of the control before and after is the receipt (the control itself is
// unchanged by the fix). Guest only; nothing sent anywhere. QA_URL points it at a deployed site; unset, it serves this tree's build.
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
    const ready = () => page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
    const options_ = async () => { await page.locator('#journal-button').click(); await page.waitForSelector('#journal[open]'); await page.evaluate(() => { const r = document.getElementById('journal-tab-arena'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }); };
    const label = () => page.locator('#difficulty').textContent();
    await page.goto(new URL('/?opponent=goblin', origin).href); await ready();
    await options_();
    assert.equal(await label(), 'Difficulty: normal', `${name}: a fresh visit starts on normal`);
    for (let i = 0; i < 3 && (await label()) !== 'Difficulty: hard'; i++) { await page.locator('#difficulty').click(); await page.waitForTimeout(100); }
    assert.equal(await label(), 'Difficulty: hard', `${name}: the pick reached hard`);
    const stored = await page.evaluate(() => localStorage.getItem('frankendom.difficulty.v1'));
    assert.equal(stored, 'hard', `${name}: the pick is stored at once`);
    await page.locator('#difficulty').screenshot({ path: `${dir}/${name}-picked.png` });
    await page.reload(); await ready();
    await options_();
    const after = await label();
    await page.locator('#difficulty').screenshot({ path: `${dir}/${name}-after-reload.png` });
    await page.screenshot({ path: `${dir}/${name}-options-after-reload.png` });
    assert.equal(after, 'Difficulty: hard', `${name}: the pick survives the reload`);
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
