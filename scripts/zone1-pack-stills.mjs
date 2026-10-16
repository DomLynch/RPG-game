// 375-wide stills of Zone 1 (?region=1&worldfight) for a pack of up to three joined creatures (#1958): ready idle, then mid-fight; prints the card text, how many creatures are aggro and body.infight.
// Usage: node scripts/zone1-pack-stills.mjs <built origins-preview dist> <out dir> [zone id]   (software GL is fine: it is a layout check). A zone id (3) stills /zone/3/ instead of Zone 1.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out, zone] = process.argv.slice(2), root = process.cwd();
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
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight${zone ? `&zone=${zone}` : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 240000 });   // `model`: the body has replaced the capsule (`body` is only the kind name, always set)
  await page.waitForTimeout(8000);
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 });
  await shot('idle');
  const target = await page.evaluate(() => { const ms = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body), near = (a) => ms.filter((b) => b.name === a.name && Math.hypot(a.x - b.x, a.z - b.z) < 8).length; return ms.sort((a, b) => near(b) - near(a))[0]; });   // the drawn creature with the biggest same-kind pack around it
  const mid = await page.evaluate((t) => { const p = window.originsPreview.mobs().mobs.filter((b) => b.name === t.name && Math.hypot(b.x - t.x, b.z - t.z) < 8); return [p.reduce((a, b) => a + b.x, 0) / p.length, p.reduce((a, b) => a + b.z, 0) / p.length]; }, target);
  if (zone) { await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 7, 0), mid); await page.waitForTimeout(400); await shot('wolf-in-view'); }   // a zone run first stands 7 m south of the creature, facing it: the creature in view
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), mid);   // the middle of the pack, so every one of them notices
  // A pack waits 20 s so every creature notices. A zone's lone creature is aggro and starts the duel by itself within seconds, and on a GPU it beats a standing guest before a fixed wait ends: poll for the fight instead.
  const line = []; const state = () => page.evaluate(() => [document.body.classList.contains('infight') ? 'fight' : 'walk', window.originsPreview.duel()?.ready ? 'ready' : '-', window.originsPreview.mobs().mobs.map((m) => m.mode[0]).join(''), document.title.slice(0, 22)].join(' '));
  if (zone) { for (let i = 0; i < 80 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) { if (i % 4 === 0) line.push(`${i / 4}s ${await state()}`); await page.waitForTimeout(250); } console.log('TIMELINE', line.join(' | ')); } else await page.waitForTimeout(20000);
  if (!(await page.evaluate(() => document.body.classList.contains('infight')))) await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  if (!zone) for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => window.originsPreview.duel()?.ready)) break; }   // a zone run does not wait for `ready`: the duel is already running and an idle guest does not outlast it
  await page.waitForTimeout(zone ? 1500 : 4000);   // a zone's lone creature kills a standing guest fast on a GPU: the shot is taken as the duel starts
  await shot('fight');
  console.log(JSON.stringify(await page.evaluate(() => ({ infight: document.body.classList.contains('infight'), card: document.getElementById('creature-card')?.hidden ? null : document.getElementById('creature-card')?.innerText, aggro: window.originsPreview.mobs().mobs.filter((m) => m.mode === 'aggro').length }))));
  console.log('errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); server.close(); }
