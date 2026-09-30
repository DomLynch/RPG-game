// Frame-stepped clip of Nyx's Nightfall for Dom (World, 2026-09-30; visual-pr-stills: the fight camera at 375 wide). ?special=nyx on a built
// dist, the phone viewport, the page clock fake and moved 1000/60 ms per frame with a screenshot per frame, so the mp4 at 60 fps plays the fight
// at real speed however slow the renderer is (the vstep recorder's method, scripts/lib/harness-clock.mjs). The player draws and stands; Nyx
// casts. Two passes, both the same scripted fight on the same seed: pass 1 runs without pictures to find the tick the windup begins, pass 2
// re-runs it and records from --pre frames before that to --post frames after the release. Shared box only (a real browser): run it through the
// VPS capture lock, `capture world node scripts/nyx-nightfall-clip.mjs --dist dist --arena c --out out/nyx-c`, then encode the frames dir:
//   ffmpeg -framerate 60 -i out/nyx-c/f%05d.jpg -vf scale=376:812,setsar=1 -c:v libx264 -pix_fmt yuv420p -crf 20 nyx-c.mp4
/* global process, console, document, URL */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import zlib from 'node:zlib';
import path from 'node:path';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), ARENA = arg('arena', 'c'), OUT = arg('out', `out/nyx-${ARENA}`), PRE = Number(arg('pre', '150')), POST = Number(arg('post', '300'));
const LEVEL = arg('level', '');   // unset: ?special=nyx's own level (46)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ktx2': 'image/ktx2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const server = http.createServer(async (req, res) => {   // gzip, no-store, SPA fallback
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  let file = path.join(DIST, p), data; try { data = await fs.readFile(file); } catch { file = path.join(DIST, 'index.html'); data = await fs.readFile(file); }
  const gz = zlib.gzipSync(data, { level: 6 });
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });

// One scripted fight. `record` null: no pictures, stop at the first windup frame and return its frame number. Otherwise: record [from, to).
async function play({ record }) {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/?special=nyx&arena=${ARENA}${LEVEL ? `&difficulty=${LEVEL}` : ''}&debug`);
  await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 600000, polling: 500 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  await page.getByText('Enter the arena').tap({ timeout: 5000 }).catch(() => {});
  const { run } = await harnessClock(page);
  await page.locator('#attack-button').tap().catch(() => {});   // draw, then stand: the opponent closes and casts
  const stage = () => page.evaluate(() => globalThis.__special().stages[1]);
  if (!record) {
    await skipDraws(page, true);
    for (let n = 0; n < 2400; n++) {
      await run(n % 3 === 2 ? 16 : 17);
      if ((await stage())?.stage === 'windup') { await browser.contexts().at(-1)?.close(); return n; }
    }
    throw new Error('no windup within 2400 frames (did the fight end first?)');
  }
  const [from, to] = record, frames = [];
  await skipDraws(page, true);
  for (let n = 0; n < to; n++) {
    if (n === from) { await skipDraws(page, false); await run(17); }   // a few real frames before the first picture
    await run(n % 3 === 2 ? 16 : 17);
    if (n >= from) {
      const file = `${OUT}/f${String(n - from).padStart(5, '0')}.jpg`;
      await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
      frames.push({ n, stage: (await stage())?.stage ?? null });
    }
  }
  await page.context().close();
  return frames;
}

try {
  await fs.rm(OUT, { recursive: true, force: true }); await fs.mkdir(OUT, { recursive: true });
  const t0 = Date.now(), windup = await play({ record: null }), from = Math.max(0, windup - PRE), to = windup + 120 + POST;
  console.log(`pass 1: the windup begins at frame ${windup} (${((Date.now() - t0) / 1000).toFixed(0)} s); recording frames ${from}..${to} (${to - from} = ${((to - from) / 60).toFixed(1)} s)`);
  const frames = await play({ record: [from, to] }), firstWindup = frames.findIndex((f) => f.stage === 'windup');
  await fs.writeFile(`${OUT}/frames.json`, JSON.stringify({ arena: ARENA, windup, from, to, windupFrameInClip: firstWindup, frames }, null, 1));
  console.log(`pass 2: ${frames.length} frames, the windup begins at clip frame ${firstWindup} (expected ${windup - from}); wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (Math.abs(firstWindup - (windup - from)) > 8) console.warn('the two passes drifted by more than 8 frames: the clip is still right (frames.json holds the real windup frame), but the pre-roll is shorter or longer than --pre');
} finally { await browser.close(); server.close(); }
