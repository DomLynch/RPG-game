// Zone 1 hold-for-heavy probe: a real touch TAP vs a real touch HOLD on STRIKE (CDP touch events, so the page sees pointer events) in /preview/origins/?region=1&worldfight on a BUILT page,
// reading what follows from the world sim: the hero's phases (a heavy's windup is longer than a light's) and the foe's hp drop (a heavy hits harder). REAL_GPU=1 so page time is real time.
// Usage: node scripts/zone1-heavy-hold-probe.mjs <built origins-preview dist> <out dir>     env: HOLD_MS=400 SLIDE=1 (a slow slide left: down, wait HOLD_MS, slide 40 px left, up)
/* global process, console, window, document, performance */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [originsDist, out] = process.argv.slice(2), root = process.cwd(), HOLD = Number(process.env.HOLD_MS || 400);
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const roots = [['/preview/origins/', `${path.resolve(originsDist)}/`]];
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
  if (!hit) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? ['--autoplay-policy=no-user-gesture-required'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
// A CDP screencast kept only while a press and its aftermath are on (about 10 fps): the chamber pose of a held heavy, which a per-step screenshot is too slow to catch.
let keepUntil = 0, shot = 0, shotLabel = 'x'; fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
cdp.on('Page.screencastFrame', ({ data, sessionId }) => { if (Date.now() < keepUntil) fs.writeFileSync(path.join(out, 'frames', `${shotLabel}-${String(shot++).padStart(3, '0')}.jpg`), Buffer.from(data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, everyNthFrame: 3 });
const sample = () => page.evaluate(() => { const c = window.originsPreview.combat(); return { t: Math.round(performance.now()), ph: c.hero.phase, foe: c.fighters?.find((q) => q.id !== 'me')?.hp ?? null, hp: c.hero.health, st: Math.round(c.hero.stamina) }; });
try {
  await page.goto(`${base}/preview/origins/?region=1&worldfight&debug=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && /scaveng/.test(m.id)), null, { timeout: 300000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { window.__ev = []; for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.getElementById('attack-button').addEventListener(t, (e) => window.__ev.push([t, Math.round(performance.now()), Math.round(e.clientX), Math.round(e.clientY)])); });
  const [x, y] = await page.evaluate(() => { const b = document.getElementById('attack-button').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
  const near = (d) => page.evaluate((dd) => { const m = window.originsPreview.mobs().mobs.find((q) => /scaveng/.test(q.id) && q.drawn); if (m) window.originsPreview.place(m.x, m.z - dd, 0); }, d);
  const engage = async () => { for (let t = 0; t < 8 && !(await page.evaluate(() => document.body.classList.contains('infight'))); t++) { await near(1.1); await page.evaluate(() => window.originsPreview.press('light')); await page.waitForTimeout(1300); } };
  const ready = () => page.waitForFunction(() => { const h = window.originsPreview.combat().hero; return h.phase === 'ready' && h.stamina >= 60; }, null, { timeout: 90000 }).catch(() => {});
  const touch = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] });
  const plan = [['tap', 40, 0], ['hold', HOLD, 0], ['tap', 40, 0], ['hold', HOLD, 0], ['slide', HOLD, 40], ['slide', HOLD, 40]];
  const results = [];
  for (const [label, ms, slide] of plan) {
    await engage(); await ready(); await near(1.0); await page.waitForTimeout(400);
    const before = await sample(); await page.evaluate(() => { window.__ev.length = 0; }); const pageT0 = await page.evaluate(() => performance.now());
    shotLabel = `${label}${results.length + 1}`; keepUntil = Date.now() + ms + 1200;
    const t0 = Date.now(); await touch('touchStart', x, y); await page.waitForTimeout(ms); if (slide) { await touch('touchMove', x - slide, y); await page.waitForTimeout(60); } await touch('touchEnd');
    const held = Date.now() - t0, seen = [];
    for (let k = 0; k < 50; k++) { await page.waitForTimeout(40); seen.push(await sample()); }
    const phases = seen.filter((s, i) => i === 0 || s.ph !== seen[i - 1].ph).map((s, i, a) => `${s.ph}@${s.t - seen[0].t}`).join(' ');
    const drop = before.foe !== null ? before.foe - Math.min(...seen.map((s) => s.foe ?? 1e9)) : null;
    const line = { label, wantMs: ms, heldMs: held, events: await page.evaluate(() => window.__ev), phases, foeBefore: before.foe, drop, stamina: [before.st, seen[seen.length - 1].st], acts: (await page.evaluate(() => window.originsPreview.combat().acts)).filter((a) => a[0] >= pageT0).map((a) => `${a[1]}@${Math.round(a[0] - pageT0)}`).join(' ') };
    results.push(line); console.log(JSON.stringify(line));
    await page.screenshot({ path: path.join(out, `${label}-${results.length}.png`) }).catch(() => {});
    await page.waitForTimeout(2500);
  }
  fs.writeFileSync(path.join(out, 'probe.json'), JSON.stringify({ errors, results }, null, 1));
} finally { await browser.close(); server.close(); }
console.log('page errors', errors.length);
