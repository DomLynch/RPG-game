// scratch (untracked): the HUD at 375x812 on the #1475 build, as built vs with the PR's one CSS rule injected. OUT=dir.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { preview } from 'vite';
import process from 'node:process';
/* global document */
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.OUT || 'out'; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.route('**/*sentry.io/**', (r) => r.abort());
await page.addInitScript(() => localStorage.setItem('frankendom.fighter.v1', JSON.stringify({ version: 1, id: 'shadow-0001', name: 'Wanderer', career: { victoryMarks: 49 } })));
await page.goto(`${origin}/?fight=1`);
await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const clip = { x: 0, y: 0, width: 375, height: 140 };
await page.screenshot({ path: `${dir}/before-full.png` }); await page.screenshot({ path: `${dir}/before-hud.png`, clip });
await page.addStyleTag({ content: '#fight-rank, #combat-status { text-shadow: 0 0 2px #000, 0 1px 3px #000e, 0 0 10px #000b, 0 0 22px #0008; }' });
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/after-full.png` }); await page.screenshot({ path: `${dir}/after-hud.png`, clip });
await browser.close(); server.httpServer.close();
