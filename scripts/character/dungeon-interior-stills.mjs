// Bone Hollow interior stills at 375 wide (software GL): the gate arrival, the hall, the den room with its bone piles, the east doorway. Same server/launch as scripts/zone-exit-check.mjs.
// Usage (repo checkout with node_modules and the origins preview built): node scripts/character/dungeon-interior-stills.mjs <dist> <out dir>
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), root = process.cwd();
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
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
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=5`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady && window.originsPreview, null, { timeout: 240000 });
  await page.waitForTimeout(6000);
  const lm = await page.evaluate(() => Object.fromEntries(window.originsPreview.region().zones.flatMap((z) => Object.entries(z.landmarks))));
  fs.writeFileSync(path.join(out, 'landmarks.json'), JSON.stringify(lm, null, 1));
  const H = Number(process.env.HEADING_E ?? Math.PI / 2);   // heading that looks east (+x) from the gate; override if the stills face the wrong way
  const shots = [   // name, x, z, heading
    ['01-gate-arrival', lm['hollow-gate'].x + 3, lm['hollow-gate'].z, H],
    ['02-gate-doorway-from-inside', lm['hollow-gate'].x + 9, lm['hollow-gate'].z, H + Math.PI],   // looking west back at the doorway and its two lanterns
    ['03-hall', lm['hollow-hall'].x, lm['hollow-hall'].z, H],
    ['04-den-piles', lm['hollow-den'].x - 11, lm['hollow-den'].z, H],
    ['05-den-piles-close', lm['hollow-den'].x - 10, lm['hollow-den'].z - 3, H - 0.3],
    ['06-east-doorway', lm['hollow-den'].x - 3, lm['hollow-den'].z, H],   // the doorway at the end of the room and its lanterns
  ];
  for (const [name, x, z, h] of shots) {
    await page.evaluate(([px, pz, ph]) => window.originsPreview.place(px, pz, ph), [x, z, h]);
    await page.waitForTimeout(Number(process.env.SETTLE_MS ?? 1200));   // short: a longer wait lets the hero be aggroed and drawn off the mark
    await page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 });
  }
  console.log('stills:', shots.length, 'errors:', errors.length, errors.slice(0, 2));
} finally { await browser.close(); server.close(); }
