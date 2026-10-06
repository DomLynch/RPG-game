// Stills and a clip for Dom's ?look=armfeel test (visual-pr-stills: the fight camera at 375 wide). The same seeded fight is replayed from its record on a built dist,
// once per feel (default off and high), one 16 ms frame at a time on the harness clock (scripts/lib/harness-clock.mjs): the pictures differ only by the flag, because the
// record fixes every tick. Runs on the VPS through `capture` (SwiftShader, no GPU).
//   node scripts/armfeel-clip.mjs --dist dist --out artifacts/armfeel [--feels off,high] [--every 2] [--dpr 2] [--opponent goblin] [--level 6]
// The fight is recorded here in Node (the Ladder's human-like blocker bot against the opponent). Two replays per feel: the OPENING (a record cut at --opening ticks, so
// the page replays it from its first tick: the ready idle, then the first exchanges) and the KILL (the whole record, replayed from the page's tail window).
// Writes <out>/<take>-<feel>.mp4, <take>-<feel>-idle.jpg, <take>-<feel>-hit.jpg (3 frames after the first blow on the opponent), <take>-compare.mp4 (feels side by side).
/* global process, console, document, URL, window */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { OPPONENTS, initialPractice, stepPractice } from '../src/combat.ts';
import { opponentAt, profileAt } from '../src/moves.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { human } from './ladder-human.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/armfeel'), FEELS = arg('feels', 'off,high').split(','), EVERY = Number(arg('every', 2)), DPR = Number(arg('dpr', 2));
const OPPONENT = arg('opponent', 'goblin'), LEVEL = Number(arg('level', 6)), OPENING = Number(arg('opening', 480));

// The fight: the first seed in which the human-like blocker beats the opponent. The recorder quantizes each intent, so the record IS what stepped.
function recordFight() {
  for (let seed = 1; seed <= 60; seed++) {
    const bot = human('blocker', 12, 0.2, seed * 7919), profile = profileAt(OPPONENTS[OPPONENT], LEVEL), rec = createRecorder({ build: 'armfeel', opponent: OPPONENT, weapon: 'longsword', level: LEVEL, seed });
    let p = initialPractice(seed, opponentAt(OPPONENTS[OPPONENT], LEVEL), 'longsword'), t = 0;
    const intents = [];
    for (; t < 5400 && !p.finish; t++) { const q = rec.push(bot(p)); intents.push(q); p = stepPractice(p, q, profile); }
    if (p.finish && p.finish.victim === 1) {
      const kill = rec.finish('killed');
      const open = createRecorder({ build: 'armfeel', opponent: OPPONENT, weapon: 'longsword', level: LEVEL, seed });
      for (const q of intents.slice(0, OPENING)) open.push(q);
      return { seed, ticks: t, kill, opening: open.finish('abandoned') };
    }
  }
  throw new Error('no winning seed in 60');
}

async function serveDist(dir) {   // scripts/special-clip.mjs's static server: gzip, no-store, SPA fallback
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// One replay of `text` with `feel`: frames every EVERY steps until the replay ends (page data-replay) or `frames` steps. Returns the shots and the frame of the first blow on the opponent.
async function take(text, feel, name, frames) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  const dir = `${OUT}/${name}-${feel}`; await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(dir, { recursive: true });
  try {
    await page.goto(`${server.origin}/?replay=${text}${feel === 'default' ? '' : `&feel=${feel}`}&debug`);   // 'default': no flag at all, the game as shipped
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
    await page.evaluate(() => { globalThis.__hits = []; globalThis.__blocks = []; globalThis.__frame = 0; window.addEventListener('frankendom:combat', (e) => { for (const ev of e.detail.events) { if (ev.type === 'Hit' && ev.target === 1) globalThis.__hits.push(globalThis.__frame); else if (ev.type === 'Blocked' || ev.type === 'Parried') globalThis.__blocks.push(globalThis.__frame); } }); });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page);
    const shots = []; let n = 0;
    for (; n < frames; n++) {
      const shoot = n % EVERY === 0;
      await skipDraws(page, !shoot);
      await clock.run(16);
      await page.evaluate(() => { globalThis.__frame++; });
      if (shoot) { const file = `${dir}/${String(shots.length).padStart(4, '0')}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 92, animations: 'disabled' }); shots.push(file); }
      if (await page.evaluate(() => !!document.getElementById('debug')?.dataset.replay)) break;
    }
    const hit = await page.evaluate(() => globalThis.__hits[0] ?? null), block = await page.evaluate(() => (globalThis.__blocks ?? [])[0] ?? null);
    return { shots, hit, block, steps: n };
  } finally { await context.close(); }
}

try {
  await fs.mkdir(OUT, { recursive: true });
  const fight = recordFight();
  console.log(`seed ${fight.seed}, ${fight.ticks} ticks, killed ${OPPONENT} L${LEVEL}`);
  const takes = { opening: await encodeRecord(fight.opening), kill: await encodeRecord(fight.kill) };
  const meta = { seed: fight.seed, ticks: fight.ticks, opponent: OPPONENT, level: LEVEL, viewport: '375x812', dpr: DPR, feels: FEELS, takes: {} };
  for (const [name, text] of Object.entries(takes)) {
    for (const feel of FEELS) {
      const { shots, hit, block, steps } = await take(text, feel, name, name === 'opening' ? OPENING + 60 : 7 * 60 + 120);
      const at = hit === null ? Math.floor(shots.length / 2) : Math.min(shots.length - 1, Math.floor((hit + 3) / EVERY));
      if (block !== null) await fs.copyFile(shots[Math.min(shots.length - 1, Math.floor((block + 3) / EVERY))], `${OUT}/${name}-${feel}-block.jpg`);
      await fs.copyFile(shots[0], `${OUT}/${name}-${feel}-idle.jpg`); await fs.copyFile(shots[at], `${OUT}/${name}-${feel}-hit.jpg`);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(60 / EVERY), '-i', `${OUT}/${name}-${feel}/%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${OUT}/${name}-${feel}.mp4`], { timeout: 300000 });
      meta.takes[`${name}-${feel}`] = { frames: shots.length, steps, firstBlowOnOpponent: hit, firstBlockOrParry: block };
      console.log(`${name}-${feel}: ${shots.length} frames, first blow at frame ${hit}`);
    }
    if (FEELS.length === 2) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/${name}-${FEELS[0]}.mp4`, '-i', `${OUT}/${name}-${FEELS[1]}.mp4`, '-filter_complex', 'hstack=inputs=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${OUT}/${name}-compare.mp4`], { timeout: 300000 });
  }
  await fs.writeFile(`${OUT}/meta.json`, JSON.stringify(meta, null, 2));
} finally { await browser.close(); await server.close(); }
