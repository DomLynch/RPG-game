// Stills of a Zone 1 giant-salamander camp (the salamander-* spawn groups, one creature each) at 375x812: the hero stands 12 m and 6 m south of the creature and faces it. Serves artifacts/origins-preview (built here), the same static server as
// scripts/camp-look-stills.mjs. Env: OUT (artifacts/salamander-camp), DSF (device scale, 2), WHICH (substring of the mob id, default "salamander"), GL=swiftshader on the VPS. Prints each mob found, the hero position after every place() and the header text.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { chromium } from 'playwright';
const OUT = process.env.OUT || 'artifacts/salamander-camp', WHICH = process.env.WHICH || 'salamander'; fs.mkdirSync(OUT, { recursive: true });
const root = process.cwd(), roots = { '/preview/origins/': path.join(root, 'artifacts/origins-preview') + '/' };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots['/' + d + '/'] = root + '/public/' + d + '/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(hit)] || 'application/octet-stream'); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF ?? 2) })).newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const out = { mobs: [], views: [], errors };
try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 600000 });
  out.mobs = await page.evaluate((w) => window.originsPreview.mobs().mobs.filter((m) => String(m.id).includes(w)).map((m) => ({ id: m.id, x: +m.x.toFixed(1), z: +m.z.toFixed(1), drawn: !!m.drawn })), WHICH);
  const m = out.mobs[0]; if (!m) throw Error(`no mob with "${WHICH}" in its id`);
  for (const [name, back] of [['wide', 12], ['near', 6]]) {
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [m.x, m.z - back]);   // south of the creature, facing +z at it
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 300000 });
    out.views.push({ name, hero: await page.evaluate(() => ({ ...window.originsPreview.pos })), header: await page.evaluate(() => document.getElementById('place')?.textContent), prompt: await page.evaluate(() => document.getElementById('prompt')?.textContent) });
  }
} catch (e) { out.fail = String(e).slice(0, 300); }
fs.writeFileSync(`${OUT}/salamander-camp.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
await browser.close(); srv.close(); if (out.fail) process.exit(1);
