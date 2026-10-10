// 375-wide stills of Zone 1 (?region=1&worldfight) for STAB (#1957): ready idle, mid-fight (engaged), then a stab pressed (window.originsPreview.combat press('thrust')) and shot mid-swing.
// Usage: node scripts/zone1-stab-stills.mjs <built origins-preview dist> <out dir>   (software GL is fine: it is a layout check)
//   ZONE=2 shoots another zone (?region=1&zone=2&worldfight, the way zone-hit-stills reaches it); TAGS_TARGET=<id or id prefix> picks the foe;
//   KILL=1 then cuts until the foe's health is 0 and adds kill.png. Defaults (Zone 1, no kill) are unchanged.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd(), zone = process.env.ZONE || '1';
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
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(process.env.LIVE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  await page.waitForTimeout(8000);
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 });
  await shot('idle');
  const want = process.env.TAGS_TARGET || '';   // a creature id; default the first drawn one in id order, so before and after engage the same foe
  const target = await page.evaluate((id) => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body).sort((a, b) => (a.id < b.id ? -1 : 1)).find((m) => !id || m.id.startsWith(id)), want);
  console.log('target:', target.id);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]);
  await page.waitForTimeout(zone === '1' ? 20000 : 2500);   // Zone 2's wolf pack aggros within seconds: a 20 s wait gets the hero mauled and respawned in the Pit
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate((w) => window.originsPreview.duel()?.ready || (w && document.body.classList.contains('infight')), zone !== '1')) break; }   // other zones: the engine loop runs in the walk, duel() stays null, so wait for the infight class
  await page.waitForTimeout(600);   // right at the engage: later the software-GL clock can run the whole fight to its end screen
  console.log('infight:', await page.evaluate(() => document.body.classList.contains('infight')));
  await shot('fight');
  const read = () => page.evaluate(() => { const c = window.originsPreview.combat(); return { foe: c.target?.health ?? null, st: c.hero?.stamina ?? 0, down: !!c.hero?.dead }; });
  let last = null, shots = 0, dead = false;
  for (let t = 0; t < 400 && !dead; t++) {
    const { foe, st, down } = await read(); if (down) break;
    if (last !== null && foe !== null && foe < last && shots < 3) { await shot(`blood-${shots++}`); console.log("hit shot", shots, "foe", foe, JSON.stringify(await page.evaluate(() => window.originsPreview.wounds?.() ?? null))); }
    if (foe !== null) last = foe; dead = foe === null && last !== null && last <= 0; if (foe === null && last !== null) dead = true;
    if (st < 30) { await page.waitForTimeout(1200); continue; }
    await page.evaluate(() => window.originsPreview.press('light')); await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300); await shot(dead ? 'kill' : 'no-kill'); console.log('kill:', dead);
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); server.close(); }
