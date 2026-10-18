// scratch (untracked): drive a fight to fatigue band 2 and shot the "Pace yourself" line. OUT=dir.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { preview } from 'vite';
import process from 'node:process';
import console from 'node:console';
/* global document */
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.OUT || 'out'; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.route('**/*sentry.io/**', (r) => r.abort());
await page.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (f, d, ...a) => st(f, d === 4000 ? 90000 : d, ...a);   // stills only: hold the 4 s lesson line
   try { localStorage.removeItem('frankendom.lesson.pace.v1'); localStorage.setItem('frankendom.firstloss.v1', '1'); } catch {} });
await page.goto(`${origin}/?fight=1&pacestill=1`);
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__pace = false; new MutationObserver(() => { if (/Pace yourself/.test(document.getElementById('combat-status')?.textContent || '')) window.__pace = true; }).observe(document.getElementById('combat-status'), { childList: true, characterData: true, subtree: true }); });
let shot = false;
const t0 = Date.now();
while (!shot && Date.now() - t0 < 150000) {
  if (await page.evaluate(() => window.__pace)) { await page.screenshot({ path: `${dir}/pace.png` }); shot = true; console.log('pace line shown after ms', Date.now() - t0); }
  else await page.waitForTimeout(100);
}
console.log('shot', shot);
if (!shot) await page.screenshot({ path: `${dir}/no-pace.png` });
await browser.close(); server.httpServer.close();
