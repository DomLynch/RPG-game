// One still of Zone 1 at spawn, 375x812 (the fight camera's phone width), for a PR's before/after. Usage: URL=http://127.0.0.1:5190/preview/origins/?region=1 OUT=docs/pr-stills/<pr>/spawn.png node scripts/zone1-spawn-still.mjs
import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const URL = process.env.URL || 'http://127.0.0.1:5190/preview/origins/?region=1', OUT = process.env.OUT || 'artifacts/zone1-spawn.png', SETTLE_MS = +(process.env.SETTLE_MS ?? 9000);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true })).newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__zoneReady, null, { timeout: 120000 });
await page.waitForTimeout(SETTLE_MS);
if (process.env.HIDE_CARD) await page.evaluate(() => { for (const e of document.querySelectorAll('*')) if (!e.children.length && /Left stick walks/.test(e.textContent || '')) { const box = e.closest('div'); if (box) box.style.display = 'none'; } });   // HIDE_CARD=1: the how-to-play card off, to see what stands behind it
await page.screenshot({ path: OUT });
await browser.close();
console.log('wrote', OUT);
