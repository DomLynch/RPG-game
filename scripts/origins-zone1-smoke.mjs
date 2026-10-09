// Zone 1 smoke (K2d): the built origins page loads ?region=1, a creature is engaged with the real tap path, and the engine's combat loop RUNS: no page error, no console error,
// and wc.update stepped (a ReferenceError in step() once stopped it every frame while every unit test stayed green: origins/preview/main.ts is not in any tsconfig).
// Serves artifacts/origins-preview (built here when missing). Exit 1 with the errors on a miss; a receipt goes to artifacts/origins-zone1-smoke.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
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
const receipt = { origin, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|404|WebGL|GPU stall/i.test(m.text())) receipt.errors.push(`console: ${m.text().slice(0, 200)}`); });
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
  const target = await page.evaluate(() => window.originsPreview.mobs().mobs.find((m) => m.drawn && m.body));
  assert.ok(target, 'a drawn creature'); receipt.target = { id: target.id, body: target.body };
  const steps0 = await page.evaluate(() => window.originsPreview.combat ? 0 : -1); assert.equal(steps0, 0, 'originsPreview.combat exists');
  await page.waitForTimeout(5000);   // frames run before the engage: a step() that throws every frame would show here
  const at = await page.evaluate((id) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === id); return m && [m.x, m.z]; }, target.id);
  assert.ok(at, 'the target is still in the world');
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), at);
  await page.waitForTimeout(3000);
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  // the engine's loop runs: the hero is in the world loop, and his stamina or a creature's phase moves once he has cut
  const seen = await page.waitForFunction(() => { const c = window.originsPreview.combat(); return c && c.hero && c.fighters.length >= 1 && (c.hero.phase !== 'ready' || c.fighters.some((f) => f.hunting)); }, null, { timeout: 60000 }).then(() => true, () => false);
  receipt.combat = await page.evaluate(() => { const c = window.originsPreview.combat(); return { hero: c.hero, fighters: c.fighters.length }; });
  assert.ok(seen, `the engine loop never reacted to the tap: ${JSON.stringify(receipt.combat)}`);
  await page.waitForTimeout(4000);
  assert.deepEqual(receipt.errors, [], 'no page or console errors');
  fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/origins-zone1-smoke.json', JSON.stringify(receipt, null, 2));
  console.log('zone1 smoke OK', JSON.stringify(receipt));
} catch (error) { console.error('zone1 smoke FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
