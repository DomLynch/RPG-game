// Zone page stills at 375x812 for zones 1 and 3 (?zone=<id> on the origins-preview build): the first view at spawn, then the hub (the Pit and the Exchange, placed at the start) the walk starts from.
// Reads the zone the page reports and its ambience preset. Needs ZONE_DIST (the origins-preview build). Stills: artifacts/zone-theme/.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createReadStream, existsSync, statSync } from 'node:fs';

const dir = process.env.THEME_DIR || 'artifacts/zone-theme', tag = process.env.THEME_TAG || 'before'; await fs.mkdir(dir, { recursive: true });
const built = path.resolve(process.env.ZONE_DIST), root = process.cwd();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const roots = { '/preview/origins/': `${built}/` }; for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const zs = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [pre, r] of Object.entries(roots)) if (u.startsWith(pre)) hit = path.join(r, u.slice(pre.length) || 'index.html'); if (hit && existsSync(hit) && statSync(hit).isDirectory()) hit = path.join(hit, 'index.html'); if (!hit || !existsSync(hit)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); createReadStream(hit).pipe(res); });
await new Promise((r) => zs.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${zs.address().port}`;
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const out = {};
try {
  for (const zone of ['1', '3']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await context.newPage(); page.setDefaultTimeout(90000); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(`${origin}/preview/origins/?region=1&zone=${zone}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 }); await page.waitForTimeout(3000);
    out[zone] = await page.evaluate(() => ({ ambience: document.body.dataset.ambience, pos: { ...window.originsPreview.pos } }));
    await page.screenshot({ path: `${dir}/${tag}-zone${zone}-spawn.png` });
    await page.evaluate(() => window.originsPreview.place(0, 3, 0)); await page.waitForTimeout(2500);   // the hub: the Pit's ring, facing +z (heading 0)
    out[zone].hub = await page.evaluate(() => document.body.dataset.ambience);
    await page.screenshot({ path: `${dir}/${tag}-zone${zone}-hub.png` });
    await context.close();
  }
  console.log('zone-theme-stills DONE', JSON.stringify(out));
} catch (error) { console.error('zone-theme-stills FAIL', error.message); process.exitCode = 1; }
finally { await browser.close(); zs.close(); }
