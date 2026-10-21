// Before/after stills for the weapon PNG -> WebP PR (phone tier, 375 at dpr 2): the hero holding the bow, and a scavenger's crafted gladius in the fight camera. The page is one build; the two weapon files are served from a `before` or the repo's own `after` copy.
// Usage: node scripts/weapon-webp-stills.mjs <built checkout root> <before dir with weapons/shapes/gladius-crafted.glb and weapons/ranged/bow-v1.glb> <out dir>   (software GL is fine: it is a look comparison)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, beforeDir, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
let variant = 'after';
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (variant === 'before' && /^\/weapons\/(shapes\/gladius-crafted|ranged\/bow-v1)\.glb$/.test(u)) hit = path.join(beforeDir, u.slice(1));
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const requested = [];
async function run(label) {
  variant = label;
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('response', (r) => { if (/gladius-crafted|bow-v1/.test(r.url())) requested.push(`${label} ${r.status()} ${r.url().split('/').pop()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => { try { return window.originsPreview?.mobs()?.meshesOf?.some((r) => r.rows.some((x) => /L\d+_Body/.test(x))); } catch { return false; } }, null, { timeout: 420000, polling: 2000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.originsPreview.forceWeapon('bow')); await page.waitForTimeout(6000);   // the hero draws the bow (loadRangedPart)
  await page.screenshot({ path: path.join(out, `${label}-bow.png`), timeout: 240000 });
  await page.evaluate(() => window.originsPreview.forceWeapon(null));
  const foe = await page.evaluate(() => { const ids = window.originsPreview.mobs().meshesOf.filter((r) => r.rows.some((x) => /L\d+_Body/.test(x))).map((r) => r.id); const m = window.originsPreview.mobs().mobs.find((b) => ids.some((i) => b.id.endsWith(i))); if (!m) return null; window.originsPreview.place(m.x, m.z - 2.5, 0); return m.id; });
  await page.waitForTimeout(2500);
  if (foe) { await page.evaluate((id) => window.originsPreview.tapMob(id), foe); for (let i = 0; i < 60 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250); await page.waitForTimeout(2500); }
  await page.screenshot({ path: path.join(out, `${label}-gladius-fight.png`), timeout: 240000 });
  if (errors.length) console.log(label, 'PAGEERRORS', errors.join(' | '));
  await page.context().close();
}
try { await run('before'); await run('after'); console.log('REQUESTED', requested.join(' ; ')); } finally { await browser.close(); server.close(); }
