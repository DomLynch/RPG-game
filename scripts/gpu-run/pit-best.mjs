// Pit spar stills: node pit-best.mjs <dist dir> <out dir> <prefix>; MODE=phone|desktop, FRAMES, STEP_MS, REAL_GPU=1. The hero walks in and strikes; one small jpeg every STEP_MS (device scale 1 to keep the artifacts small).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out, prefix] = process.argv.slice(2), FRAMES = Number(process.env.FRAMES || 30), STEP_MS = Number(process.env.STEP_MS || 500), MODE = process.env.MODE || 'phone';
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
const page = await (await browser.newContext(MODE === 'phone' ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 800 } })).newPage();
await page.route('**/*sentry.io/**', (route) => route.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/?opponent=goblin&spar=1&weapon=longsword&difficulty=1&skill=none`, { waitUntil: 'load' });
await page.waitForFunction(() => performance.getEntriesByType('mark').some((m) => m.name.startsWith('first-frame-') && m.name !== 'first-frame-begin') && !document.getElementById('art-status')?.textContent, null, { timeout: 240000, polling: 50 });
await page.keyboard.down('KeyW');
for (let i = 0; i < FRAMES; i++) { for (let k = 0; k < 2; k++) { await page.keyboard.press('KeyF'); await new Promise((r) => setTimeout(r, STEP_MS / 2)); } await page.screenshot({ path: path.join(out, `${prefix}-${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 60 }); }
await page.keyboard.up('KeyW');
await browser.close(); server.close();
console.log('frames', FRAMES, 'into', out);
