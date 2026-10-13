// Frame-gap trace of one duel at phone size: ready -> draw -> first swing -> kill -> finisher complete, in REAL time on the page the URL names (default: the live site).
// A passive sparring dummy (so the run always reaches the finisher), 375x812. From before the draw to the finisher latch it logs every rAF gap, every main-thread longtask and a
// CDP CPU profile; then it names each frame over GAP_MS (default 100) with the phase it fell in, whether the main thread was busy for it, and the hottest JS under it.
// Usage: URL=https://frankendom.com/ OUT=/tmp/trace RUNS=3 node scripts/duel-frame-trace.mjs   (SERVE=<dist dir> serves a local build instead).
// Honesty: on software GL (SwiftShader, the VPS) the rasteriser runs on the CPU and stretches EVERY frame, so a gap there is not a hitch by itself. The row that separates them is
// `busyMs`: the main thread's own long task / profile time inside the gap. A gap with busyMs near 0 is a GPU wait; a gap with a busy main thread names real JS.
import fs from 'node:fs/promises'; import http from 'node:http'; import path from 'node:path'; import zlib from 'node:zlib';
import { chromium } from 'playwright';
const URL_ = process.env.URL || 'https://frankendom.com/', OUT = process.env.OUT || 'artifacts/duel-frame-trace', RUNS = Number(process.env.RUNS || 1), GAP = Number(process.env.GAP_MS || 100);
const QUERY = '?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&skill=none&yourSpecial=none&special=none&debug';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
async function serve(dir) {
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const root = path.resolve(dir), asked = path.resolve(root, `.${p}`);   // %2e%2e decodes to '..' only after URL parsing: resolve, then refuse anything outside the root
    if (asked !== root && !asked.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    let file = asked, data; try { data = await fs.readFile(file); } catch { file = path.join(root, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 }); res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
const server = process.env.SERVE ? await serve(process.env.SERVE) : null, base = server?.origin ?? URL_.replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, args: process.env.REAL_GL ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await fs.mkdir(OUT, { recursive: true });
const runs = [];
try {
  for (let run = 1; run <= RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await context.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message)); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.addInitScript(() => {   // every program link: when, and which (three prefixes SHADER_NAME and the USE_* defines): a program linked after `ready` is a compile the player pays for
      window.__links = [];
      for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) { if (!C) continue; const link = C.prototype.linkProgram;
        C.prototype.linkProgram = function (program) { const t0 = performance.now(); let name = '?', defs = 0; try { const src = this.getAttachedShaders(program).map((sh) => this.getShaderSource(sh) || '').join('\n'); name = /#define SHADER_NAME (\w+)/.exec(src)?.[1] ?? '?'; defs = (src.match(/#define USE_\w+/g) ?? []).length; } catch { /* a context that cannot say */ }
          const r = link.call(this, program); window.__links.push([Math.round(t0 * 10) / 10, Math.round((performance.now() - t0) * 10) / 10, name, defs]); return r; }; }
    });
    await page.goto(`${base}/${QUERY}`, { waitUntil: 'commit' });
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 300000, polling: 250 });
    await page.addStyleTag({ content: '#debug{display:none!important}' }); await page.waitForTimeout(3000);   // idle: the baseline gap of this machine
    const cdp = await context.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
    await page.evaluate(() => {
      window.__gaps = []; window.__long = []; window.__marks = []; let last = performance.now();
      const tick = (t) => { window.__gaps.push([Math.round(t * 10) / 10, Math.round((t - last) * 10) / 10]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
      window.__mark = (n) => window.__marks.push([n, performance.now()]);
    });
    await cdp.send('Profiler.start'); const anchor = await page.evaluate(() => { window.__mark('ready'); return performance.now(); });
    const state = () => page.evaluate(() => ({ enemy: Number(document.querySelector('#target-health')?.value ?? NaN), phase: JSON.parse(document.querySelector('#debug')?.dataset.finishPhase || 'null') }));
    await page.locator('#attack-button').tap({ force: true }); await page.evaluate(() => window.__mark('draw'));
    await page.waitForFunction(() => document.querySelector('#heavy-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 30000, polling: 100 }).catch(() => {});
    let swung = false, killed = false, finished = false;
    for (let i = 0; i < 400 && !finished; i++) {   // a paced heavy every 600 ms of real time until the dummy dies, then wait out the finisher
      if (!killed) { await page.locator('#heavy-button').tap({ force: true, timeout: 3000 }).catch(() => {}); if (!swung) { swung = true; await page.evaluate(() => window.__mark('firstSwing')); } }
      await page.waitForTimeout(600);
      const s = await state();
      if (!killed && s.enemy === 0) { killed = true; await page.evaluate(() => window.__mark('killed')); }
      if (killed && s.phase?.complete) { finished = true; await page.evaluate(() => window.__mark('finisherComplete')); }
      if (killed && i > 200) break;
    }
    await page.waitForTimeout(1500);
    const { profile } = await cdp.send('Profiler.stop'), data = await page.evaluate(() => ({ gaps: window.__gaps, long: window.__long, marks: window.__marks, links: window.__links, renderer: (() => { const g = document.createElement('canvas').getContext('webgl'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)) : 'n/a'; })() }));
    // profile clock -> page clock: the first sample sits at profile.startTime (us); the page clock read at Profiler.start is `anchor` (ms)
    const byId = new Map(profile.nodes.map((n) => [n.id, n])), parent = new Map(profile.nodes.flatMap((n) => (n.children ?? []).map((c) => [c, n.id])));   // parent: who called whom, for `inclusive` let at = profile.startTime; const samples = profile.samples.map((id, i) => { at += profile.timeDeltas[i]; return { t: anchor + (at - profile.startTime) / 1000, node: byId.get(id) }; });
    const phaseAt = (t) => { let name = 'before ready'; for (const [n, mt] of data.marks) if (t >= mt) name = n; return name; };
    const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0, base0 = median(data.gaps.filter(([t]) => t < anchor).map((g) => g[1]));
    const frames = data.gaps.filter(([t, g]) => t >= anchor && g >= GAP).map(([t, g]) => {
      const from = t - g, hot = new Map(), incl = new Map(); let busy = 0;
      for (const s of samples) if (s.t > from && s.t <= t && s.node.callFrame.functionName !== '(idle)' && s.node.callFrame.functionName !== '(program)') { busy += 0.5; const f = s.node.callFrame, k = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; hot.set(k, (hot.get(k) ?? 0) + 0.5); const seen = new Set(); for (let id = s.node.id; id !== undefined; id = parent.get(id)) { const c = byId.get(id).callFrame, ck = `${c.functionName || '(anonymous)'} ${c.url.split('/').pop()}:${c.lineNumber + 1}`; if (!seen.has(ck)) { seen.add(ck); incl.set(ck, (incl.get(ck) ?? 0) + 0.5); } } }
      const long = data.long.filter(([ls, ld]) => ls < t && ls + ld > from).map(([, ld]) => Math.round(ld));
      return { atMs: Math.round(t - anchor), gapMs: Math.round(g), phase: phaseAt(from), busyMs: Math.round(busy), longtasksMs: long, hottest: [...hot].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${Math.round(v)}ms`), inclusive: [...incl].filter(([k]) => !/^\((root|program|idle|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${Math.round(v)}ms`) };   // inclusive: time under each function (self + callees), the callers of the hot leaves
    });
    const linksIn = data.links.map(([t, d, n, defs]) => ({ atMs: Math.round(t - anchor), linkCallMs: d, shader: n, defines: defs, phase: phaseAt(t) })).filter((l) => l.atMs >= 0);
    const mk = Object.fromEntries(data.marks.map(([n, t]) => [n, t])), SKIN = /^(multiplyMatrices|applyBoneTransform|fromBufferAttribute|getVertexPosition|applyMatrix4|getX|getY|getZ|getComponent|addScaledVector|copy|set|raycast|intersectObjects|boneProduct|skinPass)$/;
    const fight = samples.filter((x) => x.t >= (mk.firstSwing ?? Infinity) && x.t <= (mk.killed ?? mk.firstSwing ?? 0) && !/^\((idle|program)\)$/.test(x.node.callFrame.functionName)), fightMs = fight.length * 0.5, skinMs = fight.filter((x) => SKIN.test(x.node.callFrame.functionName)).length * 0.5;
    const fightFrames = data.gaps.filter(([t]) => t >= (mk.firstSwing ?? Infinity) && t <= (mk.killed ?? 0)), mainThreadFrames = frames.filter((f) => f.busyMs >= 50);
    const result = { run, fightWindow: { jsMs: Math.round(fightMs), skinningJsMs: Math.round(skinMs), frames: fightFrames.length, framesOverGapWithBusyMainThread: mainThreadFrames.filter((f) => f.phase === 'firstSwing').length, longtasksMs: data.long.filter(([t]) => t >= (mk.firstSwing ?? Infinity) && t <= (mk.killed ?? 0)).reduce((a, [, d]) => a + d, 0) | 0 }, programsLinkedAfterReady: linksIn,  url: base, renderer: data.renderer, idleMedianGapMs: Math.round(base0), marks: data.marks.map(([n, t]) => [n, Math.round(t - anchor)]), framesOver: frames, longtasks: data.long.filter(([t]) => t >= anchor).map(([t, d]) => [Math.round(t - anchor), Math.round(d)]) };
    runs.push(result); console.log(`run ${run}: renderer ${result.renderer}; idle median gap ${result.idleMedianGapMs} ms; marks ${JSON.stringify(result.marks)}; ${frames.length} frames over ${GAP} ms`);
    console.log(`  fight window (firstSwing..killed): ${JSON.stringify(result.fightWindow)}`);
    console.log(`  programs linked after ready (${linksIn.length}): ${linksIn.map((l) => `${l.phase}+${l.atMs} ${l.shader}/${l.defines}`).join(', ')}`);
    for (const f of frames.filter((x) => x.busyMs >= 50 || x.longtasksMs.length).slice(0, 25)) console.log(`  +${f.atMs} ms gap ${f.gapMs} ms in ${f.phase}: busy ${f.busyMs} ms, longtasks ${JSON.stringify(f.longtasksMs)}; ${f.hottest.join(' | ') || 'no JS sampled (a GPU/raster wait)'}`);
    await context.close();
  }
} finally { await fs.writeFile(`${OUT}/trace.json`, JSON.stringify(runs, null, 1)); await browser.close(); await server?.close(); }
