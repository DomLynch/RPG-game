// The second fight's first frame at 375x812 (the standoff draw-in must replay on a rematch): boots the guest, lets the first standoff finish, presses
// the next-fight button in place, steps one frame and takes the still. Run it once per tree (before = trunk, after = this branch).
//   node scripts/standoff-rematch-stills.mjs <label>     stills + receipt: artifacts/combat/standoff-rematch/<label>-*.png
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { harnessClock } from './lib/harness-clock.mjs';
import fs from 'node:fs/promises';

const label = process.argv[2] ?? 'after', out = 'artifacts/combat/standoff-rematch', outDir = `artifacts/combat/standoff-rematch/build-${label}`;
await fs.mkdir(out, { recursive: true });
await build({ logLevel: 'error', build: { outDir } });
const server = await preview({ build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/*sentry.io/**', (r) => r.abort());
await page.goto(`${origin}/?opponent=goblin&debug=1`);
await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 120000 });
await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
await page.waitForFunction(() => document.querySelector('#welcome').hidden);
const { run } = await harnessClock(page);
await run(2000);   // the first fight's standoff (800 ms) is over: both men stand armed
await page.screenshot({ path: `${out}/${label}-1-first-fight-after-window.png` });
await page.evaluate(() => document.querySelector('#reset-button').click());   // the next fight, in place (no reload)
await run(32);   // two frames into the second fight
await page.screenshot({ path: `${out}/${label}-2-second-fight-first-frame.png` });
await run(1000);
await page.screenshot({ path: `${out}/${label}-3-second-fight-after-window.png` });
await fs.writeFile(`${out}/${label}-receipt.json`, JSON.stringify({ label, origin, engine: 'Chromium (Playwright), 375x812 touch, harness clock', errors }, null, 1));
await browser.close(); await server.close();
console.log(`standoff-rematch-stills ${label}: ${errors.length} page errors`);
