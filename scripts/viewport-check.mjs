// Release check: the canvas box follows the LAYOUT viewport, never the zoomed visual one (live bug on a50f22f, Dom's iPhone
// 2026-09-23 15:21: after a page zoom the canvas sat in the top half of the phone, the page background below it, the HUD floating
// over the void, the camera framed for the wrong aspect). iOS Safari reports the zoomed visual viewport in innerWidth/innerHeight;
// Chromium does not, so this check plays iOS: it makes innerWidth/innerHeight report a 2.5× zoomed visual viewport and fires resize,
// then asserts the canvas still covers the layout viewport and its drawing buffer keeps the layout's aspect; then it zooms back out
// and asserts the same. A phone context; no fight, the canvas is sized at boot. Stills land in the receipt directory.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const url = new URL(process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`); url.searchParams.set('debug', '1');
const out = process.env.VIEWPORT_RECEIPT_DIR || 'artifacts/viewport-check'; await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url: url.href, errors: [], passed: false };
try {
  const page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.setDefaultTimeout(15000);
  await page.route('**/*sentry.io/**', r => r.abort());
  page.on('pageerror', e => receipt.errors.push(String(e)));
  await page.goto(url.href);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
  const measure = () => page.evaluate(() => {
    const c = document.querySelector('#world'), b = c.getBoundingClientRect(), d = document.documentElement;
    return { box: { x: b.x, y: b.y, w: b.width, h: b.height }, layout: { w: d.clientWidth, h: d.clientHeight }, buffer: { w: c.width, h: c.height }, style: c.getAttribute('style') ?? '' };
  });
  const paint = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  const covers = (m, what) => {
    assert.ok(Math.abs(m.box.w - m.layout.w) <= 1 && Math.abs(m.box.h - m.layout.h) <= 1 && m.box.x === 0 && m.box.y === 0, `${what}: the canvas covers the layout viewport — box ${JSON.stringify(m.box)} vs layout ${JSON.stringify(m.layout)}`);
    assert.ok(Math.abs(m.buffer.w / m.buffer.h - m.layout.w / m.layout.h) < 0.01, `${what}: the drawing buffer keeps the layout's aspect — buffer ${JSON.stringify(m.buffer)} vs layout ${JSON.stringify(m.layout)}`);
  };
  receipt.boot = await measure(); covers(receipt.boot, 'boot');
  await page.screenshot({ path: `${out}/boot.png` });
  // iOS's report of a 2.5× pinch: the visual viewport is 2.5× smaller in both axes and innerWidth/innerHeight say so.
  await page.evaluate(() => {
    const d = document.documentElement;
    Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => Math.round(d.clientWidth / 2.5) });
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => Math.round(d.clientHeight / 2.5) });
    window.dispatchEvent(new Event('resize'));
  });
  await paint();
  receipt.zoomed = await measure();
  await page.screenshot({ path: `${out}/zoomed.png` });
  covers(receipt.zoomed, 'zoomed 2.5×');
  await page.evaluate(() => { delete window.innerWidth; delete window.innerHeight; window.dispatchEvent(new Event('resize')); });
  await paint();
  receipt.unzoomed = await measure();
  await page.screenshot({ path: `${out}/unzoomed.png` });
  covers(receipt.unzoomed, 'zoomed back out');
  assert.deepEqual(receipt.errors, [], 'no page errors');
  receipt.passed = true;
} finally {
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ passed: receipt.passed, boot: receipt.boot?.box, zoomed: receipt.zoomed?.box, unzoomed: receipt.unzoomed?.box, style: receipt.zoomed?.style, errors: receipt.errors }));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
