// Which shader programs link at the first strike (the ~1.1 s of "(program)" in the fight profile, Dom: the phone stutters in a fight)? Phone tier, real GPU on the T4, optional CPU throttle.
// Usage: node scripts/strike-programs.mjs <built checkout root> <out json> [path+query]. REAL_GPU=1, CPU_RATE=4. Prints, per action (light, heavy, thrust, kick, the two special buttons): the programs linked since the last look (name#id + cache key head) and the long tasks it caused.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, outFile, pageArg] = process.argv.slice(2), RATE = Number(process.env.CPU_RATE || 1);
if (!root || !outFile) throw new Error('usage: strike-programs.mjs <checkout> <out json> [path?query]');
const built = path.join(root, 'artifacts/origins-preview');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts', 'preview']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null, best = -1;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p) && p.length > best) { best = p.length; hit = path.join(r, u.slice(p.length) || 'index.html'); }
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.METAL === '1' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE }), page = await ctx.newPage();
await page.addInitScript(() => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch { /* none */ } });
await page.route('**/*sentry.io/**', (route) => route.abort());
if (RATE !== 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: RATE });
await page.goto(`http://127.0.0.1:${server.address().port}${pageArg || '/preview/origins/?region=1&zone=1&presence=0'}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000, polling: 200 }).catch(() => {});
const readyMs = await page.evaluate(() => window.__zoneReady?.atMs ?? null);
console.log('RENDERER', await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; }), 'rate', RATE, 'ready', readyMs);
await page.waitForTimeout(4000);
const info = () => page.evaluate(() => { const r = window.originsPreview.renderInfo(); return { names: r.programNames, keys: r.programKeys }; });
const longs = () => page.evaluate(() => window.__long.slice());
let seen = new Set((await info()).names); const log = [{ step: 'at ready+4 s', programs: seen.size }];
const m = await page.evaluate(() => { const x = window.originsPreview.mobs()?.mobs?.find((q) => q.drawn && q.body); return x && { id: x.id, x: x.x, z: x.z }; });
if (!m) { console.log('no drawn creature to fight'); process.exit(2); }
await page.evaluate((q) => { window.originsPreview.place(q.x, q.z - 2.5, 0); window.originsPreview.tapMob(q.id); }, m);
for (let i = 0; i < 60 && !(await page.evaluate(() => document.body.classList.contains('infight'))); i++) await page.waitForTimeout(250);
await page.waitForTimeout(2500);
const step = async (label, act) => {
  const t0 = await page.evaluate(() => performance.now()), before = (await longs()).length;
  await act(); await page.waitForTimeout(2500);
  const now = await info(), fresh = now.names.filter((n) => !seen.has(n)), ls = (await longs()).slice(before).filter((l) => l.at >= t0 - 50);
  fresh.forEach((n) => seen.add(n));
  const row = { step: label, newPrograms: fresh.map((n) => `${n} :: ${now.keys[n] ?? ''}`), total: now.names.length, longTasks: ls.length, longMs: ls.reduce((a, l) => a + l.ms, 0), longMax: Math.max(0, ...ls.map((l) => l.ms)) };
  log.push(row); console.log(`STEP ${label}: +${fresh.length} programs (total ${row.total}), long tasks ${row.longTasks} / ${row.longMs} ms / max ${row.longMax}`); for (const n of row.newPrograms) console.log('    ', n.slice(0, 200));
};
await step('idle in the fight (no strike)', async () => {});
for (const kind of ['light', 'heavy', 'thrust', 'kick']) await step(`press ${kind}`, () => page.evaluate((k) => window.originsPreview.press(k), kind));
for (const label of ['WHIRLWIND', 'SKULL CRACK']) await step(`special ${label}`, async () => { const b = page.getByText(label, { exact: false }).first(); if (await b.count()) await b.click({ timeout: 3000, force: true }).catch(() => {}); });
fs.writeFileSync(outFile, JSON.stringify({ rate: RATE, readyMs, log }, null, 1));
await browser.close(); server.close();
