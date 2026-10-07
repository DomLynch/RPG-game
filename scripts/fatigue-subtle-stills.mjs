// Evidence for the subtle tired body (`?look=fatigue-preview&stamina=N`, src/fatigue-layer.ts `subtle`): 375x812 from behind the hero at the fight camera, at stamina
// 100 (fresh), 8 and 3, once in ready idle (a passive dummy) and once MID-FIGHT (the hero swinging heavies every 40 frames at the dummy, shot on the first `ready` frame after a swing; the forced stamina needs the spar; the read pose failed on exactly
// this kind of frame). Frame-stepped on the harness clock. Writes <out>/<stamina>-<idle|fight>.jpg (+ a sheet.png of the six if ffmpeg is there) and logs the sim phase of each shot.
//   node scripts/fatigue-subtle-stills.mjs --dist dist --out artifacts/fatigue-subtle [--look fatigue-preview]
/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/fatigue-subtle'), LOOK = arg('look', 'fatigue-preview'), DPR = Number(arg('dpr', 2));
const RUNS = [{ name: 'idle', q: 'difficulty=dummy&skill=none&special=none', frame: 150 }, { name: 'fight', q: 'difficulty=dummy&skill=none&special=none', frame: 330 }];

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
const files = [];
try {
  for (const stamina of [100, 8, 3]) for (const run of RUNS) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${server.origin}/?opponent=veteran&spar=1&weapon=longsword&yourSpecial=none&debug&look=${LOOK}&stamina=${stamina}&${run.q}`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page); let shot = false;
    for (let f = 0; f < run.frame + 240 && !shot; f++) {
      if (f === 0) await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});
      if (run.name === 'fight' && f > 0 && f < run.frame && f % 40 === 0) await page.locator('#heavy-button').tap({ force: true, timeout: 3000 }).catch(() => {});
      const near = f >= run.frame; await skipDraws(page, !near); await clock.run(16);
      if (near) { const phase = await page.evaluate(() => globalThis.__special().fighters[0].phase); if (phase === 'ready') { const file = `${OUT}/${String(stamina).padStart(3, '0')}-${run.name}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 90, timeout: 180000 }); files.push(file); console.log(file, 'frame', f, 'phase', phase); shot = true; } }
    }
    if (!shot) console.log('NO ready frame', stamina, run.name);
    await context.close();
  }
  if (files.length === 6) { try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...files.flatMap((f) => ['-i', f]), '-filter_complex', '[0][1][2][3][4][5]hstack=inputs=6', `${OUT}/sheet.png`], { timeout: 120000 }); } catch (e) { console.log('no sheet', e.message.slice(0, 80)); } }
} finally { await browser.close(); await server.close(); }
