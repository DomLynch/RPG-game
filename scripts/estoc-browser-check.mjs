// Read-only browser receipt: the real Nightborn route loads the baked rig and fights on a phone viewport.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { preview } from 'vite';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`);
url.searchParams.set('opponent', 'nightborn'); url.searchParams.set('debug', '1');
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: url.href, physicalPhone: false, errors: [], views: [] };
const hash = b => createHash('sha256').update(b).digest('hex');
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  page.on('pageerror', e => receipt.errors.push(String(e)));
  await page.route('**/*sentry.io/**', r => r.abort());
  const asset = page.waitForResponse(r => /\/nightborn(?:-[\w-]+)?\.glb(?:\?|$)/.test(r.url()), { timeout: 90000 });
  await page.goto(url.href);
  const response = await asset; assert.equal(response.status(), 200);
  receipt.rigSha256 = hash(await response.body());
  assert.equal(receipt.rigSha256, hash(await fs.readFile('src/assets/nightborn.glb')), 'served Nightborn must match the tested rig');
  await page.getByRole('button', { name: /Enter the arena/ }).tap();
  await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  await page.getByRole('button', { name: 'Draw sword', exact: true }).tap();
  await page.waitForFunction(() => Number(document.querySelector('#debug').dataset.tick) > 60);
  await fs.mkdir('artifacts/weapons/estoc-live', { recursive: true });
  for (const viewport of [{ width: 393, height: 852 }, { width: 852, height: 393 }]) {
    await page.setViewportSize(viewport);
    const state = await page.evaluate(() => ({ clips: document.querySelector('#debug').dataset.clips, overflow: document.documentElement.scrollWidth > innerWidth, art: document.querySelector('#art-status').textContent }));
    assert.equal(state.art, ''); assert.equal(state.overflow, false); assert.match(state.clips, /@WeaponDrawn/, 'opponent renders the estoc node');
    receipt.views.push({ ...viewport, ...state });
    await page.screenshot({ path: `artifacts/weapons/estoc-live/game-${viewport.width}.png` });
  }
  await page.waitForFunction(() => Number(document.querySelector('#player-health').value) < Number(document.querySelector('#player-health').max), null, { timeout: 30000 });
  receipt.opponentLanded = true;
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
  console.log(JSON.stringify(receipt));
} finally {
  await fs.mkdir('artifacts/weapons/estoc-live', { recursive: true });
  await fs.writeFile(process.env.ESTOC_RECEIPT || 'artifacts/weapons/estoc-live/browser.json', JSON.stringify(receipt, null, 2));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
