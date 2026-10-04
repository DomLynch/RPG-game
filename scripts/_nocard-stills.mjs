// First-paint + Profile stills for the no-name-card PR. DIST = a built tree, OUT = output dir, TAG = before|after. 375x812, dpr 2, phone insets substituted.
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';
const { DIST, OUT, TAG } = process.env; await fs.mkdir(OUT, { recursive: true });
const server = await preview({ build: { outDir: DIST }, preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const b = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const INSET = { top: 50, bottom: 34, left: 0, right: 0 };
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.route('**/*sentry.io/**', (r) => r.abort());
await page.route('**/assets/*.css', async (r) => { const res = await r.fetch(); let t = await res.text(); for (const [k, v] of Object.entries(INSET)) t = t.replaceAll(`env(safe-area-inset-${k})`, `${v}px`); await r.fulfill({ response: res, body: t }); });
await page.goto(origin, { waitUntil: 'commit' });
await page.waitForFunction(() => document.querySelector('#attack-button'), null, { timeout: 120000 });
await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 150000 }).catch(() => {});
await page.waitForTimeout(3000);
const info = await page.evaluate(() => { const v = (id) => { const e = document.querySelector(id), r = e?.getBoundingClientRect(); return e ? { hidden: e.hidden, vis: getComputedStyle(e).visibility, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; }; return { welcome: v('#welcome'), skill: v('#skill-button'), fight: v('#attack-button'), nameInput: v('#name-input') ?? v('#name-form input') }; });
await page.screenshot({ path: `${OUT}/${TAG}-first-paint-375.png` });
// Profile with the name edit: open the journal (its Profile tab), screenshot; the Rename button lives at the foot of the card row.
await page.evaluate(() => { if (document.querySelector('#welcome') && !document.querySelector('#welcome').hidden) document.querySelector('#name-form button[type="submit"]').click(); });
await page.evaluate(() => document.getElementById('journal-button').click());
await page.waitForSelector('#journal[open]'); await page.evaluate(() => { const t = document.getElementById('journal-tab-profile'); if (t) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); } });
await page.waitForTimeout(500);
info.rename = await page.evaluate(() => { const e = document.getElementById('mobile-name'), r = e?.getBoundingClientRect(); return e ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: getComputedStyle(e).visibility, text: e.textContent } : null; });
await page.screenshot({ path: `${OUT}/${TAG}-profile-375.png` });
await fs.writeFile(`${OUT}/${TAG}-info.json`, JSON.stringify({ info, errors }, null, 2));
await b.close(); server.httpServer.close(); console.log(TAG, JSON.stringify(info));
