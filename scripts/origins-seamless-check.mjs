// Seamless Zone 1 combat gates (#1758 / TOP10 "Row 1 - seamless Zone 1 combat"), on the built origins preview, ?region=1&zone=N (SEAMLESS_ZONE, default 1), through the engine's own combat loop (the plain engage: a tap on a creature, no Pit duel):
//   no swap at engage: one canvas before and after the tap, the page's canvas stays shown, body.infight is set
//   world live during the fight: the creatures other than the foe keep moving while the duel draws
//   engage hitch budget (4x the walk's median on software GL, PROVISIONAL until the Mac Metal / real-device reading; a real GPU gets the 200 ms floor): the worst frame gap from the tap on is at most max(200 ms, 4x the walk's median gap) in the first 5 s after the tap: a first number to tighten (software GL runs ~3 fps, so the floor alone could never hold there)
// Serves artifacts/origins-preview (built here when missing). Exit 1 with the numbers on a miss; a receipt goes to artifacts/origins-seamless.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
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
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, physicalPhone: false, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  const zone = process.env.SEAMLESS_ZONE || '1';   // the zone page to run (the pageZoneId ?zone=N fallback): Zone 2 is data, so the same gate must pass on it
  await page.goto(`${origin}/preview/origins/?region=1&zone=${zone}`, { waitUntil: 'load' });
  const want = process.env.SEAMLESS_TARGET || '';   // a creature id to engage (default: the first drawn one), e.g. bounty-shrine-1 or wolves-1
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
  const target = await page.evaluate((id) => window.originsPreview.mobs().mobs.find((m) => (id ? m.id === id : m.drawn && m.body)), want);
  assert.ok(target, `no creature ${want}`); receipt.zone = zone; receipt.target = { id: target.id, body: target.body };
  const moved = async (ms) => {
    const read = () => page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, x: m.x, z: m.z })));
    const a = await read(); await page.waitForTimeout(ms); const c = await read();
    return c.filter((o) => { const q = a.find((x) => x.id === o.id); return q && o.id !== target.id && Math.hypot(o.x - q.x, o.z - q.z) > 0.05; }).length;
  };
  await page.waitForTimeout(8000);   // let the walk settle before the control reading
  receipt.walkMoved = await moved(10000);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [target.x, target.z]);
  await page.waitForTimeout(25000);   // the walk: the creatures near him settle and the zone warms up meanwhile
  await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.waitForTimeout(6000);
  const walkGaps = (await page.evaluate(() => window.__gaps.slice())).slice(0, -1);
  const canvasesBefore = await page.evaluate(() => document.querySelectorAll('canvas').length);
  await page.evaluate(() => { window.__gaps = []; });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }).catch(() => { throw new Error('zone never ready: [zone ready] (window.__zoneReady) did not fire'); });   // a regression that breaks zone-ready must fail the row, never skip it
  const namesBefore = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
  receipt.programsBeforeTap = namesBefore.length;
  // The target roams while the walk and [zone ready] run (31 s+): put the hero 2.5 m from where it is NOW, so the tap is in reach (Zone 1 refuses a tap past 3.5 m).
  { const at = await page.evaluate((id) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === id); return m && [m.x, m.z]; }, target.id); assert.ok(at, `${target.id} is gone before the tap`); await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), at); }
  await page.evaluate((id) => window.originsPreview.tapMob(id), target.id);
  // The engage: the engine's own combat loop sets body.infight the frame it is in combat (main.ts, wc.inCombat()). Read the engage THEN, bounded at 15 s; a miss fails below on infight, with the receipt.
  await page.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 15000 }).catch(() => {});
  const engaged = await page.evaluate(() => ({ canvases: document.querySelectorAll('canvas').length, shown: !document.querySelector('canvas')?.hidden, infight: document.body.classList.contains('infight') }));
  receipt.fightMoved = await moved(10000);   // also the program window: the engage plus the first 10 s of the fight (a first hit's sparks compile then), the same on every run
  const namesAfter = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
  receipt.programsAfterEngage = namesAfter.length; receipt.newPrograms = namesAfter.filter((n) => !namesBefore.includes(n));
  { const keys = await page.evaluate(() => window.originsPreview.renderInfo().programKeys); receipt.newProgramKeys = Object.fromEntries(receipt.newPrograms.map((n) => [n, keys[n]])); }   // WHICH programs compile at the engage (each one is a stall)
  const after = { ...engaged, gaps: await page.evaluate(() => window.__gaps.slice()) };
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
  let clock = 0; const engageGaps = after.gaps.slice(0, -1).filter((g) => (clock += g) <= 5000), worst = Math.max(...engageGaps, 0);   // the engage is the first 5 s after the tap; later long frames are the fight, not the engage
  receipt.noSwap = { canvasesBefore, canvasesAfter: after.canvases, canvasShown: after.shown, infight: after.infight };
  receipt.gapsAfterTapMs = after.gaps.slice(0, -1).map((g) => Math.round(g));   // in order from the tap: shows WHEN the long frame is (the attach, the first draw, or the harness's own reads)
  receipt.hitch = { walkMedianGapMs: Math.round(median(walkGaps)), worstGapMs: Math.round(worst), budgetMs: Math.round(Math.max(200, 4 * median(walkGaps))) };
  assert.equal(after.canvases, canvasesBefore, 'no swap at engage: the canvas count changed');
  assert.ok(after.shown && after.infight, 'no swap at engage: the page canvas must stay shown with body.infight set');
  assert.ok(receipt.fightMoved >= Math.max(1, Math.floor(receipt.walkMoved / 2)), `world live during the fight: ${receipt.fightMoved} creatures moved, ${receipt.walkMoved} did on the walk`);
  // Frame gaps mean nothing on software GL (SwiftShader runs ~3 fps and a loaded runner adds 600-3000 ms): the 200 ms bar is measured on Mac Metal with scripts/origins-engage-warmup.mjs (#1927). Here, on software GL, the row asserts what does not depend on speed: the engage compiles no program once [zone ready] has fired.
  receipt.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'n/a'; });
  receipt.zoneReady = await page.evaluate(() => window.__zoneReady ?? null);
  receipt.hitch.enforced = !/swiftshader|llvmpipe|software/i.test(receipt.renderer);
  if (receipt.hitch.enforced) assert.ok(worst <= receipt.hitch.budgetMs, `engage hitch: worst frame gap ${Math.round(worst)} ms over the budget ${receipt.hitch.budgetMs} ms`);
  else assert.deepEqual(receipt.newPrograms, [], 'engage compiled programs after [zone ready]');
  assert.deepEqual(receipt.errors, []);
  console.log('origins-seamless: PASS', JSON.stringify(receipt));
} catch (error) { console.error('origins-seamless: FAIL', String(error.message ?? error), JSON.stringify(receipt)); process.exitCode = 1; }
finally { fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/origins-seamless.json', JSON.stringify(receipt, null, 2)); await browser.close(); server.close(); }
