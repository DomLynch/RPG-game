// Creature bare-body item (a): face close-up stills, the bare Skin drawn vs hidden (`?skinhide=1`), phone tier, a ranked goblin at ~1.5 m (the fight camera, as close as a player gets) and at 4 m, at 375x812 and 844x390; plus one still each of a giant salamander and a cave troll at 6 m.
// Usage: node scripts/bare-skin-stills.mjs <built checkout root> <out dir>   (REAL_GPU=1 on a real GPU; PLAYWRIGHT_BROWSERS_PATH for the browser)
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
const port = server.address().port;
const VIEWS = [['p375', { width: 375, height: 812 }], ['l844', { width: 844, height: 390 }]];
async function session(label, viewport, query, steps) {
  const page = await (await browser.newContext({ viewport, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('response', (r) => { if (r.status() >= 400) console.log(label, r.status(), r.url().slice(0, 140)); });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || /zone ready/.test(m.text())) console.log(label, 'console:', m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${port}/preview/origins/?region=1&zone=1&presence=0${query}`, { waitUntil: 'load' });
  // Real GPU in headless Chromium on the Mac: the page's warm-up can stick ("warmup stuck player") and [zone ready] never fires, so wait for the creatures instead and give the models time to land.
  await page.waitForFunction(() => window.originsPreview?.mobs?.()?.mobs?.length > 0, null, { timeout: 240000 });
  await page.waitForTimeout(25000);
  // stand `d` metres south of the creature (matching `re`) nearest the camp's middle, and say which one
  const standAt = (re, d) => page.evaluate(([src, dist]) => { const rx = new RegExp(src, 'i'); const ms = window.originsPreview.mobs().mobs.filter((m) => rx.test(m.id)); if (!ms.length) return null; const cx = ms.reduce((s, b) => s + b.x, 0) / ms.length, cz = ms.reduce((s, b) => s + b.z, 0) / ms.length; const t = ms.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0]; window.originsPreview.place(t.x, t.z - dist, 0); return t.id; }, [re, d]);
  const skinDrawn = () => page.evaluate(() => window.originsPreview.mobs().meshesOf.filter((r) => r.rows.some((x) => /L\d+_Body/.test(x))).map((r) => r.rows.filter((x) => /^skin/.test(x) && /Skin/.test(x)).join(',')));
  await steps({ page, standAt, skinDrawn, shot: (name) => page.screenshot({ path: path.join(out, `${label}-${name}.png`), timeout: 240000 }) });
  if (errors.length) console.log(label, 'PAGEERRORS', errors.join(' | '));
  await page.context().close();
}
try {
  for (const [vname, viewport] of VIEWS) for (const [sname, query] of [['skin-on', ''], ['skin-off', '&skinhide=1']]) {
    await session(`${vname}-${sname}`, viewport, query, async ({ page, standAt, skinDrawn, shot }) => {
      console.log(vname, sname, '4 m from', await standAt('scaveng', 4)); await page.waitForTimeout(6000);
      console.log(vname, sname, 'Skin rows drawn:', JSON.stringify(await skinDrawn())); await shot('4m');
      const foe = await standAt('scaveng', 1.5); await page.waitForTimeout(2000);
      await page.evaluate((id) => window.originsPreview.tapMob(id), foe);
      for (let i = 0; i < 40 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
      await page.waitForTimeout(2500); await shot('face-fight');   // the fight camera: the closest a player gets to the face
    });
  }
  for (const [name, re] of [['salamander', 'salamander'], ['troll', 'troll']]) {
    await session(`p375-${name}`, VIEWS[0][1], '', async ({ page, standAt, shot }) => {
      console.log(name, '6 m from', await standAt(re, 6)); await page.waitForTimeout(6000); await shot('6m');
    });
  }
} finally { await browser.close(); server.close(); }
