// Framing-matched stills of the kit's far bodies: for each of the nearest goblin_hut and goblin_totem, the hero stands NEAR (a few metres, full mesh in both arms) and FAR (beyond the lod distance), looking at it, at 375x812, with the swap on (default) and off (?kitlod=0).
// The positions are read from the instanced mesh itself (a first load with every radius at 0 keeps all instance matrices), so both arms shoot the very same spot.
//   node scripts/kit-lod-stills.mjs <built origins-preview dist> <out dir> [--near 12] [--far 55]
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const argv = process.argv.slice(2), dist = argv[0], out = argv[1], opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? Number(argv[i + 1]) : d; };
if (!dist || !out) throw new Error('usage: kit-lod-stills.mjs <dist> <out dir> [--near 12] [--far 55]');
const NEAR = opt('near', 12), FAR = opt('far', 55), NODES = ['goblin_hut', 'goblin_totem'];
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const root = process.cwd(), roots = [['/preview/origins/', `${path.resolve(dist)}/`]];
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
  if (!hit) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function open(query) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage(); page.setDefaultTimeout(240000);
  await page.addInitScript(() => { const seen = { scenes: [] }; window.__seen = seen; const bus = new EventTarget(); window.__THREE_DEVTOOLS__ = bus; bus.addEventListener('observe', (e) => { if (e.detail?.isScene) seen.scenes.push(e.detail); }); });
  await page.goto(`${base}/preview/origins/?region=1&zone=1&presence=0&crowd=0${query}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => !!window.originsPreview, null, { polling: 200 });
  await page.waitForFunction(() => window.originsPreview?.settledAt?.() >= 0 || !!window.__zoneReady, null, { polling: 200 }).catch(() => {});
  await page.waitForTimeout(3000);
  return { ctx, page };
}
// 1. positions: every instance of the nodes, from a load where nothing is packed (all radii 0, swap off).
const probe = await open('&kitlod=0&kitdraw=0&kitshadow=0');
const spots = await probe.page.evaluate((nodes) => {
  const hero = window.originsPreview.pos, out = {};
  for (const scene of window.__seen.scenes) scene.traverse((o) => {
    if (!o.isInstancedMesh || !nodes.includes(o.name)) return;
    const pts = []; for (let i = 0; i < o.count; i++) pts.push([o.instanceMatrix.array[i * 16 + 12], o.instanceMatrix.array[i * 16 + 14]]);
    out[o.name] = pts.sort((a, b) => Math.hypot(a[0] - hero.x, a[1] - hero.z) - Math.hypot(b[0] - hero.x, b[1] - hero.z));
  });
  return out;
}, NODES);
await probe.ctx.close();
fs.writeFileSync(path.join(out, 'spots.json'), JSON.stringify(spots));
// 2. the shots: same positions in both arms.
const receipt = { near: NEAR, far: FAR, spots: Object.fromEntries(Object.entries(spots).map(([k, v]) => [k, v[0]])), shots: [] };
for (const [arm, query] of [['lod-on', ''], ['lod-off', '&kitlod=0']]) {
  const { ctx, page } = await open(query);
  for (const node of NODES) {
    const target = spots[node]?.[0]; if (!target) { receipt.shots.push({ arm, node, error: 'no instance' }); continue; }
    for (const [dist, label] of [[NEAR, 'near'], [FAR, 'far']]) {
      const x = target[0] + dist, z = target[1] - dist * 0.4, yaw = Math.atan2(target[0] - x, target[1] - z);   // from the east-south of it, looking at it
      await page.evaluate(([px, pz, yw]) => window.originsPreview.place(px, pz, yw), [x, z, yaw]);
      await page.waitForTimeout(3500);
      const file = `${node}-${label}-${arm}.png`; await page.screenshot({ path: path.join(out, file) });
      receipt.shots.push({ arm, node, label, at: [Math.round(x), Math.round(z)], file });
    }
  }
  await ctx.close();
}
fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 1));
console.log('KIT-LOD-STILLS', JSON.stringify(receipt.shots.map((s) => s.file ?? s.error)));
await browser.close(); await new Promise((r) => server.close(r));
