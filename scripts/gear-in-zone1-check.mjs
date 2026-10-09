// The engine's gear screen IN Zone 1 (Web, 2026-10-09): the ☰ menu's Gear chip opens the Pit's own sheet over Zone 1's cut of the menu, the hero dressed in-zone, on a fake server ledger (page.route answers /origins/<op>).
// Usage: node scripts/gear-in-zone1-check.mjs <built origins-preview dist> <out dir>   (software GL is fine: it is a layout check)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${path.resolve(dist)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const piece = (where, paperdoll) => ({ id: 'inst:g1', item: 'item:loot.goblin.Helmet', lootId: 'goblin.Helmet', slot: 'Helmet', where, index: where === 'equipped' ? null : 0, paperdoll, tier: 'Recruit', version: 1 });
let ledger = { pieces: [piece('pack', null)], worn: {}, packSize: 8, bankSize: 100 };
const seen = [];
const answer = (route) => {
  if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.fallback();   // the glob also matches the page's own URL (/preview/origins/)
  const op = route.request().url().split('/').at(-1);
  seen.push({ op, auth: route.request().headers().authorization });
  if (op === 'gear_equip') ledger = { pieces: [piece('equipped', 'head')], worn: { head: 'inst:g1' }, packSize: 8, bankSize: 100 };
  const result = op === 'open' ? { career: { total_credit: 0 }, characters: [{ id: 'c1', name: 'Dom' }], marks: 0 } : ledger;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result }) });
};
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  page.setDefaultTimeout(240000); page.on('pageerror', (e) => errors.push(String(e))); const logs = []; page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text().slice(0, 300)); });
  await page.route('**/origins/*', answer);
  await page.addInitScript((s) => localStorage.setItem('frankendom.auth.v1', s), JSON.stringify({ access_token: 'tok', expires_at: Math.floor(Date.now() / 1000) + 3600 }));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForSelector('#menu-gear', { state: 'attached', timeout: 90000 }).catch(async (e) => { console.log('NO #menu-gear; url', page.url(), 'ids', JSON.stringify(await page.evaluate(() => ({ chips: [...document.querySelectorAll('.chips button')].map((b) => b.id), duel: document.getElementById('duel')?.className, hasJournal: !!document.getElementById('journal'), mobileSound: !!document.getElementById('mobile-sound') }))), 'page errors', JSON.stringify(errors), 'console', JSON.stringify(logs.filter((l) => !/GL Driver/.test(l)).slice(-6))); throw e; });
  await page.locator('#journal-button').tap(); await page.locator('#menu-gear').tap();
  await page.waitForSelector('#journal[open][data-gear="live"]'); await page.waitForSelector('#pack li[data-loot="goblin.Helmet"]');
  await page.waitForTimeout(8000);   // the rig and loot.glb load on the first open
  await page.screenshot({ path: path.join(out, '1-server-piece-in-pack.png') });
  await page.locator('#pack li[data-loot="goblin.Helmet"] [data-fit]').tap(); await page.locator('#fitting-wear').tap();
  await page.waitForSelector('#slot-head[data-loot="goblin.Helmet"]'); await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(out, '2-worn-on-the-zone1-hero.png') });
  assert.deepEqual(seen.map((s) => s.op).filter((o) => o.startsWith('gear_')), ['gear_open', 'gear_equip']); assert.ok(seen.every((s) => s.auth === 'Bearer tok'));
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, ops: seen.map((s) => s.op) }));
} finally { await browser.close(); server.close(); }
