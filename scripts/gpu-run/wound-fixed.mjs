// Zone fight still at a FIXED clock and a SEEDED Math.random: node wound-fixed.mjs <build root> <label> <out dir>
// The page clock is Playwright's fake clock (installed before load, advanced only by runFor), Math.random is mulberry32(SEED), so base and after reach the same
// sim frame: stills are taken at the same clock offset after the hero taps the scavenger. REAL_GPU=1 for the machine's own GPU.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, label, outDir] = process.argv.slice(2);
const SEED = Number(process.env.SEED || 12345), CLOCK0 = 1_700_000_000_000, FRAME_MS = 1000 / 60, SHOT_AT = (process.env.SHOT_AT || '5600,8400').split(',').map(Number);
fs.mkdirSync(outDir, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${process.cwd()}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript((seed) => { let a = seed >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
await page.clock.install({ time: CLOCK0 });
await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
// Page time moves only here: one frame per call, with a short real pause so network and decode can land. waitReal polls a page predicate.
const waitReal = async (pred, limitMs) => { const t0 = Date.now(); for (;;) { if (await page.evaluate(pred)) return; if (Date.now() - t0 > limitMs) throw new Error('timeout'); await page.clock.runFor(FRAME_MS * 3); await new Promise((r) => setTimeout(r, 15)); } };
await waitReal(() => window.originsPreview?.mobs?.()?.mobs?.length > 0, 240000);
for (let i = 0; i < 25000 / FRAME_MS / 10; i++) { await page.clock.runFor(FRAME_MS * 10); if (i % 20 === 0) await new Promise((r) => setTimeout(r, 5)); }
const foe = await page.evaluate(() => { const rx = /scaveng/i; const ms = window.originsPreview.mobs().mobs.filter((m) => rx.test(m.id)); const cx = ms.reduce((s, b) => s + b.x, 0) / ms.length, cz = ms.reduce((s, b) => s + b.z, 0) / ms.length; const t = ms.sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz))[0]; window.originsPreview.place(t.x, t.z - 1.5, 0); return t.id; });
await page.clock.runFor(1500);
await page.evaluate((id) => window.originsPreview.tapMob(id), foe);
let t = 0, shots = 0;
for (let i = 0; i < 20; i++) {
  await page.evaluate(() => window.originsPreview.press?.('light'));
  const until = (i + 1) * 700;
  while (t < until) {
    const next = SHOT_AT.find((s) => s > t && s <= until);
    const stepTo = next ?? until;
    await page.clock.runFor(stepTo - t); t = stepTo;
    if (next !== undefined && t === next) { await page.screenshot({ path: path.join(outDir, `${label}-wound-t${t}.jpg`), type: 'jpeg', quality: 82 }); shots++; }
  }
}
console.log(`FIXED ${label}: seed ${SEED} clock0 ${CLOCK0} stills at +${SHOT_AT.join(',')} ms after the first strike (${shots} taken)`);
await browser.close(); server.close();
