// Shrine camp stills at 375x812 (PR 3406): BUILD=<dir of a built origins preview> OUT=<dir>. Serves the build at /preview/origins/ plus public/* like salamander-camp-stills.mjs, loads ?region=1&presence=0
// (place() with presence on snaps the hero to the Pit), then shoots the hero 12 m and 6 m south of salamander-shrine-1 and 6 m south of the Hrungnir bounty spot, and prints both creatures' positions.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { chromium } from 'playwright';
const OUT = process.env.OUT || 'artifacts/shrine-stills', BUILD = path.resolve(process.env.BUILD || 'artifacts/origins-preview'); fs.mkdirSync(OUT, { recursive: true });
const root = process.cwd(), roots = { '/preview/origins/': BUILD + '/' };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts', 'kit', 'ranged', 'img']) roots['/' + d + '/'] = root + '/public/' + d + '/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(hit)] || 'application/octet-stream'); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF ?? 2) })).newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const out = { views: [], errors };
try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/preview/origins/?region=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 600000 });
  const mob = (id) => page.evaluate((i) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === i); return m ? { x: +m.x.toFixed(1), z: +m.z.toFixed(1) } : null; }, id);
  out.salamander = await mob('salamander-shrine-1'); out.hrungnir = await mob('bounty-shrine-1');
  if (!out.salamander || !out.hrungnir) throw Error('creature missing');
  out.distance = +Math.hypot(out.salamander.x - out.hrungnir.x, out.salamander.z - out.hrungnir.z).toFixed(1);
  for (const [name, m, back] of [['salamander-wide', out.salamander, 12], ['salamander-near', out.salamander, 6], ['hrungnir-near', out.hrungnir, 6]]) {
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [m.x, m.z - back]);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 300000 });
    out.views.push({ name, hero: await page.evaluate(() => ({ ...window.originsPreview.pos })), header: await page.evaluate(() => document.getElementById('place')?.textContent) });
  }
} catch (e) { out.fail = String(e).slice(0, 300); }
fs.writeFileSync(`${OUT}/shrine-stills.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
await browser.close(); srv.close(); if (out.fail) process.exit(1);
