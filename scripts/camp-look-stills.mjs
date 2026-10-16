// Stills of the Cinder Fields goblin camp and the rusty sword lying in it, at 375x812, for Dom's call on the camp look (the camp is the landmark_camp of zone1-kit.glb with the four-scavenger group; the sword
// is the ground row ground:zone1.rusty-sword-1, today at the centre of the place with no offset). Views: wide from the road side (14 m south of the sword, facing it), mid (7 m), close (3 m), and a side
// view. Serves artifacts/origins-preview (built here); on the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/camp-look-stills.sh   Env: OUT (default artifacts/camp-look), SWORD_X/SWORD_Z (-102, 30).
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { chromium } from 'playwright';
const OUT = process.env.OUT || 'artifacts/camp-look', SX = +(process.env.SWORD_X ?? -102), SZ = +(process.env.SWORD_Z ?? 30); fs.mkdirSync(OUT, { recursive: true });
const root = process.cwd(), roots = { '/preview/origins/': path.join(root, 'artifacts/origins-preview') + '/' };   // the same static server as scripts/origins-crowd-fps.mjs
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots['/' + d + '/'] = root + '/public/' + d + '/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(hit)] || 'application/octet-stream'); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const H = Math.atan2(SX - -72.6, SZ - 62.9);   // looking from the spawn (-72.6, 62.9) at the sword: forward is (sin h, cos h)
const views = [['spawn', null], ['wide', 16], ['mid', 8], ['close', 3]];   // name, metres short of the sword on the line from the spawn (spawn = the first view, no placement)
const out = { sword: [SX, SZ], views: [], errors };
try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  out.swordAnchor = await page.waitForFunction(() => window.originsPreview.ground?.anchor('ground:zone1.rusty-sword-1') ?? null, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);   // the drawn sword's centre, or null if the page never drew it
  for (const [name, back] of views) {
    if (back !== null) await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), [SX - Math.sin(H) * back, SZ - Math.cos(H) * back, H]);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/camp-${name}.png` });
    out.views.push({ name, hero: await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z })), mobs: await page.evaluate(([sx, sz]) => window.originsPreview.mobs().mobs.filter((m) => m.drawn).map((m) => ({ id: m.id, x: +m.x.toFixed(1), z: +m.z.toFixed(1) })).filter((m) => Math.hypot(m.x - sx, m.z - sz) < 25), [SX, SZ]) });
  }
} catch (e) { out.fail = String(e).slice(0, 300); }
fs.writeFileSync(`${OUT}/camp-look.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out).slice(0, 800));
await browser.close(); srv.close(); if (out.fail) process.exit(1);
