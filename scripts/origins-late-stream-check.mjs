// A model that streams into the scene AFTER the upload plan's last clean look must hold [zone ready] until it is uploaded (seamless-quiet: a creature weapon's Leather and WeatheredStone linked at the engage).
// Deterministic version of the race: ?holdCompile=1 keeps the scene-material compiles open, so the plan's last look is clean while programsInFlight > 0; originsPreview.injectLate() then adds one fresh mesh and
// freezes the 3 s re-plan (only zoneReadyCheck can still see it); releaseCompiles() lets the zone go ready. Pass = at [zone ready] the late material is already uploaded. Exit 1 otherwise.
// Serves artifacts/origins-preview (built here when missing); receipt to artifacts/origins-late-stream.json.
import { launchBrowser } from './lib/browser-launch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview');
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
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
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, errors: [] };
let failed = null;
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(`${origin}/preview/origins/?region=1&zone=${process.env.LATE_ZONE || '1'}&holdCompile=1`, { waitUntil: 'load' });
  // The window: the plan is drained, its last look was clean, the compiles are still held open.
  await page.waitForFunction(() => { const s = window.originsPreview?.lateState?.(); return s && s.settled && s.clean && s.inFlight > 0 && window.originsPreview.uploadLeft() === 0; }, null, { timeout: 180000, polling: 100 })
    .catch(() => { throw new Error('the plan never reached a clean look with compiles in flight'); });
  receipt.before = await page.evaluate(() => ({ ...window.originsPreview.lateState(), ready: !!window.__zoneReady }));
  assert.equal(receipt.before.ready, false, 'zone ready fired while the compiles were held');
  await page.evaluate(() => window.originsPreview.injectLate());
  await page.evaluate(() => window.originsPreview.releaseCompiles());
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }).catch(() => { throw new Error('zone never ready after the compiles were released'); });
  receipt.atReady = await page.evaluate(() => window.originsPreview.lateState());
  assert.equal(receipt.atReady.uploaded, true, '[zone ready] fired with a model that streamed in after the last look still un-uploaded (it would link at the engage)');
  assert.equal(receipt.errors.length, 0, `page errors: ${receipt.errors.join(' | ')}`);
} catch (e) { failed = e; receipt.failure = String(e.message ?? e); }
finally {
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/origins-late-stream.json'), JSON.stringify(receipt, null, 2));
  await browser.close(); server.close();
}
console.log(JSON.stringify(receipt));
if (failed) { console.error(`FAIL: ${receipt.failure}`); process.exit(1); }
console.log('PASS: zone ready waited for the late model');
