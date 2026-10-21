// probe: wait long near scavengers-1, dump mesh info, shots over time
import { chromium } from 'playwright';
const out = process.argv[2];
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
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
page.on('console', (m) => { if (/warn|error/i.test(m.type())) console.log('CONSOLE', m.type(), m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${srv.address().port}/preview/origins/?region=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => globalThis.originsPreview, null, { timeout: 180000 });
await page.waitForTimeout(15000);
const t = await page.evaluate(() => { const g = globalThis.originsPreview.mobs().mobs.find((q) => q.id === 'scavengers-1'); return { x: g.x, z: g.z }; });
await page.evaluate((t) => globalThis.originsPreview.place(t.x + 1.5, t.z - 5, Math.PI), t);
await page.waitForTimeout(25000);
console.log('mob', await page.evaluate(() => JSON.stringify(globalThis.originsPreview.mobs().mobs.filter((q) => q.id.startsWith('scav')).map((q) => [q.id, q.loadout, q.height, q.drawn, q.model, q.worn.join(',')]))));
console.log('meshes', await page.evaluate(() => { const o = globalThis.originsPreview, m = o.mobs(); try { const r = m.meshesOf('scavengers-1'); return JSON.stringify(r.map?.((x) => x.name ?? x) ?? r).slice(0, 1500); } catch (e) { return 'err ' + e; } }));
console.log('hand', await page.evaluate(() => { const m = globalThis.originsPreview.mobs(); try { const r = m.handMesh('scavengers-1'); return JSON.stringify(r && (r.name ?? Object.keys(r))); } catch (e) { return 'err ' + e; } }));
await page.screenshot({ path: `${out}-p1.png` });
process.exit(0);
