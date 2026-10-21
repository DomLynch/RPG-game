// RV86 before/after clip (Elden Ring light and thrust timings; visual-pr-stills: the fight camera at 375 wide). One take per run: the same scripted player (walks in, light, light, light, thrust, thrust, a pause between each) on the same seed,
// recorded and replayed in the tree it runs in, so run it once in a trunk checkout (--era old: the live timings today) and once in the RV86 branch (--era new), then stack the two (old left, new right):
//   node scripts/er86-clip.mjs --dist dist --out artifacts/er86-old --era old      (in a trunk checkout, after its own `vite build`)
//   node scripts/er86-clip.mjs --dist dist --out artifacts/er86-new --era new      (in the branch)
//   ffmpeg -i er86-old/old.mp4 -i er86-new/new.mp4 -filter_complex hstack=inputs=2 -c:v libx264 -pix_fmt yuv420p compare.mp4
// The page clock is fake and moved 1000/60 ms per step (scripts/lib/harness-clock.mjs), a picture every second step, so the mp4 plays at real speed however slow the renderer is. Runs on the VPS through `capture` (SwiftShader).
// --dry prints the take's swing timings and blows (no browser).
/* global process, console, document, URL */
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { OPPONENTS, initialPractice, stepPractice } from '../src/fight/combat.ts';
import { opponentAt, profileAt } from '../src/fight/moves.ts';
import * as ERA from '../src/fight/sandbox-era.ts';
import { encodeRecord } from '../src/fight/record.ts';
import { liveRecorder } from '../tests/lib/live-recorder.ts';   // era flags on, as the live game records

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/er86'), ERA_NAME = arg('era', 'new'), WEAPON = arg('weapon', 'longsword'), OPPONENT = arg('opponent', 'veteran'), LEVEL = Number(arg('level', 1)), EVERY = Number(arg('every', 2)), DRY = process.argv.includes('--dry');
const SCRIPT = [['light', 0], ['light', 70], ['light', 140], ['thrust', 210], ['thrust', 280]], END = 360;   // [action, ticks after the walk-in ends]; the first press draws the blade
const intent = (z, action = null) => ({ move: { x: 0, z, yaw: 0, run: false }, action, guard: false, lock: true });
const gapOf = (p) => Math.hypot(p.fighter.x - p.enemy.x, p.fighter.z - p.enemy.z);

function record() {
  ERA.setRows86?.(ERA_NAME === 'new');   // a trunk checkout has no RV86 switch: its timings are the old ones
  const seed = 731, profile = profileAt(OPPONENTS[OPPONENT], LEVEL), rec = liveRecorder({ build: 'er86', opponent: OPPONENT, weapon: WEAPON, level: LEVEL, seed });
  let p = initialPractice(seed, opponentAt(OPPONENTS[OPPONENT], LEVEL), WEAPON), arrived = -1;
  const swings = [];
  for (let t = 0; t < 2400 && !p.finish; t++) {
    let q;
    if (arrived < 0) { q = intent(gapOf(p) > 1.9 ? 1 : 0); if (gapOf(p) <= 1.9 && p.duel.fighters[0].phase === 'ready') arrived = t; }
    else { const r = t - arrived, a = SCRIPT.find(([, at]) => at === r); q = intent(0, a ? a[0] : null); if (r > END) break; }
    q = rec.push(q); p = stepPractice(p, q, profile);
    for (const e of p.duel.events) if (e.actor === 0 && (e.type === 'AttackStarted' || e.type === 'AttackActive' || e.type === 'Hit' || e.type === 'AttackMissed')) swings.push(`${t - arrived}:${e.type}:${e.move ?? ''}`);
  }
  return { record: rec.finish(p.finish ? (p.finish.draw ? 'draw' : p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned'), swings, arrived };
}

const take = record();
console.log(ERA_NAME, 'v' + take.record.v, 'walk-in', take.arrived, 'ticks:', take.swings.join(' '));
if (!DRY) {
  const { chromium } = await import('playwright'), { harnessClock, skipDraws } = await import('./lib/harness-clock.mjs');
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (req, res) => {   // scripts/armfeel-clip.mjs's static server: gzip, no-store, SPA fallback
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(DIST, p), data; try { data = await fs.readFile(file); } catch { file = path.join(DIST, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${srv.address().port}`, browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    await fs.mkdir(OUT, { recursive: true });
    const text = await encodeRecord(take.record), context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await context.newPage();
    const dir = `${OUT}/${ERA_NAME}`; await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(dir, { recursive: true });
    try {
      await page.goto(`${origin}/?replay=${text}&debug`);
      await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
      await page.addStyleTag({ content: '#debug{display:none!important}' });
      const clock = await harnessClock(page); let n = 0, shots = 0;
      for (; n < take.record.ticks + 90; n++) {
        const shoot = n % EVERY === 0; await skipDraws(page, !shoot); await clock.run(16);
        if (shoot) await page.screenshot({ path: `${dir}/${String(shots++).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92, animations: 'disabled' });
        if (await page.evaluate(() => !!document.getElementById('debug')?.dataset.replay)) break;
      }
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(60 / EVERY), '-i', `${dir}/%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${OUT}/${ERA_NAME}.mp4`], { timeout: 300000 });
      console.log(ERA_NAME, shots, 'frames');
    } finally { await context.close(); }
  } finally { await browser.close(); srv.close(); }
}
