// Landscape / portrait layout check (see below)
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
// Landscape / portrait layout check of the shared zone page (Dom, 2026-10-10: the menus and the HUD overlap on an iPhone in landscape). For each viewport and state (walk, fight, menu open): a still, and the rects of every visible
// interactive element; two of them overlapping fails the run (an element counts only when it is shown and has a real box). Usage: AB_DIST=<built origins-preview dir> OUT=<dir> node scripts/landscape-check.mjs
const VIEWS = [['portrait', 375, 812], ['landscape', 812, 375], ['ipad', 1024, 768]];
const SEL = 'button, a[href], [role=button], .stick, #creature-card, #hud > span, #hud > small, #hint, #health-value, #player-health, #target-health, #posture, #stamina';
const rects = (page) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); let v = r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0; for (let p = e.parentElement; v && p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') v = false; } return v ? { id: e.id || e.className || e.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null; }).filter(Boolean), SEL);
const overlaps = (list, vw, vh) => { const bad = []; for (let i = 0; i < list.length; i++) { const a = list[i]; if (a.x < 0 || a.y < 0 || a.x + a.w > vw + 1 || a.y + a.h > vh + 1) bad.push(`${a.id} off screen`); for (let j = i + 1; j < list.length; j++) { const b = list[j], ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 2 && oy > 2) bad.push(`${a.id} x ${b.id} (${ox}x${oy})`); } } return bad; };
const receipt = { dist: built, views: [] };
try {
  for (const [name, w, h] of VIEWS) {
    const v = { view: name, w, h, states: {} }; receipt.views.push(v);
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
    await page.waitForTimeout(4000);
    const snap = async (state) => { await page.screenshot({ path: path.join(out, `${name}-${state}.jpg`), type: 'jpeg', quality: 80, timeout: 240000 }); const list = await rects(page); v.states[state] = { count: list.length, bad: overlaps(list, w, h), list }; };
    await snap('walk');
    const target = await page.evaluate(() => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return l[0]; });
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), [target.x, target.z]); await page.waitForTimeout(2500);
    await page.evaluate((i) => window.originsPreview.tapMob(i), target.id); await page.waitForTimeout(4000);
    await snap('fight');
    const menu = await page.$('#menu-button, #journal-button, #walk-journal');
    if (menu) { await menu.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); await snap('menu'); }
    v.errors = errors; await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  const fails = receipt.views.flatMap((v) => Object.entries(v.states).flatMap(([s, r]) => r.bad.map((b) => `${v.view}/${s}: ${b}`)));
  console.log(fails.length ? `landscape-check FAIL\n${fails.join('\n')}` : 'landscape-check PASS', JSON.stringify(receipt.views.map((v) => [v.view, Object.fromEntries(Object.entries(v.states).map(([k, r]) => [k, r.count]))])));
  process.exitCode = fails.length ? 1 : 0;
} catch (error) { console.error('landscape-check ERROR', error); process.exitCode = 2; }
finally { await browser.close(); server.close(); }
