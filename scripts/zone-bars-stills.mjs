// Stills of the Zone 1 health bars at a phone (visual-pr-stills): the built origins preview with a creature engaged ("ready": engaged, before the first cut) and mid-fight (first health drop), at 375 and 320 wide, plus the Pit's
// own page as the unchanged control. Derived from scripts/zone-hit-stills.mjs (same creature pick, same page hooks). Chromium on software GL; run on the trunk build for "before" and on the PR build for "after".
//   ZONE_DIST=<built origins preview> PIT_DIST=<built game dist> OUT=<dir> node scripts/zone-bars-stills.mjs     (either dist may be omitted)
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ZONE = process.env.ZONE_DIST, PIT = process.env.PIT_DIST, out = process.env.OUT || 'artifacts/zone-bars-stills', root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = {};
if (ZONE) roots['/preview/origins/'] = `${path.resolve(ZONE)}/`;
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (!hit && PIT) { hit = path.join(path.resolve(PIT), u === '/' ? 'index.html' : u); if (!fs.existsSync(hit) && !path.extname(u)) hit = path.join(path.resolve(PIT), 'index.html'); }
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { zone: [], pit: null };
const shoot = (page, name) => page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 72, timeout: 240000 });
try {
  if (ZONE) for (const width of [375, 320]) for (let attempt = 0; attempt < 3; attempt++) {   // a run that lands no cut in time is retaken (software GL is slow)
    const z = { width, attempt, errors: [] }; receipt.zone.push(z);
    const page = await (await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true })).newPage();
    page.on('pageerror', (e) => z.errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
    const target = await page.evaluate(() => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return l[0]; });
    z.target = target.body;
    await page.waitForTimeout(4000);
    const at = await page.evaluate((i) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === i); return [m.x, m.z]; }, target.id);
    await page.evaluate(([x, zz]) => window.originsPreview.place(x, zz - 1.4, 0), at);
    await page.waitForTimeout(2500);
    await page.evaluate((i) => window.originsPreview.tapMob(i), target.id);
    const hp = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.hp ?? null, target.id);
    for (let k = 0; k < 40 && (await hp()) === null; k++) await page.waitForTimeout(250);
    await page.waitForTimeout(600); await shoot(page, `zone-${width}-ready.jpg`);
    let first = null, shot = false;
    for (let t = 0; t < 90 && !shot; t++) {
      await page.evaluate(() => window.originsPreview.press('light'));
      await page.waitForTimeout(400);
      const h = await hp(); first ??= h;
      if (h !== null && first !== null && h < first) { await shoot(page, `zone-${width}-mid.jpg`); shot = true; }
    }
    z.shot = shot; z.hp = [first, await hp()];
    z.bars = await page.evaluate(() => { const r = document.querySelector('.combat-hud'); const b = r?.getBoundingClientRect(); return { present: !!r, shown: r ? getComputedStyle(r).display : null, rect: b ? [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] : null, plate: !!document.querySelector('.fm-meters'), plateShown: document.querySelector('.fm-meters') ? !document.querySelector('.fm-meters').hidden : null, name: document.getElementById('opponent-name')?.textContent ?? null, health: document.getElementById('player-health-value')?.textContent ?? null }; });
    await page.context().close();
    if (z.shot) break;
  }
  if (PIT) {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(`${origin}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 150000, polling: 200 });
    await page.waitForTimeout(1500); await shoot(page, 'pit-375.jpg');
    receipt.pit = { errors, name: await page.evaluate(() => document.getElementById('opponent-name')?.textContent ?? null) };
    await page.context().close();
  }
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
