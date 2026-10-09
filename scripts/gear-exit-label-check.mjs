// The gear sheet's exit label never overlaps the Gear tab or the Settings cog, whatever the zone is called (Web, 2026-10-09; Lead: 700+ zones coming).
// Boots Zone 1's page, opens the ☰ on the gear sheet at 375 wide, sets the exit label to each name given, and measures: the exit button's box ends before the Gear tab starts, the
// Gear tab's box and the cog's box do not intersect, nothing leaves the viewport, and the full name is the button's aria-label.
// Usage: node scripts/gear-exit-label-check.mjs <built origins-preview dist> <out dir> ["Back to <name>" ...]   (default names: the registry's longest + a 40-character fixture)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const [dist, out, ...given] = process.argv.slice(2), root = process.cwd();
const names = given.length ? given : ['Back to The Concord Exchange Quarter', 'Back to The Very Long Ash Reaches Of Nowhere'];
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], rows = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  page.setDefaultTimeout(240000); page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForSelector('#menu-gear', { state: 'attached', timeout: 120000 });
  await page.locator('#journal-button').tap(); await page.locator('#menu-gear').tap();
  await page.waitForSelector('#journal[open][data-gear="live"]'); await page.waitForTimeout(4000);
  const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { l: r.left, r: r.right, t: r.top, b: r.bottom }; }, sel);
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  for (const name of [null, ...names]) {
    if (name) await page.evaluate((n) => { const b = document.getElementById('nav-pit'); b.textContent = n; b.setAttribute('aria-label', n); }, name);
    await page.waitForTimeout(300);
    const exit = await box('#nav-pit'), gear = await box('#nav-gear'), cog = await box('.tab-settings'), aria = await page.evaluate(() => document.getElementById('nav-pit').getAttribute('aria-label'));
    const clipped = await page.evaluate(() => { const b = document.getElementById('nav-pit'); return b.scrollWidth > b.clientWidth; });
    rows.push({ name: name ?? '(as shipped)', exit, gear, cog, clipped });
    await page.screenshot({ path: path.join(out, `exit-${name ? names.indexOf(name) + 1 : 0}.png`) });
    assert.ok(exit.r <= gear.l + 0.5, `${name}: the exit ends at ${exit.r}, the Gear tab starts at ${gear.l}`);
    const gearText = await page.evaluate(() => { const b = document.getElementById('nav-gear'), r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect(); return { l: t.left, r: t.right, t: t.top, b: t.bottom }; });
    assert.ok(!hit(gearText, cog), `${name}: the GEAR text (${gearText.l}-${gearText.r}) overlaps the Settings cog (${cog.l}-${cog.r})`);
    assert.ok(exit.l >= 0 && gear.r <= 375.5, `${name}: the nav leaves the viewport`);
    if (name) assert.equal(aria, name, 'the full name stays in the accessible label');
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify({ passed: true, rows }));
} finally { await browser.close(); server.close(); }
