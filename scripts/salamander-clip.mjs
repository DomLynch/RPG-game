// Frame-stepped 375-wide clip of a world creature closing, stopping at its reach and fighting (Combat, 2026-10-17; Strategy's gate for the creature-motion rows, #3056: "a 375-wide salamander clip made on the Mac").
// The Zone 5 giant salamander (hollow-den) on the built origins-preview page (?region=1&worldfight&zone=5); the hero is placed 7 m south of it and stands; the page clock is faked and moved 1000/60 ms per frame with a
// screenshot per frame (scripts/lib/harness-clock.mjs, the vstep method), so the mp4 plays the fight at real speed however slow the renderer is. Software GL is fine on a Mac with the GPU busy; the Mac's own GL is the default.
// Usage: node scripts/salamander-clip.mjs <built origins-preview dist> <out dir> [--seconds 14] [--kind giant-salamander] [--zone 5] [--place 7]
//   build first: npx vite build --config origins/preview/vite.config.mjs --outDir artifacts/origins-preview
//   encode:      ffmpeg -framerate 60 -i <out>/f%05d.jpg -vf scale=376:812,setsar=1 -c:v libx264 -pix_fmt yuv420p -crf 20 <out>/clip.mp4
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { harnessClock } from './lib/harness-clock.mjs';

const args = process.argv.slice(2), opt = (name, d) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : d; };
const [dist, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const SECONDS = Number(opt('seconds', '14')), KIND = opt('kind', 'giant-salamander'), ZONE = opt('zone', '5'), PLACE = Number(opt('place', '7'));
if (!dist || !out) { console.error('usage: node scripts/salamander-clip.mjs <built origins-preview dist> <out dir> [--seconds 14] [--kind giant-salamander] [--zone 5] [--place 7]'); process.exit(2); }
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const roots = { '/preview/origins/': `${path.resolve(dist)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const glArgs = process.env.PIT_GL === '0' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];   // software GL by default (a headless Chromium on the Mac paints no 3D scene without it, like the stills scripts); PIT_GL=0: the Mac's own GL
const browser = await chromium.launch({ args: glArgs });
const receipt = { dist, kind: KIND, zone: ZONE, seconds: SECONDS, frames: 0, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=${ZONE}`, { waitUntil: 'load' });
  // the creature is placed in the zone but only DRAWN near the hero (Zone 5's spawn is ~80 m from the den): find it, walk the hero to 14 m from it, then wait for it to be drawn with its model
  await page.waitForFunction((kind) => window.originsPreview?.mobs()?.mobs?.some((m) => m.body === kind), KIND, { timeout: 180000 });
  const den = await page.evaluate((kind) => { const m = window.originsPreview.mobs().mobs.find((q) => q.body === kind); return { x: m.x, z: m.z }; }, KIND);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 14, 0), [den.x, den.z]);
  await page.waitForFunction((kind) => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model && m.body === kind), KIND, { timeout: 300000 });
  await page.waitForTimeout(3000);
  const target = await page.evaluate((kind) => { const m = window.originsPreview.mobs().mobs.find((q) => q.drawn && q.model && q.body === kind); return { id: m.id, x: m.x, z: m.z, name: m.name }; }, KIND);
  receipt.target = target;
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  await page.evaluate(([x, z, d]) => window.originsPreview.place(x, z - d, 0), [target.x, target.z, PLACE]);   // 7 m south of it, facing it
  const { run } = await harnessClock(page);
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);   // engage through the real tap path so the creature closes, stops at its reach and fights in frame
  const total = Math.round(SECONDS * 60), log = [];
  for (let n = 0; n < total; n++) {
    await run(n % 3 === 2 ? 16 : 17);
    await page.screenshot({ path: path.join(out, `f${String(n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 });
    if (n % 30 === 0) log.push(await page.evaluate((id) => { const m = window.originsPreview.mobs().mobs.find((q) => q.id === id), p = window.originsPreview.pos; return m ? { mode: m.mode, gap: +Math.hypot(m.x - p.x, m.z - p.z).toFixed(2), infight: document.body.classList.contains('infight') } : null; }, target.id));
  }
  receipt.frames = total; receipt.timeline = log;
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', path.join(out, 'f%05d.jpg'), '-vf', 'scale=376:812,setsar=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', path.join(out, 'clip.mp4')], { timeout: 600_000 });
  console.log(`clip: ${path.join(out, 'clip.mp4')} (${total} frames, ${SECONDS} s); errors ${receipt.errors.length}`);
  console.log('timeline (every 0.5 s):', JSON.stringify(log));
} finally { await browser.close(); server.close(); }
