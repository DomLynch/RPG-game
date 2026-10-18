// Goblin strafe-and-roll: the drawn body's angular rate around the hero, and the 375-wide clip (Combat, Lead 2026-10-18: "your 375 strafe/roll clip per view, drawn-body turn rate at or below the Test Zone's 95/65/20 deg/s").
// The hero strafes (A / D held in turn) and rolls (the dodge button while a direction is held) around the goblin for --seconds, on the HARNESS clock (scripts/lib/harness-clock.mjs): a fixed 16/17 ms step, so the number is the same on any machine,
// the VPS included. Each step reads the hero and the goblin from the page and puts the goblin where it is DRAWN with the engine's own stand-back functions (src/fight/stand-back.ts, the ones scene.ts and mobs-view.ts call, eased at the step's dt),
// then takes the angle of (drawn goblin - hero) and its change per second. Prints max / p95 / avg deg/s (the Test Zone's triplet reads in that order: 95/65/20; Zone 1 is 89/60/15).
// The pictures are Mac-GPU work: --shots writes a jpg per step and encodes clip.mp4 (ffmpeg); without it the run only measures (valid headless).
//   node scripts/goblin-strafe-clip.mjs --view pit|field --dist <dist> --out <dir> [--seconds 6] [--shots]
//   pit:   the Pit build (npm run build -> dist), ?opponent=goblin&spar=1 at the fit stills' L5 look.
//   field: the origins-preview build (npx vite build --config origins/preview/vite.config.mjs --outDir artifacts/origins-preview), Zone 1 (?region=1), the nearest goblin.
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { beastRenderScale } from '../src/fight/beast-scale.ts';
import { builtScale, easeStandBack, standBackWant } from '../src/fight/stand-back.ts';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const VIEW = opt('view', 'pit'), DIST = opt('dist'), OUT = opt('out'), SECONDS = Number(opt('seconds', '6')), SHOTS = argv.includes('--shots');
if (!DIST || !OUT || !['pit', 'field'].includes(VIEW)) { console.error('usage: node scripts/goblin-strafe-clip.mjs --view pit|field --dist <dist> --out <dir> [--seconds 6] [--shots]'); process.exit(2); }
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

const root = process.cwd(), mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
const roots = VIEW === 'pit' ? { '/': `${path.resolve(DIST)}/` } : { '/preview/origins/': `${path.resolve(DIST)}/` };
if (VIEW === 'field') for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null, best = -1;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p) && p.length > best) { hit = path.join(r, u.slice(p.length) || 'index.html'); best = p.length; }
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const glArgs = process.env.SWIFTSHADER ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--ignore-gpu-blocklist', '--use-angle=metal'];
const browser = await chromium.launch({ headless: true, args: glArgs });
const receipt = { view: VIEW, dist: DIST, seconds: SECONDS, shots: SHOTS, steps: 0, errors: [], note: 'drawn position = sim position + eased stand-back from src/fight/stand-back.ts at the step dt' };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  let read;   // () => { hero: {x,z}, foe: {x,z} } from the page
  if (VIEW === 'pit') {
    await page.goto(`${origin}/?opponent=goblin&spar=1&weapon=longsword&difficulty=5&skill=none&yourSpecial=none&special=none&debug`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
    read = () => page.evaluate(() => { const f = globalThis.__special().fighters; return { hero: { x: f[0].x, z: f[0].z }, foe: { x: f[1].x, z: f[1].z } }; });
  } else {
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.body === 'goblin'), null, { timeout: 180000 });
    const den = await page.evaluate(() => { const m = window.originsPreview.mobs().mobs.find((q) => q.body === 'goblin'); return { x: m.x, z: m.z }; });
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 14, 0), [den.x, den.z]);
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model && m.body === 'goblin'), null, { timeout: 300000 });
    await page.waitForTimeout(3000);
    const target = await page.evaluate(() => { const m = window.originsPreview.mobs().mobs.find((q) => q.drawn && q.model && q.body === 'goblin'); return { id: m.id, x: m.x, z: m.z }; });
    receipt.target = target;
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 5, 0), [target.x, target.z]);
    read = () => page.evaluate((id) => { const m = window.originsPreview.mobs().mobs.find((q) => q.id === id), p = window.originsPreview.pos; return { hero: { x: p.x, z: p.z }, foe: { x: m.x, z: m.z } }; }, target.id);
  }
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const { run } = await harnessClock(page);
  if (VIEW === 'field') await page.evaluate((id) => window.originsPreview.tapMob(id), receipt.target.id);   // engage through the real tap path
  else await page.locator('#attack-button').tap({ force: true, timeout: 3000 }).catch(() => {});   // the first tap draws the sword
  if (!SHOTS) await skipDraws(page, true);

  // The drawn goblin: the engine's own stand-back, eased at each step's dt, started at its first want (what scene.ts / mobs-view.ts do).
  const drawn = beastRenderScale('goblin'), built = builtScale('goblin', drawn), off = { x: 0, z: 0 };
  const total = Math.round(SECONDS * 60), sweep = [], held = { key: null }, key = async (k, down) => { await page.keyboard[down ? 'down' : 'up'](k); };
  let prevAngle = null, prevSim = null, seeded = false, roll = 0; const simSweep = [], gaps = []; let offMax = 0;
  for (let n = 0; n < total; n++) {
    const phase = Math.floor(n / 60) % 2 === 0 ? 'KeyA' : 'KeyD';   // strafe one way for a second, then the other
    if (held.key !== phase) { if (held.key) await key(held.key, false); await key(phase, true); held.key = phase; }
    if (n % 90 === 45) await page.locator('#dodge-button').tap({ force: true, timeout: 2000 }).then(() => { roll++; }).catch(() => {});   // a roll with the direction held
    const dt = (n % 3 === 2 ? 16 : 17) / 1000;
    await run(dt * 1000);
    const { hero, foe } = await read();
    const want = standBackWant(foe.x, foe.z, hero.x, hero.z, 'goblin', drawn, built);
    if (!seeded) { off.x = want.x; off.z = want.z; seeded = true; }
    easeStandBack(off, want, dt);
    const angle = Math.atan2(foe.x + off.x - hero.x, foe.z + off.z - hero.z);
    if (prevAngle !== null && n >= 30) sweep.push(Math.abs(wrap(angle - prevAngle)) * 180 / Math.PI / dt);   // the first half-second is the settle
    const simAngle = Math.atan2(foe.x - hero.x, foe.z - hero.z);   // the same sweep with no stand-back: what the sim alone does, so the stand-back's share is the difference
    if (prevSim !== null && n >= 30) simSweep.push(Math.abs(wrap(simAngle - prevSim)) * 180 / Math.PI / dt);
    prevSim = simAngle; prevAngle = angle; offMax = Math.max(offMax, Math.hypot(off.x, off.z)); if (n >= 30) gaps.push(Math.hypot(foe.x - hero.x, foe.z - hero.z));
    if (SHOTS) { await skipDraws(page, false); await page.screenshot({ path: path.join(OUT, `f${String(n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 }); }
  }
  if (held.key) await key(held.key, false);
  const stat = (a) => { const s = [...a].sort((x, y) => x - y), pick = (q) => s[Math.floor(q * (s.length - 1))] ?? 0; return { max: +(s[s.length - 1] ?? 0).toFixed(1), p95: +pick(0.95).toFixed(1), avg: +(s.reduce((t, x) => t + x, 0) / Math.max(1, s.length)).toFixed(1) }; };
  const s = sweep;
  Object.assign(receipt, { steps: total, rolls: roll, drawnScale: drawn, builtScale: built, sweepDegPerS: stat(sweep), simOnlySweepDegPerS: stat(simSweep), standBackMaxM: +offMax.toFixed(3), simGapM: { min: +Math.min(...gaps).toFixed(2), max: +Math.max(...gaps).toFixed(2) } });
  fs.writeFileSync(path.join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 1));
  if (SHOTS) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', path.join(OUT, 'f%05d.jpg'), '-vf', 'scale=376:812,setsar=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(OUT, 'clip.mp4')], { timeout: 600_000 });
  console.log(`${VIEW}: drawn-body sweep max/p95/avg ${receipt.sweepDegPerS.max}/${receipt.sweepDegPerS.p95}/${receipt.sweepDegPerS.avg} deg/s (sim alone ${receipt.simOnlySweepDegPerS.max}/${receipt.simOnlySweepDegPerS.p95}/${receipt.simOnlySweepDegPerS.avg}), stand-back up to ${receipt.standBackMaxM} m at sim gap ${receipt.simGapM.min}-${receipt.simGapM.max} m, over ${s.length} steps, ${roll} rolls, errors ${receipt.errors.length}`);
} finally { await browser.close(); server.close(); }
