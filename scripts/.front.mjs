// usage: node front.mjs <url> <outprefix> [dist=3]  hero placed `dist` m from the nearest goblin, facing it; shots from three sides
import { chromium } from 'playwright';
const [url, out, dist = '3'] = process.argv.slice(2);
const swift = process.env.GL === 'swiftshader';
let target = url;
if (process.env.STATIC) {   // the same static server as scripts/camp-look-stills.mjs: artifacts/origins-preview + public/*; url is the path+query
  const fs = await import('node:fs'), http = await import('node:http'), path = await import('node:path');
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
  target = `http://127.0.0.1:${srv.address().port}${url}`;
}
const browser = await chromium.launch({ headless: true, args: swift ? ['--use-angle=swiftshader', '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 160)));
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => globalThis.originsPreview, null, { timeout: 180000 });
await page.waitForTimeout(swift ? 30000 : 15000);
const pick = () => page.evaluate(() => { const m = globalThis.originsPreview.mobs().mobs.filter((q) => !String(q.id).startsWith('bounty') && q.body === 'goblin' && q.drawn !== false); const p = globalThis.originsPreview.pos; m.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); const g = m[0]; return g ? { id: g.id, x: g.x, z: g.z, loadout: g.loadout, worn: g.worn, h: g.height } : null; });
let t = await pick();
console.log('target', JSON.stringify(t));
if (!t) { await browser.close(); process.exit(2); }
const d = +dist;
for (const [name, ang] of [['a', 0], ['b', 0.8], ['c', -0.8]]) {
  await page.evaluate(([t, d, ang]) => { const o = globalThis.originsPreview; const x = t.x + Math.sin(ang) * d, z = t.z + Math.cos(ang) * d; o.place(x, z, Math.atan2(t.x - x, t.z - z)); }, [t, d, ang]);
  await page.waitForTimeout(swift ? 8000 : 3500);
  await page.screenshot({ path: `${out}-${name}.png` });
  console.log('shot', name, JSON.stringify(await pick()));
}
await browser.close();
