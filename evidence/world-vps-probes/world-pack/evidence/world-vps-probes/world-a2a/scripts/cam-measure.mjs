// VPS-only probe (not committed): per fight, the fraction of samples with the nearest hunting foe on screen, under ?camera= base/a/b. Needs the patched originsPreview.ndc/heading.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { chromium } from 'playwright';
const [dist, out] = process.argv.slice(2), root = process.cwd(), zone = process.env.ZONE || '1', QS = process.env.QS;
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${path.resolve(dist)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/${QS}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(6000);
  const target = await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body).sort((a, b) => (a.id < b.id ? -1 : 1))[0]);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]); await page.waitForTimeout(2500);
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => document.body.classList.contains('infight') && window.originsPreview.combat().fighters.some((f) => f.hunting && f.phase !== 'dead'))) break; }
  const rows = []; const t0 = Date.now();
  while (Date.now() - t0 < 22000) {
    const s = await page.evaluate(() => { const o = window.originsPreview, p = o.pos, h = o.heading(), me = o.combat(), f = me.fighters.filter((x) => x.id !== 'me' && x.hunting && x.phase !== 'dead');
      if (!f.length || me.hero?.dead) return null; f.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); const n = f[0], dx = n.x - p.x, dz = n.z - p.z;
      const ndc = o.ndc(n.x, 0.9, n.z), hero = o.ndc(p.x, 1.0, p.z);
      return { lat: dx * Math.cos(h) - dz * Math.sin(h), fwd: dx * Math.sin(h) + dz * Math.cos(h), nx: ndc[0], ny: ndc[1], nz: ndc[2], hx: hero[0], hy: hero[1], hz: hero[2], foes: f.length }; });
    if (s) rows.push(s);
    await page.evaluate(() => window.originsPreview.press('light')); await page.waitForTimeout(250);
  }
  const on = (r, m) => Math.abs(r.nx) < m && Math.abs(r.ny) < m && r.nz < 1, heroOn = (r) => Math.abs(r.hx) < 1 && Math.abs(r.hy) < 1 && r.hz < 1;
  const n = rows.length, f = (fn) => n ? +(rows.filter(fn).length / n).toFixed(3) : null;
  console.log(JSON.stringify({ zone, QS, target: target.id, samples: n, foeOnScreen: f((r) => on(r, 1)), foeCentral80: f((r) => on(r, 0.8)), heroOnScreen: f(heroOn), foeLeftOfHero: f((r) => r.lat < 0), meanLat: n ? +(rows.reduce((a, r) => a + r.lat, 0) / n).toFixed(2) : null }));
} finally { await browser.close(); server.close(); }
