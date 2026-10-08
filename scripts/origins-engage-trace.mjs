// Engage-frame CPU profile (seamless engage, Dom's 200 ms bar): serves the built Zone 1 preview, walks to a creature, starts a V8 CPU profile + longtask observer, taps it (originsPreview.tapMob), stops 4 s later.
// Prints: longtasks (ms, start offset), the worst frame gaps, and the top self-time functions (function, file:line, ms) inside the 4 s window. Env: TARGET=<mob id>, GL=swiftshader|default.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { chromium } from 'playwright';
const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), out = path.join(root, 'artifacts/origins-engage-trace'); fs.mkdirSync(out, { recursive: true });
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs', '--sourcemap'], { stdio: 'inherit', timeout: 900000 });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm', '.map': 'application/json' };
const roots = { '/preview/origins/': built + '/' }; for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots['/' + d + '/'] = root + '/public/' + d + '/';
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html'); if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html'); if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
const args = process.env.GL === 'default' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args }); const res = { errors: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }), page = await ctx.newPage();
  page.on('pageerror', (e) => res.errors.push(String(e).slice(0, 200)));
  await page.goto(origin + '/preview/origins/?region=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
  const t = await page.evaluate((id) => window.originsPreview.mobs().mobs.find((m) => (id ? m.id === id : m.drawn && m.body)), process.env.TARGET || '');
  res.target = { id: t.id, body: t.body, level: t.level };
  await page.waitForTimeout(8000);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [t.x, t.z]);
  await page.waitForTimeout(25000);   // the walk: stage/prewarm settles meanwhile (as the seamless gate)
  await page.evaluate(() => { window.__long = []; window.__gaps = []; let last = performance.now(); const tick = (n) => { window.__gaps.push([Math.round(n - window.__t0), Math.round(n - last)]); last = n; requestAnimationFrame(tick); }; window.__t0 = performance.now(); requestAnimationFrame(tick); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime - window.__t0), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: false }); });
  await page.waitForTimeout(3000);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start'); const tapAt = await page.evaluate((id) => { const n = performance.now() - window.__t0; window.originsPreview.tapMob(id); return Math.round(n); }, t.id);
  await page.waitForTimeout(4000);
  const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(out + '/engage.cpuprofile', JSON.stringify(profile));
  res.tapAtMs = tapAt; res.longtasks = (await page.evaluate(() => window.__long)).filter(([s]) => s >= tapAt - 50);
  res.worstGaps = (await page.evaluate(() => window.__gaps)).filter(([s]) => s >= tapAt - 50).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map();
  profile.samples.forEach((id, i) => { const n = nodes.get(id), cf = n.callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); });
  res.topSelfMs = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => [k, Math.round(v)]);
} catch (e) { res.fail = String(e).slice(0, 300); } finally { await browser.close(); server.close(); }
fs.writeFileSync(out + '/engage.json', JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1).slice(0, 4000));
