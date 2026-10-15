// Stills of a ground item on the Zone 1 path at a phone (visual-pr-stills): the built origins preview, the walk camera at 375 wide, once with nothing on the ground (before) and once with the item lying a few
// steps ahead (after), drawn by the ground-item view through the `originsPreview.ground` hook. Chromium on software GL (VPS `capture`).
//   ROWS=1: one still per shipped ground row (origins/world/ground-items.json), the walker 3 m short of the item at its place, labels on; named <item stem>-<width>.jpg.
//   ZONE_DIST=<built origins preview> OUT=<dir> ITEM=item:starter.rusty-sword node scripts/ground-item-stills.mjs
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { GROUND_ITEMS } from '../origins/world/ground-items.ts';
import { groundPointOf } from '../origins/server/ground-take.ts';
import { frontierPlan } from '../origins/preview/frontier-plan.ts';
import { toWorld } from '../origins/world/derive.ts';

const ZONE = process.env.ZONE_DIST, out = process.env.OUT || 'artifacts/ground-item-stills', ITEM = process.env.ITEM || 'item:starter.rusty-sword', root = process.cwd();
const BACK_M = Number(process.env.BACK_M || 6);
const LABEL = process.env.LABEL || 'run', WIDTHS = (process.env.WIDTHS || '375').split(',').map(Number), AHEAD = Number(process.env.AHEAD || 2.2), SIDE = Number(process.env.SIDE || 0.15);   // metres in front of and beside the walker
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
const roots = { '/preview/origins/': `${path.resolve(ZONE)}/` };
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
  if (process.env.ROWS) for (const [gid, row] of Object.entries(GROUND_ITEMS).filter(([, r]) => !process.env.ONLY || process.env.ONLY.split(',').includes(r.item.replace('item:starter.', '')))) for (const width of WIDTHS) {
    const at = groundPointOf(row), centre = groundPointOf({ ...row, offsetX: 0, offsetZ: 0 }), stem = row.item.replace('item:starter.', '');
    const page = await (await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true })).newPage();
    page.on('pageerror', (e) => receipt.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
    // the walker stands BACK_M from the item, facing it, on the side of the 8 compass points that is farthest from any creature (a creature in aggro range engages him and turns the camera), the side toward the place's centre winning ties
    const mobs = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => [m.x, m.z]));
    const towardCentre = Math.atan2(centre.x - at.x, centre.z - at.z) || Math.PI;
    const zones = frontierPlan(true, '1').zones, rect = (z) => [[-z.width / 2, 0], [z.width / 2, 0], [z.width / 2, z.depth], [-z.width / 2, z.depth]].map(([x, d]) => toWorld({ x, d }, z.mount));
    const placeAt = (p) => zones.find((z) => { const q = rect(z), s = q.map((a, i) => { const b = q[(i + 1) % 4]; return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x); }); return s.every((v) => v >= 0) || s.every((v) => v <= 0); })?.zone;   // the first place that contains the walker names the HUD
    let best = null; for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, c = { x: at.x + Math.sin(a) * BACK_M, z: at.z + Math.cos(a) * BACK_M };
      if (placeAt(c) !== row.place) continue;   // stand in the item's own place, so the HUD names it
      const clear = Math.min(...mobs.map(([x, z]) => Math.hypot(x - c.x, z - c.z)), 99), tie = Math.cos(a - towardCentre);
      if (!best || clear > best.clear + 4 || (Math.abs(clear - best.clear) <= 4 && tie > best.tie)) best = { c, clear, tie };
    }
    const hero = best.c, heading = Math.atan2(at.x - hero.x, at.z - hero.z);
    await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), [hero.x, hero.z, heading]);
    await page.evaluate(([id, item, x, z]) => window.originsPreview.ground.show(id, item, x, z), [gid, row.item, at.x, at.z]);
    await page.waitForFunction((id) => window.originsPreview.ground.anchor(id) !== undefined, gid, { timeout: 60000 });
    await page.waitForTimeout(5000);
    (receipt.rows ??= {})[`${stem}-${width}`] = { place: row.place, at, anchor: await page.evaluate((id) => window.originsPreview.ground.anchor(id), gid) };
    await shoot(page, `${stem}-${width}.jpg`);
    await page.context().close();
  }
  else for (const width of WIDTHS) {
    const page = await (await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true })).newPage();
    page.on('pageerror', (e) => receipt.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
    await page.waitForTimeout(4000);
    const at = await page.evaluate(() => { const p = window.originsPreview.pos; return { x: p.x, z: p.z }; });
    receipt.walker = at;
    await shoot(page, `${LABEL}-none-${width}.jpg`);
    await page.evaluate(([x, z, item]) => window.originsPreview.ground.show('ground:still', item, x, z), [at.x + SIDE, at.z + AHEAD, ITEM]);
    await page.waitForFunction(() => window.originsPreview.ground.anchor('ground:still') !== undefined, null, { timeout: 60000 });
    receipt.anchor = await page.evaluate(() => window.originsPreview.ground.anchor('ground:still'));
    await page.waitForTimeout(2500); await shoot(page, `${LABEL}-item-${width}.jpg`);
    await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
