// Stills of a ground item on the Zone 1 path at a phone (visual-pr-stills): the built origins preview, the walk camera at 375 wide, once with nothing on the ground (before) and once with the item lying a few
// steps ahead (after), drawn by the ground-item view through the `originsPreview.ground` hook. Chromium on software GL (VPS `capture`). The item's model is served from src/assets/weapons/player.
//   ZONE_DIST=<built origins preview> OUT=<dir> ITEM=item:starter.rusty-sword MODEL=longsword.glb node scripts/ground-item-stills.mjs
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ZONE = process.env.ZONE_DIST, out = process.env.OUT || 'artifacts/ground-item-stills', ITEM = process.env.ITEM || 'item:starter.rusty-sword', MODEL = process.env.MODEL || 'longsword.glb', root = process.cwd();
const AHEAD = Number(process.env.AHEAD || 2.2), SIDE = Number(process.env.SIDE || 0.15);   // metres in front of and beside the walker
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
const roots = { '/preview/origins/': `${path.resolve(ZONE)}/`, '/item-models/': `${root}/src/assets/weapons/player/` };
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
const receipt = { errors: [] };
const shoot = (page, name) => page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 80, timeout: 240000 });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
  await page.waitForTimeout(4000);
  const at = await page.evaluate(() => { const p = window.originsPreview.pos; return { x: p.x, z: p.z }; });
  receipt.walker = at;
  await shoot(page, 'ground-before-375.jpg');
  await page.evaluate(([x, z, item, url]) => window.originsPreview.ground.show('ground:still', item, x, z, url), [at.x + SIDE, at.z + AHEAD, ITEM, `/item-models/${MODEL}`]);
  await page.waitForFunction(() => window.originsPreview.ground.anchor('ground:still') !== undefined, null, { timeout: 60000 });
  receipt.anchor = await page.evaluate(() => window.originsPreview.ground.anchor('ground:still'));
  await page.waitForTimeout(2500); await shoot(page, 'ground-after-375.jpg');
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
