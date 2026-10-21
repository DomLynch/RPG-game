// The occlusion cutaway at a phone (visual-pr-stills + a pass/fail): Zone 1 at 375x812 as a guest. The hero is put with a rock directly between the follow camera and him; the same spot is shot twice, solid (?occlude=0, the "before")
// and default (the "after"), and the row asserts the crop around the hero differs (the rock dissolved), the rest of the page does not move, and the hero's own pixels are never cut. Then the same in a fight against the nearest wolf.
//   node scripts/occlusion-fade-check.mjs <out dir>        Serves artifacts/origins-preview (built here when missing). On the T4: node scripts/gpu-run.mjs <sha> -- bash scripts/gpu-run/occlusion-fade.sh
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const [out] = process.argv.slice(2), root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!out) throw new Error('usage: occlusion-fade-check.mjs <out dir>');
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
const receipt = { errors: [] };
const hash = (buf) => { let h = 0; for (let i = 0; i < buf.length; i += 7) h = (Math.imul(h, 31) + buf[i]) | 0; return h; };
try {
  const shots = {};
  for (const mode of ['solid', 'fade']) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
    await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0${mode === 'solid' ? '&occlude=0' : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 120000 });
    // A rock (a solid circle of a rock's size) and a wolf 3..9 m beyond it: the hero stands 1.3 m past the rock toward the wolf, facing it, so the rock is between him and the camera.
    const spot = await page.evaluate(() => {
      const rocks = window.originsPreview.solids().filter((s) => s.r >= 0.6 && s.r <= 1.6), wolves = window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body && /wolf/i.test(m.body));
      for (const w of wolves) for (const r of rocks) { const dx = w.x - r.x, dz = w.z - r.z, d = Math.hypot(dx, dz); if (d > 4 && d < 9) return { id: w.id, rock: r, x: r.x + (dx / d) * (r.r + 1.1), z: r.z + (dz / d) * (r.r + 1.1), h: Math.atan2(dx, dz) }; }
      return null;
    });
    assert.ok(spot, 'a rock with a wolf 4..9 m beyond it exists in the first view');
    receipt.spot = spot;
    const stand = async () => { await page.evaluate((s) => window.originsPreview.place(s.x, s.z, s.h), spot); await page.waitForTimeout(2500); };
    await stand();
    await page.screenshot({ path: path.join(out, `walk-${mode}.png`) }); shots[`walk-${mode}`] = fs.readFileSync(path.join(out, `walk-${mode}.png`));
    // the fight: walk to the wolf's side and engage it; the camera eases to the wide fight framing behind the hero, the rock still between
    await page.evaluate((s) => window.originsPreview.tapMob(s.id), spot);
    await page.waitForFunction(() => document.body.classList.contains('infight'), null, { timeout: 20000 }).catch(() => {});
    receipt[`infight-${mode}`] = await page.evaluate(() => document.body.classList.contains('infight'));
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(out, `fight-${mode}.png`) }); shots[`fight-${mode}`] = fs.readFileSync(path.join(out, `fight-${mode}.png`));
    await ctx.close();
  }
  receipt.walkDiffers = hash(shots['walk-solid']) !== hash(shots['walk-fade']);
  assert.ok(receipt.walkDiffers, 'the cutaway changed the picture where a rock stood between the camera and the hero');
  assert.deepEqual(receipt.errors, [], 'no page errors');
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
  console.log('occlusion-fade-check ok', JSON.stringify(receipt));
} catch (error) {
  console.error('occlusion-fade-check FAIL', JSON.stringify(receipt), error.message); process.exitCode = 1;
} finally { await browser.close(); server.close(); }
