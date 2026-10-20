// Probe: a fresh guest (nothing stored) in a Zone 1 camp fight on the built origins-preview page at 375x812: taps SPECIAL 1 then SPECIAL 2 and prints the hero's combat state, the button states and the cast trace around each press.
// Usage: node scripts/special-zone1-probe.mjs <built origins-preview dist> [--weapon <id>]   (PIT_GL=1 = software GL)
/* global process, console, window, document */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright';
const dist = path.resolve(process.argv[2]);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(dist, u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (/special|cast/i.test(m.text())) console.log('console:', m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 }); await page.waitForTimeout(3000);
const target = await page.evaluate(() => { const m = window.originsPreview.mobs().mobs.find((q) => q.drawn && q.model); return { id: m.id, x: m.x, z: m.z }; });
await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]);
for (let i = 0; i < 80 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
if (!(await page.evaluate(() => document.body.classList.contains('infight')))) await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
for (let i = 0; i < 40 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
const snap = () => page.evaluate(() => { const c = window.originsPreview.combat(), b = (s) => { const e = document.querySelector(s); return e ? { hidden: e.hidden, dis: e.getAttribute('aria-disabled'), label: e.getAttribute('aria-label') } : null; }; return { hero: c.hero, fighters: c.fighters.map((f) => ({ id: f.id, health: f.health, phase: f.phase, special: f.special, skill: f.skill, skill2: f.skill2, weapon: f.weapon })), one: b('#skill-button'), two: b('#skill2-button') }; });
console.log('before', JSON.stringify(await snap()));
for (const sel of ['#skill-button', '#skill2-button']) {
  const box = await page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
  await page.touchscreen.tap(box.x, box.y);   // a raw touch at the button's centre: locator.tap() hangs on this page
  for (let t = 0; t < 8; t++) { await page.waitForTimeout(250); console.log(sel, t, JSON.stringify(await snap())); }
  await page.waitForTimeout(2500);
}
console.log('errors', JSON.stringify(errors));
await browser.close(); server.close();
