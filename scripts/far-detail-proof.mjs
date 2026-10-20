// #item C proof (phone tier, 375): far creatures draw the rank-look body only, near ones wear it all, and the bare Skin face check.
// Usage: node scripts/far-detail-proof.mjs <built checkout root> <out dir>   (REAL_GPU=1 on the T4)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function run(label, query) {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 });
  const camp = await page.evaluate(() => { const ms = window.originsPreview.mobs().mobs, g = ms.filter((m) => /scaveng/i.test(m.id)); const gg = g.length ? g : ms; return { x: gg.reduce((s, b) => s + b.x, 0) / gg.length, z: gg.reduce((s, b) => s + b.z, 0) / gg.length }; });
  const tally = async (tag) => page.evaluate((t) => { const rows = window.originsPreview.mobs().meshesOf.filter((r) => r.rows.some((x) => /L\d+_Body/.test(x))); const drawnVerts = (r) => r.rows.filter((x) => x.startsWith('skin') && !x.includes('(hidden)')).reduce((n, x) => n + Number(/ v(\d+)$/.exec(x)?.[1] ?? 0), 0); const hiddenPieces = (r) => r.rows.filter((x) => /L\d+_(Arms|Gloves|Greaves|Helmet)/.test(x) && x.includes('(hidden)')).length; const skinShown = (r) => r.rows.some((x) => / Skin /.test(x) && !x.includes('(hidden)')); return `${t}: ${rows.length} ranked creatures, skinned verts drawn each ${rows.map(drawnVerts).join('/')}, pieces hidden each ${rows.map(hiddenPieces).join('/')}, bare Skin shown ${rows.map(skinShown).join('/')}`; }, tag);
  await page.evaluate((c) => window.originsPreview.place(c.x, c.z - 30, 0), camp); await page.waitForTimeout(5000);
  console.log(label, await tally('FAR 30 m'));
  await page.evaluate((c) => window.originsPreview.place(c.x, c.z - 3, 0), camp); await page.waitForTimeout(6000);
  console.log(label, await tally('NEAR 3 m'));
  await page.screenshot({ path: path.join(out, `${label}-near.png`), timeout: 240000 });
  const foe = await page.evaluate((c) => { const ms = window.originsPreview.mobs().mobs.filter((m) => /scaveng/i.test(m.id)).sort((a, b) => Math.hypot(a.x - c.x, a.z - (c.z - 3)) - Math.hypot(b.x - c.x, b.z - (c.z - 3))); return ms[0]?.id ?? null; }, camp);
  if (foe) { await page.evaluate((id) => window.originsPreview.tapMob(id), foe); for (let i = 0; i < 40 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(out, `${label}-fight.png`), timeout: 240000 }); }   // the fight camera: the creature's face and armour at close range
  if (errors.length) console.log(label, 'PAGEERRORS', errors.join(' | '));
  await page.context().close();
}
try { await run('skin-on', ''); await run('skin-off', '&skinhide=1'); } finally { await browser.close(); server.close(); }
