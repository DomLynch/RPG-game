// The goblin in the real game (dist, or QA_URL=https://frankendom.com for the live receipt): `?opponent=goblin` loads goblin.glb, the HUD
// ceilings are his (100), a fight runs, and the lock camera frames him at the brief's phone sizes. Screens → artifacts/goblin/live-<size>.png.
import { preview } from 'vite'; import { chromium } from 'playwright'; import fs from 'node:fs/promises';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0, strictPort: true } });
const base = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: base };
try {
  for (const [w, h] of [[393, 852], [852, 393]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }), page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e))); await page.route('**/*sentry.io/**', r => r.abort());
    const requests = []; page.on('request', r => { if (r.url().includes('.glb')) requests.push(r.url().split('/').pop()); });
    await page.goto(`${base}/?opponent=goblin`);
    await page.waitForFunction(() => document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
    await page.getByRole('button', { name: 'Enter the courtyard' }).tap(); await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    await page.waitForFunction(() => document.querySelector('#art-status').textContent === '', null, { timeout: 90000 });
    await page.waitForTimeout(1500);
    const hud = await page.evaluate(() => ({ health: document.querySelector('#health-value').textContent, player: document.querySelector('#player-health-value').textContent, status: document.querySelector('#combat-status').textContent }));
    await page.screenshot({ path: `artifacts/goblin/live-${w}x${h}.png` });
    // Draw (the first attack press) and let the fight run 6 s: the goblin comes at the hero and something lands or is blocked — the status line changes.
    const before = hud.status; await page.locator('#attack-button').tap(); await page.waitForTimeout(6000);
    const after = await page.evaluate(() => ({ health: document.querySelector('#health-value').textContent, player: document.querySelector('#player-health-value').textContent, status: document.querySelector('#combat-status').textContent }));
    await page.screenshot({ path: `artifacts/goblin/live-${w}x${h}-6s.png` });
    receipt[`${w}x${h}`] = { glbs: [...new Set(requests)], hud, after, statusChanged: before !== after.status, errors };
    await ctx.close();
  }
} finally { await browser.close(); await server?.close(); }
console.log(JSON.stringify(receipt, null, 1));
const ok = Object.values(receipt).every(r => typeof r !== 'object' || (r.glbs.some(g => /^goblin[-.]/.test(g)) && r.hud.health.endsWith('/ 100') && r.hud.player.endsWith('/ 150') && r.statusChanged && !r.errors.length));
if (!ok) { console.error('FAILED'); process.exit(1); }
