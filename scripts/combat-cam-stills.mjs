// The wide combat camera's stills (visual-pr-stills): Zone 1 at 375x812 as a guest, ready idle and then mid-fight against the nearest wolf, into <out dir>. `COMBATCAM=0` is the walking camera in a fight (the "before").
//   node scripts/combat-cam-stills.mjs <out dir> [portrait|landscape]    (landscape = 812x375)
// Serves artifacts/origins-preview (built here when missing). On the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/combat-cam-stills.sh [before]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const [out, shape = 'portrait'] = process.argv.slice(2), root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!out) throw new Error('usage: combat-cam-stills.mjs <out dir> [portrait|landscape]');
fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
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
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { shape, combatcam: process.env.COMBATCAM ?? 'default', errors: [] };
try {
  const ctx = await browser.newContext({ viewport: shape === 'landscape' ? { width: 812, height: 375 } : { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0${process.env.COMBATCAM === '0' ? '&combatcam=0' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(out, `ready-idle-${shape}.png`) });
  const target = await page.evaluate(() => { const l = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body); return l.find((m) => /wolf/i.test(m.body)) || l[0]; });
  receipt.target = { id: target.id, body: target.body };
  const near = async () => { const m = await page.evaluate((i) => { const x = window.originsPreview.mobs().mobs.find((q) => q.id === i); return x && [x.x, x.z]; }, target.id); await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 1.4, 0), m); };
  const hp = () => page.evaluate((i) => window.originsPreview.combat().fighters.find((f) => f.id === i)?.hp ?? null, target.id);
  for (let attempt = 0; attempt < 4 && (await hp()) === null; attempt++) {
    await near(); await page.waitForTimeout(1500); await page.evaluate((i) => window.originsPreview.tapMob(i), target.id);
    for (let k = 0; k < 32 && (await hp()) === null; k++) await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 15000 }).catch(() => {});
  receipt.infight = await page.evaluate(() => document.body.classList.contains('infight'));
  await page.waitForTimeout(6000);   // the camera eases in over about a second; the fight keeps going
  await page.screenshot({ path: path.join(out, `mid-fight-${shape}.png`) });
  receipt.view = await page.evaluate(() => (window.originsPreview.camView ? window.originsPreview.camView() : 'no camView'));
  fs.writeFileSync(path.join(out, `receipt-${shape}.json`), JSON.stringify(receipt, null, 2));
  console.log('combat-cam-stills ok', JSON.stringify(receipt));
} catch (error) {
  console.error('combat-cam-stills FAIL', JSON.stringify(receipt), error.message); process.exitCode = 1;
} finally { await browser.close(); server.close(); }
