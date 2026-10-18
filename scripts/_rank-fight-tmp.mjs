// scratch (untracked): full 375x812 idle + mid-fight at Origin I (45) and V (49), no debug overlay. OUT=dir.
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
for (const marks of [45, 49]) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.route('**/*sentry.io/**', (r) => r.abort());
  await page.addInitScript((m) => localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'rank-stills-0001', name: 'Wanderer', career: { victoryMarks: m } })), marks);
  await page.goto(`${origin}/?fight=1`);
  await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/m${marks}-idle.png` });
  await page.locator('#attack-button').tap(); await page.waitForTimeout(450);
  await page.screenshot({ path: `${dir}/m${marks}-midfight.png` });
  await ctx.close();
}
await browser.close(); server.httpServer.close();
