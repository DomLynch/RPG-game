// Seamless Zone 1 combat gates (#1758 / TOP10 "Row 1 - seamless Zone 1 combat"), on the built origins preview with ?region=1&worldfight:
//   no swap at engage: one canvas before and after the tap, the page's canvas stays shown, body.infight is set
//   world live during the fight: the creatures other than the foe keep moving while the duel draws
//   engage hitch budget: the worst frame gap from the tap on is at most max(200 ms, 4x the walk's median gap): a first number to tighten (software GL runs ~3 fps, so the floor alone could never hold there)
// Serves artifacts/origins-preview (built here when missing). Exit 1 with the numbers on a miss; a receipt goes to artifacts/origins-seamless.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit' });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, physicalPhone: false, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${origin}/preview/origins/?region=1&worldfight`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
  const target = await page.evaluate(() => window.originsPreview.mobs().mobs.find((m) => m.drawn && m.body));
  const moved = async (ms) => {
    const read = () => page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, x: m.x, z: m.z })));
    const a = await read(); await page.waitForTimeout(ms); const c = await read();
    return c.filter((o) => { const q = a.find((x) => x.id === o.id); return q && o.id !== target.id && Math.hypot(o.x - q.x, o.z - q.z) > 0.05; }).length;
  };
  receipt.walkMoved = await moved(10000);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]);
  await page.waitForTimeout(25000);   // the walk: the stage of the nearest creature is built meanwhile (pit-duel warmStage)
  await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.waitForTimeout(6000);
  const walkGaps = (await page.evaluate(() => window.__gaps.slice())).slice(0, -1);
  const canvasesBefore = await page.evaluate(() => document.querySelectorAll('canvas').length);
  await page.evaluate(() => { window.__gaps = []; });
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => window.originsPreview.duel()?.ready)) break; }
  receipt.fightMoved = await moved(10000);
  const after = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, shown: !document.querySelector('canvas')?.hidden, infight: document.body.classList.contains('infight'), gaps: window.__gaps.slice() }));
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0, worst = Math.max(...after.gaps.slice(0, -1), 0);
  receipt.noSwap = { canvasesBefore, canvasesAfter: after.canvases, canvasShown: after.shown, infight: after.infight };
  receipt.hitch = { walkMedianGapMs: Math.round(median(walkGaps)), worstGapMs: Math.round(worst), budgetMs: Math.round(Math.max(200, 4 * median(walkGaps))) };
  assert.equal(after.canvases, canvasesBefore, 'no swap at engage: the canvas count changed');
  assert.ok(after.shown && after.infight, 'no swap at engage: the page canvas must stay shown with body.infight set');
  assert.ok(receipt.fightMoved >= Math.max(1, Math.floor(receipt.walkMoved / 2)), `world live during the fight: ${receipt.fightMoved} creatures moved, ${receipt.walkMoved} did on the walk`);
  assert.ok(worst <= receipt.hitch.budgetMs, `engage hitch: worst frame gap ${Math.round(worst)} ms over the budget ${receipt.hitch.budgetMs} ms`);
  assert.deepEqual(receipt.errors, []);
  console.log('origins-seamless: PASS', JSON.stringify(receipt));
} catch (error) { console.error('origins-seamless: FAIL', String(error.message ?? error), JSON.stringify(receipt)); process.exitCode = 1; }
finally { fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/origins-seamless.json', JSON.stringify(receipt, null, 2)); await browser.close(); server.close(); }
