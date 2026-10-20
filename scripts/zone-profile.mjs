// Who owns the main thread on the Zone 1 page? A CDP CPU profile (1 ms sampling) over the same 20 s of walking plus one fight as scripts/live-regress.mjs, on an UNMINIFIED build so function names read.
// Output: self time and inclusive time by function (top N), self time by script file, the idle / GC / program shares, and the long tasks. Usage: node scripts/zone-profile.mjs <checkout> <label> <out dir> [path+query]. REAL_GPU=1, CPU_RATE=4.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, label, out, pageArg] = process.argv.slice(2), RATE = Number(process.env.CPU_RATE || 1), WINDOW_MS = Number(process.env.WINDOW_MS || 20000), TOP = Number(process.env.TOP || 35);
if (!root || !label || !out) throw new Error('usage: zone-profile.mjs <checkout> <label> <out dir> [path?query]');
fs.mkdirSync(out, { recursive: true });
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
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';   // the page's phone tier (src/fight/quality.ts detectPhoneTier) needs a mobile UA AND a coarse pointer; isMobile alone leaves a desktop UA
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE }), page = await ctx.newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
await page.route('**/*sentry.io/**', (route) => route.abort());
const cdp = await ctx.newCDPSession(page);
if (RATE !== 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
await page.addInitScript(() => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch { /* none */ } });
await page.goto(`${origin}${pageArg || '/preview/origins/?region=1&zone=1&presence=0'}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000, polling: 100 }).catch(() => {});
const readyMs = await page.evaluate(() => window.__zoneReady?.atMs ?? null);
console.log('ENV', JSON.stringify(await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, ua: navigator.userAgent.slice(0, 40), dpr: devicePixelRatio, shadowMap: window.__shadowMapSize ?? null }))));
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start');
const longBefore = await page.evaluate(() => window.__long.length);
const walkEnd = Date.now() + WINDOW_MS * 0.6, keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
for (let k = 0; Date.now() < walkEnd; k++) { await page.keyboard.down(keys[k % 4]); await new Promise((r) => setTimeout(r, 1500)); await page.keyboard.up(keys[k % 4]); }
const m = await page.evaluate(() => { const x = window.originsPreview.mobs()?.mobs?.find((q) => q.drawn && q.body); return x && { id: x.id, x: x.x, z: x.z }; });
if (m) { await page.evaluate((q) => { window.originsPreview.place(q.x, q.z - 2.5, 0); window.originsPreview.tapMob(q.id); }, m); const end = Date.now() + WINDOW_MS * 0.4; while (Date.now() < end) { await page.evaluate(() => window.originsPreview.press?.('light')); await new Promise((r) => setTimeout(r, 400)); } }
else await new Promise((r) => setTimeout(r, WINDOW_MS * 0.4));
const { profile } = await cdp.send('Profiler.stop');
const long = await page.evaluate((n) => window.__long.slice(n), longBefore);
// aggregate: self time by node, inclusive by function along each sample's stack
const nodes = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const keyOf = (n) => { const f = n.callFrame, file = (f.url || '').split('/').pop() || '(native)'; return `${f.functionName || '(anonymous)'} @ ${file}:${f.lineNumber + 1}`; };
const self = new Map(), incl = new Map(), byFile = new Map(); let total = 0;
for (let i = 0; i < profile.samples.length; i++) {
  const dt = (profile.timeDeltas[i] ?? 0) / 1000; total += dt;
  const leaf = nodes.get(profile.samples[i]), lk = keyOf(leaf);
  self.set(lk, (self.get(lk) ?? 0) + dt);
  const file = (leaf.callFrame.url || '').split('/').pop() || leaf.callFrame.functionName || '(native)'; byFile.set(file, (byFile.get(file) ?? 0) + dt);
  const seen = new Set(); for (let id = leaf.id; id !== undefined; id = parent.get(id)) { const k = keyOf(nodes.get(id)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) ?? 0) + dt); } }
}
const top = (m2, n) => [...m2.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, ms: Math.round(v), pct: Math.round(1000 * v / total) / 10 }));
const special = (name) => Math.round([...self.entries()].filter(([k]) => k.startsWith(name)).reduce((a, [, v]) => a + v, 0));
const report = { label, rate: RATE, readyMs, windowMs: WINDOW_MS, totalMs: Math.round(total), idleMs: special('(idle)'), gcMs: special('(garbage collector)'), programMs: special('(program)'), longTasks: long.length, longTotalMs: long.reduce((a, t) => a + t.ms, 0), longMaxMs: Math.max(0, ...long.map((t) => t.ms)), errors, topSelf: top(self, TOP), topInclusive: top(incl, TOP), byFile: top(byFile, 14) };
fs.writeFileSync(path.join(out, `profile-${label}-rate${RATE}.json`), JSON.stringify(report, null, 2));
console.log(`PROFILE ${label} rate ${RATE}: ready ${readyMs} ms, window ${report.totalMs} ms (idle ${report.idleMs}, gc ${report.gcMs}, program ${report.programMs}), long tasks ${report.longTasks} / ${report.longTotalMs} ms / max ${report.longMaxMs}`);
console.log('SELF'); for (const r of report.topSelf.slice(0, 22)) console.log(`  ${String(r.ms).padStart(6)} ms ${String(r.pct).padStart(5)}%  ${r.k}`);
console.log('INCLUSIVE'); for (const r of report.topInclusive.slice(0, 30)) console.log(`  ${String(r.ms).padStart(6)} ms ${String(r.pct).padStart(5)}%  ${r.k}`);
console.log('FILES'); for (const r of report.byFile) console.log(`  ${String(r.ms).padStart(6)} ms ${String(r.pct).padStart(5)}%  ${r.k}`);
await browser.close(); server.close();
