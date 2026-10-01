// A frame-stepped clip of a Special Move for Dom (visual-pr-stills: the fight camera at 375 wide): ?special=<name> on a built dist, phone
// viewport, the player draws and stands; the opponent casts. Runs on the VPS through `capture` (SwiftShader has no GPU, so real time would
// come out slow motion): the page's clock is the harness clock (scripts/lib/harness-clock.mjs), one 16 ms frame at a time, a screenshot every
// --every frames, then ffmpeg. Two passes over the same deterministic fight: the first with the draws off finds the tick the windup starts and
// the strike lands; the second draws from --pre ticks before the windup to --post ticks after the strike.
//   node scripts/special-clip.mjs --dist dist --special set [--arena a] [--out artifacts/red-wind/day] [--pre 40] [--post 150] [--every 2] [--dpr 2]
// Writes <out>/clip.mp4, <out>/peak.png (the frame at PEAK ticks after the strike), <out>/windup.png and <out>/meta.json.
/* global process, console, document, URL */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), SPECIAL = arg('special', 'set'), ARENA = arg('arena', ''), OUT = arg('out', `artifacts/special-${SPECIAL}${ARENA ? `-${ARENA}` : ''}`);
const PRE = Number(arg('pre', 40)), POST = Number(arg('post', 150)), EVERY = Number(arg('every', 2)), DPR = Number(arg('dpr', 2)), PEAK = Number(arg('peak', 8));

async function serveDist(dir) {   // scripts/special-stills.mjs's static server: gzip, no-store, SPA fallback
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const stage = (page) => page.evaluate(() => { const s = globalThis.__special(); return { tick: s.tick, caster: s.stages[1] ?? s.stages[0] }; });

// One deterministic run. `plan` null: draws off, find the windup and strike ticks. Otherwise draw from plan.from to plan.to and shoot.
async function run(plan) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  try {
    await page.goto(`${server.origin}/?special=${SPECIAL}${ARENA ? `&arena=${ARENA}` : ''}&debug`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });   // the dev overlay only: the HUD and the wind-up tell stay
    const clock = await harnessClock(page);
    await skipDraws(page, true);
    await page.locator('#attack-button').tap().catch(() => {});   // draw, then stand: the warden closes and casts
    const seen = { start: null, land: null }, shots = [], frameMs = [];   // frameMs: the wall time of each drawn 16 ms step (SwiftShader: a cost ratio between stages, not a phone's frame rate)
    let drawing = false, frame = 0;
    for (let n = 0; n < 6000; n++) {
      const { tick, caster } = await stage(page);
      if (caster?.stage === 'windup' && seen.start === null) seen.start = tick;
      if (caster?.stage === 'recover' && seen.land === null) seen.land = tick;
      if (!plan) { if (seen.land !== null && tick >= seen.land + POST) return seen; }
      else {
        if (!drawing && tick >= plan.from) { await skipDraws(page, false); await clock.run(48); drawing = true; }
        if (drawing && (n % EVERY === 0)) {
          const file = `${OUT}/frames/${String(frame++).padStart(4, '0')}.jpg`;
          await page.screenshot({ path: file, type: 'jpeg', quality: 92, animations: 'disabled' });
          shots.push({ file, tick, stage: caster });
        }
        if (tick >= plan.to) return { shots, frameMs };
      }
      const began = Date.now(); await clock.run(16);
      if (plan && drawing) frameMs.push({ stage: caster?.stage ?? (seen.start === null ? 'before' : 'idle'), ms: Date.now() - began });
    }
    throw new Error('no cast within 6000 frames (did the fight end first?)');
  } finally { await context.close(); }
}

try {
  await fs.rm(`${OUT}/frames`, { recursive: true, force: true }); await fs.mkdir(`${OUT}/frames`, { recursive: true });
  const seen = await run(null);
  console.log(`windup starts at tick ${seen.start}, strike at ${seen.land}`);
  const { shots, frameMs } = await run({ from: seen.start - PRE, to: seen.land + POST });
  const mean = (xs) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null, by = (name) => frameMs.filter((f) => f.stage === name).map((f) => f.ms);
  // The peak: the shot nearest PEAK ticks after the strike; the wind-up still: the shot nearest 80 % of the windup.
  const near = (tick) => shots.reduce((b, s) => Math.abs(s.tick - tick) < Math.abs(b.tick - tick) ? s : b);
  await fs.copyFile(near(seen.land + PEAK).file, `${OUT}/peak.jpg`); await fs.copyFile(near(seen.start + Math.round(0.8 * (seen.land - seen.start))).file, `${OUT}/windup.jpg`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(60 / EVERY), '-i', `${OUT}/frames/%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', `${OUT}/clip.mp4`], { timeout: 600_000 });   // bounded (tests/child-process-bounds.test.ts)
  await fs.writeFile(`${OUT}/meta.json`, JSON.stringify({ special: SPECIAL, arena: ARENA || '(ladder)', viewport: '375x812', dpr: DPR, windup: seen.start, strike: seen.land, frames: shots.length, seconds: shots.length * EVERY / 60, pre: PRE, post: POST, frameMs: { before: mean(by('before')), windup: mean(by('windup')), recover: mean(by('recover')), note: 'SwiftShader wall ms per drawn 16 ms step, no screenshot: a ratio between stages, not a phone frame rate' } }, null, 2));
  console.log(`clip: ${shots.length} frames (${(shots.length * EVERY / 60).toFixed(1)} s) -> ${OUT}/clip.mp4`);
} finally { await browser.close(); await server.close(); }
