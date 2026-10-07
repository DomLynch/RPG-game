/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const STANCES = ['neutral','aggressive','defensive','trickster'];
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/fread'), DPR = Number(arg('dpr', 2));
const QUERY = (s) => `?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none&yourSpecial=none&special=none&debug&look=stances&stance=${s}`;

async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

// Stance poses (?look=stances, src/stance-pose.ts): the hero in ready idle at the fight camera (375x812), one still per stance, from the same sim frame.
//   node scripts/stance-stills.mjs --dist dist --out artifacts/stances
await fs.mkdir(OUT, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const s of STANCES) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${server.origin}/${QUERY(s)}`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page);
    for (let f = 0; f < 150; f++) { await skipDraws(page, f < 149); await clock.run(16); }
    console.log(s, 'phase', await page.evaluate(() => globalThis.__special().fighters[0].phase), await page.evaluate(() => location.search));
    await page.screenshot({ path: `${OUT}/${s}.jpg`, type: 'jpeg', quality: 90, timeout: 180000 });
    await context.close();
  }
} finally { await browser.close(); await server.close(); }
