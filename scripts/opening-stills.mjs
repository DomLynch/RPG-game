// 375 stills of the open stagger (Lead's brief item 2, #1494; visual-pr-stills: the fight camera at 375 wide). A seeded fight (the Ladder's human-like blocker bot) is recorded
// up to a moment the FOE is open (Practice.opening, side 1) and replayed from its record on a built dist, one 16 ms frame at a time (scripts/lib/harness-clock.mjs): stills are
// the ready idle before the exchange, then the opening at ~20 %, 50 % and 85 % of its ticks, keyed by sim tick (meta.json `stills`). Runs on the VPS through `capture`.
//   node scripts/opening-stills.mjs --dist dist --out artifacts/opening [--opponent veteran] [--level 3] [--dpr 1]
/* global process, console, document, URL, window */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { OPPONENTS, initialPractice, stepPractice } from '../src/combat.ts';
import { human } from './ladder-human.mjs';
import { opponentAt, profileAt } from '../src/moves.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/opening'), EVERY = Number(arg('every', 3)), DPR = Number(arg('dpr', 2)), AFTER = Number(arg('after', 40));
const STILLS = arg('stills', '');   // a meta.json from the AFTER run: take the same frames in a BEFORE replay
const OPPONENT = arg('opponent', 'veteran'), LEVEL = Number(arg('level', 3)), RECORD = arg('record', ''), MAX = Number(arg('max', 2400));

// The fight: the first seed in which the blocker opens the foe (a parry or a broken posture) for at least 40 ticks; the record stops once that opening is over.
function recordFight() {
  for (let seed = 1; seed <= 80; seed++) {
    const bot = human('blocker', 12, 0.2, seed * 7919), profile = profileAt(OPPONENTS[OPPONENT], LEVEL), rec = createRecorder({ build: 'opening', opponent: OPPONENT, weapon: 'longsword', level: LEVEL, seed });
    let p = initialPractice(seed, opponentAt(OPPONENTS[OPPONENT], LEVEL), 'longsword'), t = 0, open = null;
    for (; t < 3000 && !p.finish; t++) {
      p = stepPractice(p, rec.push(bot(p)), profile);
      const o = p.opening;
      if (!open && o?.side === 1 && o.of >= 40) open = { start: t, of: o.of, kind: o.kind };
      if (open && t >= open.start + open.of + 30) break;
    }
    if (open) { const idle = 20; return { rec, ticks: t, bands: [[idle, 'idle'], [open.start + Math.round(open.of * .2), 'open20'], [open.start + Math.round(open.of * .5), 'open50'], [open.start + Math.round(open.of * .85), 'open85']], outcome: 'abandoned', seed, open }; }
  }
  throw new Error('no seed opens the foe in 80');
}

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

await fs.mkdir(OUT, { recursive: true });
let text, bands = [], ticks = 0, outcome = 'replayed';
if (RECORD) { text = (await fs.readFile(RECORD, 'utf8')).trim(); }
else { const fight = recordFight(); text = await encodeRecord(fight.rec.finish(fight.outcome === 'abandoned' ? 'abandoned' : 'killed')); bands = fight.bands; ticks = fight.ticks; outcome = fight.outcome; await fs.writeFile(`${OUT}/record.txt`, text); console.log(`${ticks} ticks, ${outcome}; bands [tick, band]:`, JSON.stringify(bands)); }

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  const dir = `${OUT}/frames`; await fs.rm(dir, { recursive: true, force: true }); await fs.mkdir(dir, { recursive: true });
  await page.goto(`${server.origin}/?replay=${text}&debug`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const clock = await harnessClock(page), shots = [];
  // Stills are taken by the page's own sim tick (#debug data-tick), never by frame count, so the BEFORE and AFTER builds show the same tick whatever the load did to the harness.
  const want = new Map(STILLS ? Object.entries(JSON.parse(await fs.readFile(STILLS, 'utf8')).stills).map(([name, t]) => [t, name]) : bands.map(([t, name]) => [t, `${name}-t${t}`]));
  const stills = {}, pageTick = () => page.evaluate(() => Number(document.getElementById('debug')?.dataset.tick ?? 0));
  for (let n = 0, tick = 0; n < (ticks || MAX) * 2 + 240; n++) {
    const shoot = n % EVERY === 0;
    await skipDraws(page, !(shoot || want.has(tick + 1) || want.has(tick + 2)));
    await clock.run(16);
    tick = await pageTick();
    if (shoot) { const file = `${dir}/${String(shots.length).padStart(4, '0')}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 92, animations: 'disabled' }); shots.push(file); }
    if (want.has(tick) && !Object.values(stills).includes(tick)) { const name = want.get(tick); await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 92, animations: 'disabled' }); stills[name] = tick; }
    if (await page.evaluate(() => !!document.getElementById('debug')?.dataset.replay)) break;
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(60 / EVERY), '-i', `${dir}/%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${OUT}/clip.mp4`], { timeout: 600000 });
  await fs.writeFile(`${OUT}/meta.json`, JSON.stringify({ opponent: OPPONENT, level: LEVEL, viewport: '375x812', dpr: DPR, every: EVERY, ticks, outcome, bands, stills, frames: shots.length }, null, 2));
  console.log('wrote', OUT, shots.length, 'frames', JSON.stringify(stills));
} finally { await browser.close(); await server.close(); }
