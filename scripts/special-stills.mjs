// Stills of a Special Move for the PR and Dom (visual-pr-stills: the fight camera at 375 wide): ?special=<name> on a built dist, phone
// viewport, the player draws and stands; the opponent casts, and three frames are taken off the page's own __special() stage hook
// (special-look.ts specialStage): mid wind-up, the strike, mid recover. Shared box only (a real browser): run it in a box slot.
//   node scripts/special-stills.mjs --dist dist [--special hades] [--out docs/stills/special-hades] [--arena a]
// --arena a: the Night Pit (arena-themes.ts, ?arena=a), the dark floor an effect must also read on; default the day arena.
// --clip: record the page instead (Playwright recordVideo) and cut a few seconds round the cast to an mp4 (webm when ffmpeg is missing): <out>/<special>.mp4.
// --sheet <dir> <dir>...: no browser; lay each dir's windup | strike | recover stills side by side, one row per dir, into <out>/sheet.png (needs ffmpeg).
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), SPECIAL = arg('special', 'hades'), ARENA = arg('arena', ''), CLIP = process.argv.includes('--clip');
const OUT = arg('out', `docs/stills/special-${SPECIAL}`), run = async (cmd, args) => new Promise((ok, no) => (async () => { const { execFile } = await import('node:child_process'); execFile(cmd, args, (e, so, se) => (e ? no(new Error(`${cmd} ${args.join(' ')}: ${se}`)) : ok(so))); })());
if (process.argv.includes('--sheet')) {   // rows of three: wind-up | strike | recover, one row per directory
  const dirs = process.argv.slice(process.argv.indexOf('--sheet') + 1).filter((a) => !a.startsWith('--') && a !== OUT);
  await fs.mkdir(OUT, { recursive: true });
  const rows = [];
  for (const [i, d] of dirs.entries()) { const row = `${OUT}/row${i}.png`; await run('ffmpeg', ['-y', '-i', `${d}/windup.png`, '-i', `${d}/strike.png`, '-i', `${d}/recover.png`, '-filter_complex', 'hstack=inputs=3', row]); rows.push(row); }
  if (rows.length === 1) await fs.copyFile(rows[0], `${OUT}/sheet.png`); else await run('ffmpeg', ['-y', ...rows.flatMap((r) => ['-i', r]), '-filter_complex', `vstack=inputs=${rows.length}`, `${OUT}/sheet.png`]);
  await Promise.all(rows.map((r) => fs.rm(r))); console.log(`${OUT}/sheet.png`); process.exit(0);
}

async function serveDist(dir) {   // scripts/rank-look-check.mjs's static server: gzip, no-store, SPA fallback
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

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const shots = [];
try {
  await fs.mkdir(OUT, { recursive: true });
  const t0 = Date.now(), context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: CLIP ? 2 : 3, ...(CLIP ? { recordVideo: { dir: `${OUT}/video`, size: { width: 750, height: 1624 } } } : {}) });
  const page = await context.newPage();
  await page.goto(`${server.origin}/?special=${SPECIAL}&debug${ARENA ? `&arena=${ARENA}` : ''}${process.env.LOOK ? `&look=${process.env.LOOK}` : ''}`);
  await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 120000, polling: 100 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  await page.locator('#attack-button').tap().catch(() => {});   // draw, then stand: the opponent closes and casts
  if (CLIP) {   // from 0.4 into the wind-up to the end of the recover and a beat more; the wall clock of the page against the video's start trims it
    let from = 0, to = 0;
    for (let polls = 0; polls < 3000 && !to; polls++) {
      const { stages } = await page.evaluate(() => globalThis.__special()), caster = stages[1] ?? stages[0];
      if (!from && caster?.stage === 'windup' && caster.progress >= 0.4) from = Date.now();
      else if (from && caster?.stage === 'recover' && caster.progress >= 0.9) to = Date.now();
      else await page.waitForTimeout(20);
    }
    if (!to) throw new Error('no full cast within 60 s (did the fight end first?)');
    await page.waitForTimeout(900);
    const video = page.video(); await context.close(); const webm = await video.path(), ss = Math.max(0, (from - t0) / 1000 - 0.35), len = (to - from) / 1000 + 0.35 + 1.0;
    const mp4 = `${OUT}/${SPECIAL}${ARENA ? `-${ARENA}` : ''}.mp4`;
    try { await run('ffmpeg', ['-y', '-ss', ss.toFixed(2), '-t', len.toFixed(2), '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-an', mp4]); console.log(`clip ${mp4} (${len.toFixed(1)} s from ${ss.toFixed(1)} s)`); }
    catch (e) { const out = mp4.replace(/\.mp4$/, '.webm'); await fs.copyFile(webm, out); console.log(`ffmpeg unavailable (${e.message.slice(0, 80)}): ${out} (webm)`); }
    await fs.rm(`${OUT}/video`, { recursive: true, force: true });
    process.exit(0);   // finally below still closes the browser and server
  }
  const want = [['windup', (s) => s.stage === 'windup' && s.progress >= 0.8], ['strike', (s) => s.stage === 'recover' && s.progress < 0.1], ['recover', (s) => s.stage === 'recover' && s.progress >= 0.5]];
  for (let polls = 0; polls < 3000 && want.length; polls++) {   // ~60 s at the 20 ms poll
    const { tick, stages } = await page.evaluate(() => globalThis.__special());
    const caster = stages[1] ?? stages[0];
    if (caster && want[0][1](caster)) {
      const [name] = want.shift(), file = `${OUT}/${name}.png`;
      await page.screenshot({ path: file, animations: 'disabled' });
      shots.push({ name, file, tick, stage: caster });
      console.log(`${name}: tick ${tick} ${caster.stage} ${caster.progress.toFixed(2)} -> ${file}`);
    } else await page.waitForTimeout(20);
  }
  if (want.length) throw new Error(`no ${want.map(([n]) => n).join(', ')} frame within 60 s (did the fight end first?)`);
} finally {
  await fs.writeFile(`${OUT}/stills.json`, JSON.stringify(shots, null, 2)).catch(() => {});
  await browser.close(); await server.close();
}
