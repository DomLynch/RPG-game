// Pit finisher-signature burst at a FIXED clock and a SEEDED Math.random: node pit-sig-fixed.mjs <dist dir> <out dir> <prefix>. REAL_GPU=1 for the machine's own GPU.
// ?signature=on only counts with the test tools open (?debug). Playwright's fake clock moves only by runFor, so base and after see the same sim frame at the same step.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out, prefix] = process.argv.slice(2), FRAMES = Number(process.env.FRAMES || 40), STEP_MS = 450, SEED = Number(process.env.SEED || 12345), CLOCK0 = 1_700_000_000_000, FRAME_MS = 1000 / 60;
fs.mkdirSync(out, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = path.join(dist, u === '/' ? 'index.html' : u);
  if (fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 })).newPage();
await page.route('**/*sentry.io/**', (route) => route.abort());
await page.addInitScript((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
await page.clock.install({ time: CLOCK0 });
await page.goto(`http://127.0.0.1:${server.address().port}/?opponent=goblin&spar=1&weapon=longsword&difficulty=1&skill=none&signature=on&debug=1`, { waitUntil: 'load' });
const t0 = Date.now();
for (;;) {
  if (await page.evaluate(() => performance.getEntriesByType('mark').some((m) => m.name.startsWith('first-frame-') && m.name !== 'first-frame-begin') && !document.getElementById('art-status')?.textContent)) break;
  if (Date.now() - t0 > 240000) throw new Error('never reached first frame');
  await page.clock.runFor(FRAME_MS); await new Promise((r) => setTimeout(r, 10));
}
await page.keyboard.down('KeyW');
for (let i = 0; i < FRAMES; i++) {
  for (let k = 0; k < 2; k++) { await page.keyboard.press('KeyF'); await page.clock.runFor(STEP_MS / 2); }
  await page.screenshot({ path: path.join(out, `${prefix}-${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 55 });
}
await page.keyboard.up('KeyW');
console.log(`FIXED ${prefix}: seed ${SEED} clock0 ${CLOCK0} frames ${FRAMES} every ${STEP_MS} ms after first frame`);
await browser.close(); server.close();
