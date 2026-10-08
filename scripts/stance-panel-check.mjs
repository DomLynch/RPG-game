// The ?stances= preview must actually APPEAR (live 1d9269c8: the panel mounted only from began(), which the first fight never runs, so ?stances=1 showed nothing).
// Real page, real arena boot: with the flag the panel and its four buttons are in the DOM from load, before and after the first fight starts, the fourth reads Balanced; without the flag there is no panel.
import { chromium } from 'playwright';
import { preview } from 'vite';
import assert from 'node:assert/strict';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const base = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`);
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: base.href, cases: [], errors: [] };
const panelState = (page) => page.evaluate(() => ({ panel: !!document.querySelector('#stance-panel'), buttons: [...document.querySelectorAll('#stance-panel [data-stance]')].map((b) => `${b.dataset.stance}=${b.textContent}`) }));
try {
  for (const [search, expectPanel] of [['?stances=1', true], ['?stances=aggressive', true], ['', false]]) {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => receipt.errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(base.href + search);
    const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.tap({ timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 240000 });
    const before = await panelState(page);
    await page.getByRole('button', { name: 'Fight', exact: true }).tap(); await page.waitForTimeout(1500);
    const after = await panelState(page);
    receipt.cases.push({ search, expectPanel, before, after });
    assert.equal(before.panel, expectPanel, `${search || '(no flag)'}: panel before the fight`);
    assert.equal(after.panel, expectPanel, `${search || '(no flag)'}: panel after the fight starts`);
    if (expectPanel) for (const s of [before, after]) assert.deepEqual(s.buttons, ['neutral=Balanced', 'aggressive=Aggressive', 'defensive=Defensive', 'trickster=Trickster'], 'the four stance buttons, the fourth shown as Balanced');
    await page.close();
  }
  assert.deepEqual(receipt.errors, [], 'no page errors');
  console.log(JSON.stringify(receipt));
} finally { await browser.close(); await server?.close(); }
