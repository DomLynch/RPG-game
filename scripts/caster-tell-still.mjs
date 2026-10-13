// Stills of the caster tell (Combat #7a, visual-pr-stills): the fight camera at 375 wide, ready idle then the player's spell mid-cast, from the real page with the ?spell=<id> look test, in sparring against the dummy (the look test reaches a Match in sparring only).
//   node scripts/caster-tell-still.mjs --dist dist --spell <spell id> [--out artifacts/combat/caster-tell] [--dpr 2]
// The BEFORE frames come from a trunk build (it has no ?spell hook, so pass --spell none: the page then casts nothing); the AFTER frames from this branch's build.
// Same deterministic clock as special-clip.mjs (scripts/lib/harness-clock.mjs): one 16 ms frame at a time, so a frame number is a sim tick on any machine.
// Writes <out>/ready.jpg, <out>/cast-<frame>.jpg every --every frames through the 120-tick wind-up, mid.jpg (about 70 % of the wind-up), late.jpg (about 92 %, the flashing roll window) and meta.json.
/* global process, console, document, URL */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), SPELL = arg('spell', ''), OUT = arg('out', 'artifacts/combat/caster-tell'), DPR = Number(arg('dpr', 2)), EVERY = Number(arg('every', 6)), WINDUP = 120;
if (!SPELL) throw new Error('--spell <spell id> is required (a row of the spells-*.json files)');

async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  await fs.rm(OUT, { recursive: true, force: true }); await fs.mkdir(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(`${server.origin}/?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none${SPELL === 'none' ? '' : `&spell=${encodeURIComponent(SPELL)}`}&debug`);
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const clock = await harnessClock(page);
  await skipDraws(page, true);
  await page.locator('#attack-button').tap().catch(() => {});   // draw, then stand
  await clock.run(16 * 1230);   // the real first-cast cooldown (RULES.special.first, 1200 ticks) runs out with the draws off; the look test changes no sim state
  await skipDraws(page, false); await clock.run(16 * 6);
  await page.screenshot({ path: `${OUT}/ready.jpg`, type: 'jpeg', quality: 92, animations: 'disabled' });
  await page.locator('#skill-button').tap();
  const shots = [];
  for (let f = 0; f <= WINDUP + 12; f++) {
    if (f % EVERY === 0) { const file = `${OUT}/cast-${String(f).padStart(3, '0')}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 92, animations: 'disabled' }); shots.push({ f, file }); }
    await clock.run(16);
  }
  const near = (frame) => shots.reduce((b, s) => Math.abs(s.f - frame) < Math.abs(b.f - frame) ? s : b);
  await fs.copyFile(near(Math.round(WINDUP * 0.7)).file, `${OUT}/mid.jpg`); await fs.copyFile(near(Math.round(WINDUP * 0.92)).file, `${OUT}/late.jpg`);
  await fs.writeFile(`${OUT}/meta.json`, JSON.stringify({ spell: SPELL, viewport: '375x812', dpr: DPR, frames: shots.length, every: EVERY }, null, 2));
  console.log(`caster-tell stills -> ${OUT} (${shots.length} cast frames)`);
  await context.close();
} finally { await browser.close(); await server.close(); }
