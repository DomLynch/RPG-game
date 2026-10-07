// A 375 clip and one still per band for the fatigue look (Lead's brief B; visual-pr-stills: the fight camera at 375 wide). One seeded fight where a hero
// spams heavies until he is gassed, rests behind his guard until the second wind, then goes again: fresh -> winded -> tired -> gassed -> recovered, replayed
// from its record on a built dist one 16 ms frame at a time (scripts/lib/harness-clock.mjs). The record fixes every tick, so a BEFORE build and an AFTER build
// show the same fight; pass --record <file> to replay the record a first run wrote. Runs on the VPS through `capture` (SwiftShader, no GPU).
//   node scripts/fatigue-clip.mjs --dist dist --out artifacts/fatigue [--record file] [--opponent veteran] [--level 3] [--every 3] [--dpr 2] [--side 0]
// Stills are keyed by sim tick (meta.json `stills`: name -> tick). Writes <out>/clip.mp4, <out>/<band>.jpg for the first tick of each band the hero reaches (+ --after ticks, default 40, so the blend has settled), <out>/record.txt and <out>/meta.json.
/* global process, console, document, URL, window */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { OPPONENTS, initialPractice, stepPractice } from '../src/combat.ts';
import { idleIntent, legal } from '../src/duel.ts';
import { opponentAt, profileAt } from '../src/moves.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/fatigue'), EVERY = Number(arg('every', 3)), DPR = Number(arg('dpr', 2)), AFTER = Number(arg('after', 40));
const STILLS = arg('stills', '');   // a meta.json from the AFTER run: take the same frames in a BEFORE replay
const OPPONENT = arg('opponent', 'veteran'), LEVEL = Number(arg('level', 3)), RECORD = arg('record', ''), MAX = Number(arg('max', 2400));

// The gasper: heavies whenever legal; once exhausted he guards and waits for his stamina, then starts again.
function bot(p) {
  const me = p.duel.fighters[0], intent = idleIntent();
  if (me.phase === 'sheathed') return { ...intent, action: 'light' };
  if (me.exhausted || (me.stamina < 55 && resting)) { resting = me.stamina < 70; return { ...intent, guard: true }; }
  resting = false;
  if (legal(me, 'heavy')) return { ...intent, action: 'heavy', lock: true };
  return me.phase === 'ready' ? { ...intent, move: { x: 0, z: 1, yaw: 0, run: true }, lock: false } : intent;   // too tired to swing: sprint it down to nothing, which is what gasses a man
}
let resting = false;

function recordFight() {
  const profile = profileAt(OPPONENTS[OPPONENT], LEVEL), rec = createRecorder({ build: 'fatigue', opponent: OPPONENT, weapon: 'longsword', level: LEVEL, seed: 7 });
  let p = initialPractice(7, opponentAt(OPPONENTS[OPPONENT], LEVEL), 'longsword'), t = 0;
  const bands = [];   // [tick, band]
  for (; t < MAX && !p.finish; t++) {
    p = stepPractice(p, rec.push(bot(p)), profile);
    const b = p.fatigue[0].band; if (!bands.length || bands[bands.length - 1][1] !== b) bands.push([t, b]);
  }
  return { text: null, rec, ticks: t, bands, outcome: p.finish ? (p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned' };
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
  const want = new Map(STILLS ? Object.entries(JSON.parse(await fs.readFile(STILLS, 'utf8')).stills).map(([name, t]) => [t, name]) : bands.map(([t, b]) => [t + AFTER, `band${b}-t${t}`]));
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
