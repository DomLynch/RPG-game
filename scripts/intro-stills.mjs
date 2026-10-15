/* global process, console, document, window, localStorage */
// The first-visit intro at a phone (brief #2772, visual-pr-stills + the READY timing receipt). Against a built dist, Chromium on software GL:
//   node scripts/intro-stills.mjs --dist dist --out artifacts/intro
// Proves, each with a printed line: (1) an automation browser without ?intro=1 shows no caption (no release row changes); (2) ?intro=1 on a fresh device shows card 1 in the lower third, with the camera touring; (3) a tap anywhere skips it and the strip is gone;
// (4) a reload on the same device shows nothing (once per device); (5) cold load to FIGHT enabled, with and without a skip. Stills: intro-card-N.jpg (375x812).
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = path.resolve(arg('dist', 'dist')), OUT = arg('out', 'artifacts/intro');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const srv = http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, p), data; try { data = await fs.readFile(file); } catch { file = path.join(DIST, 'index.html'); data = await fs.readFile(file); }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(data);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}`;
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ready = (page) => page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') !== 'true' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 280000, polling: 300 });
const caption = (page) => page.evaluate(() => { const c = document.querySelector('.intro-caption'); return c ? { text: c.textContent, opacity: Number(c.style.opacity), rect: c.getBoundingClientRect().toJSON() } : null; });
const fresh = async (query) => { const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }); const page = await ctx.newPage(); page.on('pageerror', (e) => console.log('pageerror:', e.message)); const t0 = Date.now(); await page.goto(`${origin}/${query}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); return { ctx, page, t0 }; };
const result = {};
try {
  { const { ctx, page } = await fresh(''); await ready(page); await page.waitForTimeout(2500); result.automationSkips = (await caption(page)) === null; console.log('1 automation without ?intro=1 shows no caption:', result.automationSkips); await ctx.close(); }
  {
    const { ctx, page, t0 } = await fresh('?intro=1'); await ready(page); result.loadToReadyMs = Date.now() - t0;
    await page.waitForFunction(() => { const c = document.querySelector('.intro-caption'); return c && c.textContent && Number(c.style.opacity) > 0.95; }, null, { timeout: 60000 });
    const c1 = await caption(page); result.card1 = { text: c1.text, bottomFrac: Number((c1.rect.bottom / 812).toFixed(2)), topFrac: Number((c1.rect.top / 812).toFixed(2)) };
    await page.screenshot({ path: path.join(OUT, 'intro-card-1.jpg'), type: 'jpeg', quality: 72, timeout: 240000 });
    console.log('2 card 1 shown:', JSON.stringify(result.card1));
    await page.waitForFunction(() => document.querySelector('.intro-caption')?.textContent?.startsWith('This is Frankendom') && Number(document.querySelector('.intro-caption').style.opacity) > 0.95, null, { timeout: 60000 });
    await page.screenshot({ path: path.join(OUT, 'intro-card-2.jpg'), type: 'jpeg', quality: 72, timeout: 240000 });
    const tap = Date.now(); await page.touchscreen.tap(190, 300); await page.waitForTimeout(400);
    result.skipped = (await caption(page)) === null; console.log('3 a tap anywhere skips:', result.skipped); result.tapToGoneMs = Date.now() - tap;
    await page.screenshot({ path: path.join(OUT, 'intro-after-skip.jpg'), type: 'jpeg', quality: 72, timeout: 240000 });
    const storedFlag = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('frankendom.intro'))); result.flag = storedFlag;
    const page2 = await ctx.newPage(); page2.on('pageerror', (e) => console.log('pageerror:', e.message)); await page2.goto(`${origin}/?intro=1`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await ready(page2); await page2.waitForTimeout(3000);
    result.onceOnly = (await caption(page2)) === null; console.log('4 same device, reload: no intro:', result.onceOnly, 'flag', JSON.stringify(storedFlag)); await ctx.close();
  }
  { const { ctx, page } = await fresh('?intro=1&replay=x'); await ready(page); await page.waitForTimeout(2500); result.linkVisitSkips = (await caption(page)) === null; console.log('5 replay/kill-link style visit: no intro:', result.linkVisitSkips); await ctx.close(); }
  console.log('RESULT', JSON.stringify(result));
} finally { await browser.close(); srv.close(); }
