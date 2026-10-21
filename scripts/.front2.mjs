// usage: node .front2.mjs <url> <outprefix> [idfilter]  grid of hero offsets around the nearest matching goblin
import { chromium } from 'playwright';
const [url, out, idf = ''] = process.argv.slice(2);
const swift = process.env.GL === 'swiftshader';
let target = url;
if (process.env.STATIC) {
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
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url().slice(0, 200)); });
page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 160)));
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => globalThis.originsPreview, null, { timeout: 180000 });
await page.waitForTimeout(swift ? 30000 : 15000);
console.log('keys', await page.evaluate(() => Object.keys(globalThis.originsPreview).join(',')));
const pick = () => page.evaluate((idf) => { const m = globalThis.originsPreview.mobs().mobs.filter((q) => !String(q.id).startsWith('bounty') && q.body === 'goblin' && (idf || q.drawn !== false) && (!idf || JSON.stringify(q).includes(idf))); const p = globalThis.originsPreview.pos; m.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); const g = m[0]; return g ? { id: g.id, x: g.x, z: g.z, loadout: g.loadout, worn: g.worn } : null; }, idf);
let t = await pick();
console.log('target', JSON.stringify(t));
if (t && idf) { await page.evaluate((t) => globalThis.originsPreview.place(t.x - 3, t.z - 3, 0), t); await page.waitForTimeout(swift ? 20000 : 8000); t = await pick(); console.log('target2', JSON.stringify(t)); }
if (!t) { console.log('mobs', JSON.stringify(await page.evaluate(() => globalThis.originsPreview.mobs().mobs.map((q) => [q.id, q.body, q.character, q.loadout]).slice(0, 40)))); await browser.close(); process.exit(2); }
// grid: [name, d (m from goblin), s (sideways m), aimShift (m the aim point is moved sideways)]
for (const [name, a, d] of [['a', 0.7, 3.2], ['b', -0.7, 3.2], ['c', 1.1, 3.2], ['d', -1.1, 3.2], ['e', 0.4, 3.6]]) {
  await page.evaluate(([t, a, d]) => { const o = globalThis.originsPreview; o.place(t.x - Math.sin(a) * d, t.z - Math.cos(a) * d, 0); }, [t, a, d]);
  for (const k of [1, 2, 3]) {
    await page.waitForTimeout(swift ? 2500 : 700);
    await page.screenshot({ path: `${out}-${name}${k}.png` });
    console.log('shot', name, k, JSON.stringify(await page.evaluate((id) => { const o = globalThis.originsPreview; const g = o.mobs().mobs.find((q) => q.id === id); return [o.pos.x - g.x, o.pos.z - g.z].map((v) => +v.toFixed(2)).concat([JSON.stringify(o.mobScreen(id)), o.mobs().mobs.filter((q) => q.body === 'goblin' && Math.hypot(q.x - g.x, q.z - g.z) < 4).map((q) => q.id + ':' + q.loadout).join('|')]); }, t.id)));
  }
}
process.exit(0);
