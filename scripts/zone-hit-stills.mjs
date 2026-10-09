// Mid-hit stills of the shared zone page, Zone 1 and Zone 2, 375 wide (visual-pr-stills): a creature is engaged and cut until its health drops, then the page is photographed.
// Usage: AB_DIST=<built origins-preview dir> OUT=<dir> node scripts/zone-hit-stills.mjs   (run it on the trunk build for "before" and on the PR build for "after"). Chromium on software GL.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), built = process.env.AB_DIST || path.join(root, 'artifacts/origins-preview'), out = process.env.OUT || path.join(root, 'artifacts/zone-hit-stills');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { dist: built, zones: [] };
try {
  for (const [id, query] of [['1', '?region=1'], ['2', '?region=1&zone=2']]) {
    const z = { zone: id, errors: [] }; receipt.zones.push(z);
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
    page.on('pageerror', (e) => z.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`${origin}/preview/origins/${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
    const target = await page.evaluate(() => window.originsPreview.mobs().mobs.find((m) => m.drawn && m.body)); z.target = target.body;
    await page.waitForTimeout(4000);
    const at = await page.evaluate((i) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === i); return [m.x, m.z]; }, target.id);
    await page.evaluate(([x, zz]) => window.originsPreview.place(x, zz - 1.4, 0), at);
    await page.waitForTimeout(2500);
    await page.evaluate((i) => window.originsPreview.tapMob(i), target.id);
    const hp = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.hp ?? null, target.id);
    let first = null, shot = false;
    for (let t = 0; t < 90 && !shot; t++) {
      await page.evaluate(() => window.originsPreview.press('light'));
      await page.waitForTimeout(400);
      const h = await hp(); first ??= h;
      if (h !== null && first !== null && h < first) { await page.screenshot({ path: path.join(out, `zone${id}-hit.jpg`), type: 'jpeg', quality: 80, timeout: 240000 }); shot = true; }
    }
    z.shot = shot; z.hp = [first, await hp()];
    await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
