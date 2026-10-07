// Fresh vs gassed, both in ready idle, at the fight camera (375x812) from behind the hero: the evidence for `?look=fatigue-read` (src/fatigue-read.ts).
// A passive dummy (spar), the hero draws, stands fresh until frame 150, spams heavies until 480, then stands while the sim says `ready`. Frame-stepped on the
// harness clock, so the same frame is the same sim tick with the flag on or off. Two-pass: run WITHOUT --look to find the frames and write <out>/frames.json,
// then with --look fatigue-read --frames <that file> to shoot the same two frames (plus the clip window); both write fresh.jpg, gassed.jpg and a 2-up.
//   node scripts/fatigue-read-2up.mjs --dist dist --out artifacts/fread/off
//   node scripts/fatigue-read-2up.mjs --dist dist --out artifacts/fread/on --look fatigue-read --frames artifacts/fread/off/frames.json [--clip]
// --clip also films frames 60..480 (every 3rd at 60 fps stepping = 20 fps playback, 6 s): the fresh -> gassed run, as <out>/clip.mp4.
/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const DIST = arg('dist', 'dist'), OUT = arg('out', 'artifacts/fread'), LOOK = arg('look', ''), FRAMES = arg('frames', ''), CLIP = process.argv.includes('--clip'), DPR = Number(arg('dpr', 2));
const QUERY = `?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none&yourSpecial=none&special=none&debug${LOOK ? `&look=${LOOK}` : ''}`;
const tap = (f) => f === 0 ? '#attack-button' : (f >= 150 && f < 480 && (f - 150) % 24 === 0) ? '#heavy-button' : null;

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

await fs.mkdir(`${OUT}/clip`, { recursive: true });
const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message)); page.on('crash', () => console.log('PAGE CRASH'));
  await page.goto(`${server.origin}/${QUERY}`);
  await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 240000, polling: 200 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  const clock = await harnessClock(page), want = FRAMES ? JSON.parse(await fs.readFile(FRAMES, 'utf8')) : null, log = [], clipFiles = [];
  const look = await page.evaluate(() => location.search); console.log('page query', look);
  let fresh = want?.fresh, gassed = want?.gassed;
  for (let f = 0; f < 760; f++) {
    const t = tap(f); if (t) await page.locator(t).tap({ force: true, timeout: 3000 }).catch((e) => console.log('tap failed', t, f, e.message.slice(0, 120)));
    const inClip = CLIP && f >= 60 && f <= 480 && (f - 60) % 3 === 0;
    await skipDraws(page, !(inClip || f === fresh || f === gassed || (!want && ((f >= 137 && f < 150) || (f >= 488 && !gassed)))));   // draw only the frames that are shot (the finding pass: only the frames it may pick)
    await clock.run(16).catch((e) => { console.log('run failed f', f, e.message.slice(0, 160)); throw e; });
    const st = await page.evaluate(() => ({ phase: globalThis.__special().fighters[0].phase, stamina: Number(document.getElementById('stamina')?.value ?? NaN) }));
    log.push({ f, phase: st.phase, stamina: +st.stamina.toFixed(1) });
    if (!want) {
      if (!fresh && f >= 140 && f < 150 && st.phase === 'ready') fresh = f;
      if (!gassed && f >= 490 && st.phase === 'ready' && st.stamina < 20 && f % 2 === 0) gassed = f;
    }
    const hit = f === fresh || f === gassed;
    if (hit) await page.screenshot({ path: `${OUT}/${f === fresh ? 'fresh' : 'gassed'}.jpg`, type: 'jpeg', quality: 90, timeout: 180000 });
    if (inClip) { const file = `${OUT}/clip/${String(clipFiles.length).padStart(4, '0')}.jpg`; await page.screenshot({ path: file, type: 'jpeg', quality: 88, timeout: 180000 }); clipFiles.push(file); }
    if (fresh && gassed && !CLIP && f > Math.max(fresh, gassed)) break;
    if (fresh && gassed && CLIP && f > Math.max(480, fresh, gassed)) break;
  }
  await fs.writeFile(`${OUT}/frames.json`, JSON.stringify({ fresh, gassed })); await fs.writeFile(`${OUT}/log.json`, JSON.stringify(log));
  console.log('frames', JSON.stringify({ fresh, gassed }), 'stamina', JSON.stringify([log[fresh]?.stamina, log[gassed]?.stamina]), 'phase', JSON.stringify([log[fresh]?.phase, log[gassed]?.phase]));
  if (fresh && gassed) {
    const crop = `crop=${560 * DPR / 2}:${820 * DPR / 2}:${100 * DPR / 2}:${320 * DPR / 2}`;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/fresh.jpg`, '-i', `${OUT}/gassed.jpg`, '-filter_complex', `[0]${crop}[a];[1]${crop}[b];[a][b]hstack`, `${OUT}/2up.png`], { timeout: 120000 });
  }
  if (CLIP && clipFiles.length) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '20', '-i', `${OUT}/clip/%04d.jpg`, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${OUT}/clip.mp4`], { timeout: 600000 });
} finally { await browser.close(); await server.close(); }
