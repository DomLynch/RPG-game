/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/fread'), DPR = Number(arg('dpr', 2));
const LOOK = arg('look', ''), FRAMES = arg('frames', '');
const QUERY = `?opponent=veteran&spar=1&weapon=longsword&difficulty=normal&skill=none&yourSpecial=none&special=none&debug${LOOK ? `&look=${LOOK}` : ''}`;

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

// The foe's held guard side (?look=guard-cue, src/guard-cue.ts) at the fight camera (375x812). Spar vs the Veteran at normal; the hero cuts every 40 frames, the foe guards; the frame-stepped
// clock makes a frame the same sim tick with the flag on or off. Pass 1 (no --look) finds up to 3 frames with a different foe guard side and writes <out>/frames.json; pass 2 shoots them.
//   node scripts/guard-cue-stills.mjs --dist dist --out artifacts/gcue/off
//   node scripts/guard-cue-stills.mjs --dist dist --out artifacts/gcue/on --look guard-cue --frames artifacts/gcue/off/frames.json
await fs.mkdir(OUT, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(`${server.origin}/${QUERY}`);
  await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const clock = await harnessClock(page), want = FRAMES ? JSON.parse(await fs.readFile(FRAMES, 'utf8')) : null, found = [], seen = new Set();
  for (let f = 0; f < 1500; f++) {
    if (f % 40 === 0) await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});
    const shot = want?.find((w) => w.f === f + 1);
    await skipDraws(page, !shot); await clock.run(16);
    if (!want) {
      const st = await page.evaluate(() => { const g = globalThis.__special().fighters[1]; return { phase: g.phase, dir: g.guardDirection }; });
      if (st.phase === 'guard' && !seen.has(st.dir) && found.length < 3) { seen.add(st.dir); found.push({ f: f + 1, dir: st.dir }); }
      if (found.length === 3) break;
    } else if (shot) { console.log('cue dom', JSON.stringify(await page.evaluate(() => { const e = document.getElementById('guard-cue'); return e && { text: e.textContent, hidden: e.hidden, display: getComputedStyle(e).display, size: getComputedStyle(e).fontSize, w: e.getBoundingClientRect().width }; }))); await page.screenshot({ path: `${OUT}/guard-${shot.dir ?? 'thrust'}.jpg`, type: 'jpeg', quality: 90, timeout: 180000 }); }
  }
  if (!want) { await fs.writeFile(`${OUT}/frames.json`, JSON.stringify(found)); console.log('frames', JSON.stringify(found)); }
} finally { await browser.close(); await server.close(); }
