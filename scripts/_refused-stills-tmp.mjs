// scratch (untracked): spam Roll until the sim refuses a press, then shot the first frame a button wears .refused (after build) or the same moment (before). OUT=dir.
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
await page.goto(`${origin}/?fight=1`);
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${dir}/idle.png` });
// The real path (sim refuses a press -> PressRefused -> hud.refused) is covered by tests/hud.test.ts; headless software GL cannot land a refused press inside the 260 ms window,
// so this still HOLDS the exact end-state of the cue: the heavy button as the CSS leaves it at the first shake frame (opacity .45, 4 px left).
await page.addStyleTag({ content: '#actions button[data-hold]{opacity:.45 !important;transform:translateX(-4px) !important}' });
await page.evaluate(() => { document.getElementById('heavy-button').dataset.hold = '1'; });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/refused.png` });
await browser.close(); server.httpServer.close();
