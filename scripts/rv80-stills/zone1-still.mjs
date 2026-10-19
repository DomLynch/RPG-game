// Zone 1 at 375x812: does the one-button pad (layout A, the STRIKE wheel) show on the walk screen? Serves the built origins preview exactly as scripts/origins-zone1-smoke.mjs does, waits for a drawn creature,
// reports the layout markers (#touch-zones, which buttons are visible, STRIKE's size and position) and takes a still. Run from a repo root that has artifacts/origins-preview (vite build --config origins/preview/vite.config.mjs).
/* global process, console, document, getComputedStyle */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), OUT = process.argv[2] ?? 'out', TAG = process.argv[3] ?? 'zone1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(process.env.LIVE_URL ?? `${origin}/preview/origins/?region=1`, { waitUntil: 'load', timeout: 240000 });   // LIVE_URL: the "before" still, straight from frankendom.com
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 }).catch((e) => errors.push(`no drawn creature: ${String(e).slice(0, 120)}`));
  await page.waitForTimeout(3000);
  const probe = () => page.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); if (!e) return null; const s = getComputedStyle(e), r = e.getBoundingClientRect(); return { display: s.display, hidden: e.hidden, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    return { touchZones: !!document.getElementById('touch-zones'), touchLayoutStyle: !!document.getElementById('touch-layout-style'), attack: vis('attack-button'), skill: vis('skill-button'), skill2: vis('skill2-button'), guard: vis('guard-button'), dodge: vis('dodge-button'), kick: vis('kick-button'), heavy: vis('heavy-button'), thrust: vis('thrust-button'), stance: vis('stance-panel') };
  });
  const walk = await probe();
  await page.screenshot({ path: `${OUT}/${TAG}-walk.jpg`, type: 'jpeg', quality: 88 });
  // Engage the nearest drawn creature with the real tap path, as the smoke does, then probe again mid-fight.
  const target = await page.evaluate(() => window.originsPreview.mobs().mobs.find((m) => m.drawn && m.body)).catch(() => null);
  let fight = null;
  if (target) {
    try {
      const box = await page.locator('#attack-button').boundingBox();
      for (let i = 0; i < 3; i++) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(500); }
      fight = await probe();
      await page.screenshot({ path: `${OUT}/${TAG}-after-strike.jpg`, type: 'jpeg', quality: 88 });
    } catch (e) { errors.push(`strike: ${String(e).slice(0, 120)}`); }
  }
  const result = { tag: TAG, origin, walk, fight, errors };
  fs.writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(result, null, 1)); console.log(JSON.stringify(result));
} finally { await browser.close(); server.close(); }
