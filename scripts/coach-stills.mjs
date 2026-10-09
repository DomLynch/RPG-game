/* global process, console, document */
// Stills for the Coach UI (TOP10 row 8, Web): the live "Coached" tag mid-fight, the menu chip, and the "Coached win" mark after a coached kill; before = the same page with the Coach off.
//   node scripts/coach-stills.mjs --dist dist --out artifacts/coach [--widths 375,1280]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/coach'), WIDTHS = arg('widths', '375,1280').split(',').map(Number);
async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
await fs.mkdir(OUT, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const width of WIDTHS) for (const coachOn of [false, true]) {
    const mobile = width < 700, context = await browser.newContext({ viewport: { width, height: mobile ? 812 : 800 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 }), page = await context.newPage();
    await page.addInitScript((on) => { try { localStorage.setItem('frankendom.coach', on ? '1' : '0'); } catch { /* blocked */ } window.__coachEvents = []; window.addEventListener('frankendom:coach', (e) => window.__coachEvents.push(e.detail)); }, coachOn);
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${server.origin}/?debug`);
    await page.waitForFunction(() => document.querySelector('#attack-button')?.getAttribute('aria-disabled') !== 'true' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 300 }).catch(() => console.log('attack never enabled'));
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page), tag = `${width}-${coachOn ? 'after' : 'before'}`;
    for (let f = 0; f < 200; f++) { if (f === 0 && !coachOn) await (mobile ? page.locator('#attack-button').tap({ force: true, timeout: 3000 }) : page.locator('#attack-button').click({ force: true, timeout: 3000 })).catch(() => {}); await skipDraws(page, f < 199); await clock.run(16); }
    await page.screenshot({ path: `${OUT}/${tag}-fight.jpg`, type: 'jpeg', quality: 88, timeout: 180000 });
    console.log(tag, 'events', JSON.stringify(await page.evaluate(() => ({ ev: window.__coachEvents, ls: localStorage.getItem('frankendom.coach') }))), 'tag', await page.evaluate(() => { const t = document.querySelector('#coach-tag'); return t ? `${t.hidden ? 'hidden' : 'shown'}:${t.textContent}` : 'missing'; }), 'chip', await page.evaluate(() => document.querySelector('#mobile-coach')?.textContent));
    if (coachOn) {   // run on to the kill and capture the win mark
      let ended = false;
      for (let f = 0; f < 6000 && !ended; f++) { await skipDraws(page, true); await clock.run(16); if (f % 50 === 0) ended = await page.evaluate(() => !!document.querySelector('#debug')?.dataset.record); }
      await skipDraws(page, false); await clock.run(2400);
      await page.screenshot({ path: `${OUT}/${tag}-end.jpg`, type: 'jpeg', quality: 88, timeout: 180000 });
      console.log(tag, 'ended', ended, 'tag', await page.evaluate(() => { const t = document.querySelector('#coach-tag'); return t ? `${t.hidden ? 'hidden' : 'shown'}:${t.textContent}` : 'missing'; }), await page.evaluate(() => document.querySelector('#debug')?.dataset.record));
    }
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
