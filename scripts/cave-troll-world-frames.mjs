// Cave Troll in-game animation frames (375 wide, software GL): idle on the walk, then a fight driven with originsPreview.press('light'), a frame every ~600 ms with the duel state beside it.
// Usage (repo checkout, node_modules, built dist): node troll-anim.mjs <dist> <out dir> [x z]   default x z = -145.9 -2.2 (World's troll-cave landmark)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out, ax, az] = process.argv.slice(2), root = process.cwd(), X = Number(ax ?? -145.9), Z = Number(az ?? -2.2);
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
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
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1`, { waitUntil: 'load' });
  const logs = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  try { await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 120000 }); }
  catch (e) {
    console.log('WAIT FAILED', page.url(), 'errors', JSON.stringify(errors.slice(0, 4)), 'console', JSON.stringify(logs.slice(0, 8)));
    console.log(JSON.stringify(await page.evaluate(() => ({ has: !!window.originsPreview, mobs: window.originsPreview?.mobs()?.mobs?.slice(0, 6).map((m) => ({ n: m.name, d: m.drawn, b: m.body, model: m.model })) ?? null, title: document.title, body: document.body.innerText.slice(0, 200) }))));
    await page.screenshot({ path: path.join(out, 'diag.png') }); process.exit(2);
  }
  const frames = [];
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${name}.png`), timeout: 240000 }); const s = await page.evaluate(() => window.originsPreview.duel()); frames.push({ name, phase: s?.phase ?? null, hp: s?.playerHealth ?? null, foe: s?.health ?? null, gap: s ? +s.gap.toFixed(2) : null, finish: s?.finish ?? null }); };
  const all = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, n: m.name, x: +m.x.toFixed(1), z: +m.z.toFixed(1), d: m.drawn, b: m.body })));
  console.log('creatures:', all.length, JSON.stringify(all.filter((m) => /troll/i.test(m.n + m.id))), 'bodies:', JSON.stringify([...new Set(all.map((m) => m.b))]));
  const troll = all.find((m) => /troll/i.test(m.n + m.id));
  if (!troll) { console.log('NO TROLL in the creature list; first six:', JSON.stringify(all.slice(0, 6))); await page.screenshot({ path: path.join(out, 'no-troll.png') }); process.exit(3); }
  const TX = troll.x, TZ = troll.z;
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 7, 0), [TX, TZ]);
  await page.waitForFunction(() => window.originsPreview.mobs().mobs.some((m) => /troll/i.test(m.name + m.id) && m.drawn && m.model), null, { timeout: 240000 }).catch(() => {});
  await page.waitForTimeout(8000);
  // The troll roams: re-aim the hero at where it stands NOW, 11 m south, so the idle frame centres it (the first cut was off-centre).
  await page.evaluate(() => { const t = window.originsPreview.mobs().mobs.find((m) => /troll/i.test(m.name + m.id)); window.originsPreview.place(t.x, t.z - 7, 0); });
  await page.waitForTimeout(6000);
  await shot('f00-idle-walk');
  if (process.env.IDLE_ONLY) { console.log('frames: 1 errors:', errors.length, errors.slice(0, 2)); await browser.close(); server.close(); process.exit(0); }
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [TX, TZ]);
  for (let i = 0; i < 80 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(1500);
  let n = 1;
  const inFight = () => page.evaluate(() => document.body.classList.contains('infight'));
  for (let k = 0; k < 80; k++) {
    await page.evaluate((i) => window.originsPreview.press(i % 5 === 4 ? 'heavy' : 'light'), k);
    await page.waitForTimeout(350);
    await shot(`f${String(n++).padStart(2, '0')}`);
    frames[frames.length - 1].infight = await inFight();
    if (k >= 6 && !frames[frames.length - 1].infight) { await page.waitForTimeout(1500); await shot(`f${String(n++).padStart(2, '0')}-end`); break; }
  }
  fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(frames, null, 1));
  console.log('frames:', frames.length, 'errors:', errors.length, errors.slice(0, 2));
  console.log(frames.map((f) => `${f.name} ${f.phase} hp=${f.hp} foe=${f.foe} gap=${f.gap} ${f.finish ?? ''} infight=${f.infight}`).join('\n'));
} finally { await browser.close(); server.close(); }
