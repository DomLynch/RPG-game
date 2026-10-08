// Player-path engage trace (Dom's seamless bar: worst gap < 200 ms on Mac Metal). URL=<page> (default the live Zone 1), SERVE=1 serves artifacts/origins-preview locally (build it first), RUNS=3, GL=swiftshader for a software run; real GPU by default.
// Records window.__zoneReady (the warm-up's ready point, #1919) and the programs added after it. Player-path engage trace on the LIVE build, real GPU. Fresh page load per run; wait idle; start rAF gap log + longtask observer + CPU profile >= 1 s BEFORE engage;
// place the hero 14 m from an untouched creature facing it, WALK in (hold W) until it notices, press STAB (#thrust-button tap); capture 5 s after.
import fs from 'node:fs'; import os from 'node:os'; import { execSync } from 'node:child_process'; import { chromium } from 'playwright';
const quiet = async () => { for (let i = 0; i < 60; i++) { const q = execSync("ps -Ao command | grep -c '[q]uality-stop' || true").toString().trim(); if (os.loadavg()[0] < 10 && q === '0') return { load1: +os.loadavg()[0].toFixed(1), qs: 0, waitedS: i * 5 }; await new Promise((r) => setTimeout(r, 5000)); } return { load1: +os.loadavg()[0].toFixed(1), qs: 'busy', waitedS: 300 }; };
import http from 'node:http'; import path from 'node:path';
let URL = process.env.URL || 'https://frankendom.com/zone1/'; let _srv = null;
if (process.env.SERVE) {   // SERVE=1: serve artifacts/origins-preview (built here) on localhost instead of the live site
  const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' }, roots = { '/preview/origins/': built + '/' };
  for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots['/' + d + '/'] = root + '/public/' + d + '/';
  _srv = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html'); if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html'); if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res); });
  await new Promise((r) => _srv.listen(0, '127.0.0.1', r)); URL = `http://127.0.0.1:${_srv.address().port}/preview/origins/?region=1`;
}
const OUT = process.env.OUT || 'artifacts/origins-engage-live', N = +(process.env.RUNS || 3); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const results = [], used = new Set();
for (let run = 0; run < N; run++) {
  const q0 = await quiet(); const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), res = { run: run + 1, errors: [], quiet: q0 };
  page.on('pageerror', (e) => res.errors.push(String(e).slice(0, 160)));
  try {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
    res.zoneReady = await page.waitForFunction(() => window.__zoneReady, null, { timeout: 120000 }).then((h) => h.jsonValue()).catch(() => 'never');
    res.renderer = await page.evaluate(() => { const c = document.createElement('canvas'), g = c.getContext('webgl'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
    res.revision = await page.evaluate(() => fetch('/release.json').then((r) => r.json()).then((j) => j.revision ?? j.sha ?? JSON.stringify(j).slice(0, 60)).catch(() => 'n/a'));
    const mobs = await page.evaluate(() => window.originsPreview.mobs().mobs.filter((m) => m.drawn && m.body).map((m) => ({ id: m.id, x: m.x, z: m.z, level: m.level, body: m.body })));
    const t = mobs.filter((m) => !used.has(m.id)).sort((a, b) => a.level - b.level)[0]; used.add(t.id); res.target = t;
    const spot = await page.evaluate(([x, z]) => { const op = window.originsPreview; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, sx = x + Math.sin(a) * 14, sz = z + Math.cos(a) * 14; let ok = op.canStand(sx, sz); for (let d = 0; d <= 14 && ok; d += 1) ok = op.canStand(x + Math.sin(a) * d, z + Math.cos(a) * d); if (ok) return { x: sx, z: sz, h: Math.atan2(x - sx, z - sz) }; } return null; }, [t.x, t.z]);
    if (!spot) { res.fail = 'no clear 14 m line to ' + t.id; throw new Error(res.fail); }
    await page.evaluate((s) => window.originsPreview.place(s.x, s.z, s.h), spot);
    // idle: no frame gap over 100 ms for 3 s (up to 90 s)
    await page.evaluate(() => { window.__idle = []; let last = performance.now(); const tick = (n) => { window.__idle.push([n, n - last]); last = n; if (window.__idle.length > 400) window.__idle.shift(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    for (let i = 0; i < 90; i++) { await page.waitForTimeout(1000); const ok = await page.evaluate(() => { const n = performance.now(); return window.__idle.filter(([a]) => a > n - 3000).every(([, g]) => g < 100) && window.__idle.some(([a]) => a > n - 3000); }); if (ok && i >= 8) { res.idleAfterS = i + 1; break; } }
    res.hero0 = (await page.evaluate(() => window.originsPreview.combat())).hero.health;
    await page.screenshot({ path: `${OUT}/run${run + 1}-idle.png` }).catch(() => {});   // the 375 still before the walk: a capsule standing in for a creature must not be visible in normal play (#1919)
    // logs START now, >= 1 s before the walk
    await page.evaluate(() => { window.__t0 = performance.now(); window.__long = []; window.__gaps = []; let last = performance.now(); const tick = (n) => { window.__gaps.push([Math.round(n - window.__t0), Math.round(n - last)]); last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime - window.__t0), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: false }); });
    const cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
    res.programs0 = await page.evaluate(() => window.originsPreview.renderInfo().programNames.length); res.programNames0 = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
    await page.waitForTimeout(1500);
    const now = () => page.evaluate(() => Math.round(performance.now() - window.__t0));
    res.walkStartMs = await now(); await page.keyboard.down('KeyW');
    let joinedAt = null, reachAt = null, hitAt = null, telegraphAt = null; const hp0 = res.hero0;
    for (let i = 0; i < 300 && reachAt === null; i++) { await page.waitForTimeout(100); const s = await page.evaluate((id) => { const m = window.originsPreview.mobs().mobs.find((x) => x.id === id), c = window.originsPreview.combat(), p = window.originsPreview.pos; return { joined: c.fighters.length > 1, dist: m ? Math.hypot(m.x - p.x, m.z - p.z) : 99, hp: c.hero.health }; }, t.id); if (s.joined && joinedAt === null) joinedAt = await now(); if (s.dist < 2.6) reachAt = await now(); }
    await page.keyboard.up('KeyW'); res.joinedAtMs = joinedAt; res.reachAtMs = reachAt;
    res.stabAtMs = await now();
    for (let k = 0; k < 7; k++) { await page.tap('#thrust-button').catch((e) => { if (!res.errors.includes('tap')) res.errors.push('tap ' + String(e).slice(0, 80)); }); await page.waitForTimeout(700); const c = await page.evaluate(() => window.originsPreview.combat()); const f = c.fighters[1]; if (f && telegraphAt === null && (f.phase === 'windup' || f.phase === 'active')) telegraphAt = await now(); if (hitAt === null && c.hero.health < hp0) hitAt = await now(); }
    res.telegraphAtMs = telegraphAt; res.heroHitAtMs = hitAt; res.engaged = (await page.evaluate(() => window.originsPreview.combat())).fighters.map((f) => f.phase + ':' + f.hp).join(',');
    await page.waitForTimeout(5000);
    const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(`${OUT}/run${run + 1}.cpuprofile`, JSON.stringify(profile));
    const gaps = await page.evaluate(() => window.__gaps), long = await page.evaluate(() => window.__long);
    res.frames = gaps.length; res.frameMedianMs = [...gaps.map((g) => g[1])].sort((a, b) => a - b)[Math.floor(gaps.length / 2)]; res.maxGapAllMs = Math.max(...gaps.map((g) => g[1])); res.maxGapFromWalk = Math.max(...gaps.filter((g) => g[0] >= res.walkStartMs).map((g) => g[1]));
    res.maxGapAroundEngage = Math.max(...gaps.filter((g) => g[0] >= (joinedAt ?? res.stabAtMs) - 300).map((g) => g[1]));
    res.programsAdded = (await page.evaluate(() => window.originsPreview.renderInfo().programNames)).filter((n) => !res.programNames0.includes(n)); delete res.programNames0;
    res.worst5 = [...gaps].sort((a, b) => b[1] - a[1]).slice(0, 5); res.longtasks = long;
    const nodes = new Map(profile.nodes.map((n) => [n.id, n])), self = new Map();
    profile.samples.forEach((id, i) => { const cf = nodes.get(id).callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); });
    res.topSelfMs = [...self.entries()].sort((a, b) => b[1] - a[1]).filter(([k]) => !/^\((idle)\)/.test(k)).slice(0, 10).map(([k, v]) => [k, Math.round(v)]);
    res.hero1 = (await page.evaluate(() => window.originsPreview.combat())).hero.health;
    await page.screenshot({ path: `${OUT}/run${run + 1}-engaged.png` }).catch(() => {});
  } catch (e) { res.fail = String(e).slice(0, 300); }
  await ctx.close(); results.push(res); console.log(JSON.stringify(res));
}
await browser.close(); _srv?.close(); fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
