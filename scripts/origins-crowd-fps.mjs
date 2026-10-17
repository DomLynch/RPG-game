// Zone 1 crowd frame-rate harness (launch gate S2: 40 animated, geared characters hold 30 fps). Fresh page per case at 375x812 touch; waits for [zone ready] and an idle 3 s; then feeds
// N remote heroes (Web's #2929 pool) through window.originsPreview.setOthers the way presence does (a packet every tickMs, ids kept alive so none expires), standing (IDLE) or walking
// (WALK, a circle at ~2.5 m/s), all inside the camera's view ahead of the hero; measures WINDOW ms of rAF gaps and writes OUT/receipt.json: median fps, p95 frame time, worst gap,
// drawn count (remote().shown.length, must equal N up to nearCap), programs added since zone ready (must be 0), renderer. Software GL (swiftshader/llvmpipe) numbers are marked and mean nothing.
// Usage: SERVE=1 OUT=/tmp/crowd node scripts/origins-crowd-fps.mjs   (SERVE=1 serves artifacts/origins-preview, built with `npx vite build --config origins/preview/vite.config.mjs --outDir artifacts/origins-preview`)
//   COUNTS=0,8,16,40 (0 = the empty-zone baseline)  MODES=idle,walk  THROTTLE=1,4  PROFILE=1 (top self-time functions per case)  WINDOW=10000  URL=<page>  GL=swiftshader  PASS_FPS=30 (S2 bar on a real GPU run)  QS=&x=y appended to the served URL
// Needs #2929 (originsPreview.setOthers / remote) in the build; dressing the crowd (#2926 dressRemote) will be a DRESS=1 case once it is wired in main.ts.
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { chromium } from 'playwright';
const OUT = process.env.OUT || '/tmp/crowd-fps', COUNTS = (process.env.COUNTS || '0,8,16,40').split(',').map(Number), MODES = (process.env.MODES || 'idle,walk').split(','), WINDOW = +(process.env.WINDOW || 10000), BAR = +(process.env.PASS_FPS || 30), THROTTLES = (process.env.THROTTLE || '1').split(',').map(Number);   // THROTTLE=1,4: also a 4x CPU-throttled case (CDP Emulation.setCPUThrottlingRate, applied after [zone ready]): a phone-like trend, not a phone
fs.mkdirSync(OUT, { recursive: true });
let URL = process.env.URL || 'https://frankendom.com/zone1/', srv = null;
if (process.env.SERVE) {   // same static server as scripts/origins-engage-warmup.mjs: the built preview plus the public asset folders
  const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), roots = { '/preview/origins/': built + '/' };
  for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots['/' + d + '/'] = root + '/public/' + d + '/';
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2' };
  srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let hit = null; for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
    if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
    if (!hit || !fs.existsSync(hit)) { res.statusCode = 404; res.end(); return; }
    res.setHeader('content-type', mime[path.extname(hit)] || 'application/octet-stream'); fs.createReadStream(hit).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); URL = `http://127.0.0.1:${srv.address().port}/preview/origins/?region=1${process.env.QS || ''}`;
}
const soft = process.env.GL === 'swiftshader';
const browser = await chromium.launch({ headless: true, args: soft ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const results = [];
for (const throttle of THROTTLES) for (const n of COUNTS) for (const mode of MODES) {
  const res = { n, mode, throttle, errors: [] }, page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', (e) => res.errors.push(String(e).slice(0, 160)));
  try {
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 240000 });
    res.zoneReady = await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }).then((h) => h.jsonValue()).catch(() => 'never');
    if (n > 0 && !(await page.evaluate(() => typeof window.originsPreview.setOthers === 'function'))) throw new Error('this build has no originsPreview.setOthers (needs #2929)');
    res.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'), e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
    res.software = soft || /swiftshader|llvmpipe|software/i.test(res.renderer);
    if (throttle > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
    if (process.env.DRESS && !(await page.evaluate(() => typeof window.originsPreview.dressRemote === 'function'))) throw new Error('DRESS=1: this build has no originsPreview.dressRemote (#2926 dress-remote.ts is merged but not wired into main.ts yet)');   // the dressed case, once wired: call dressRemote(id, worn) per figure here, before programs0
    // A fixed CPU workload timed in this page under this throttle (best of 5): how fast THIS job's host is. Frame time divided by it compares builds across jobs; a build change moves the frames, a host change moves both.
    res.calibMs = +Math.min(...(await page.evaluate(() => Array.from({ length: 5 }, () => { const t = performance.now(); let s = 0; for (let i = 0; i < 4e6; i++) s += Math.sqrt(i) * Math.sin(i); return performance.now() - t + (s > 1e99 ? 1 : 0); })))).toFixed(1);
    const programs0 = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
    // The crowd stands in the camera's view: find which way the hero walks (hold W 400 ms), then lay N figures in a cone 4-14 m ahead on ground the engine says is standable.
    const a0 = await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }));
    await page.keyboard.down('KeyW');
    let a1 = a0, moved = 0;
    for (let i = 0; i < 40 && moved < 1; i++) { await page.waitForTimeout(250); a1 = await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z })); moved = Math.hypot(a1.x - a0.x, a1.z - a0.z); }   // a software-GL run walks slowly: hold W until he has moved a metre (10 s at most)
    await page.keyboard.up('KeyW');
    if (moved < 0.3) throw new Error(`hero did not walk forward (moved ${moved.toFixed(2)} m): cannot aim the crowd`);
    const fwd = { x: (a1.x - a0.x) / moved, z: (a1.z - a0.z) / moved };
    res.forward = fwd;
    await page.waitForTimeout(3000);   // idle settle, then the run
    await page.evaluate(([n, mode, f]) => {
      const op = window.originsPreview, h = { x: op.pos.x, z: op.pos.z }, slots = [];
      const ahead = (dist, side) => ({ x: h.x + f.x * dist - f.z * side, z: h.z + f.z * dist + f.x * side });
      for (let i = 0, tries = 0; slots.length < n && tries < n * 40; tries++) { const d = 4 + ((i * 7 + tries * 3) % 11), side = (((i * 5 + tries) % 9) - 4) * (0.5 + d * 0.12), q = ahead(d, side); if (op.canStand(q.x, q.z)) { slots.push({ id: 1000 + slots.length, cx: q.x, cz: q.z, r: 1.5 + (i % 3), ph: (i * 0.7) % 6.28 }); i++; } }
      window.__crowd = { slots, t0: performance.now(), built: slots.length };
      const WALK_SPEED = 2.5;
      const send = () => { const t = (performance.now() - window.__crowd.t0) / 1000; op.setOthers?.(slots.map((s) => { if (mode !== 'walk') return { id: s.id, x: s.cx, z: s.cz, heading: 0, anim: 0, flags: 0 }; const a = s.ph + (t * WALK_SPEED) / s.r; return { id: s.id, x: s.cx + Math.cos(a) * s.r, z: s.cz + Math.sin(a) * s.r, heading: -a, anim: 1, flags: 0 }; })); };
      window.__crowdTimer = setInterval(send, 100); send();
    }, [n, mode, fwd]);
    res.built = await page.evaluate(() => window.__crowd.built);
    await page.waitForTimeout(2500);   // the figures appear, grow slots and ease in before the window opens
    await page.evaluate(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const cdp = process.env.PROFILE ? await page.context().newCDPSession(page) : null;   // PROFILE=1: a CPU profile over the window; the top self-time functions go in the receipt (the .cpuprofile itself is not brought back)
    if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    await page.waitForTimeout(WINDOW);
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop'), nodes = new Map(profile.nodes.map((nd) => [nd.id, nd])), self = new Map();
      profile.samples.forEach((id, i) => { const cf = nodes.get(id).callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`; self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000); });
      res.topSelfMs = [...self.entries()].sort((a, b) => b[1] - a[1]).filter(([k]) => !/^\((idle)\)/.test(k)).slice(0, 15).map(([k, v]) => [k, Math.round(v)]);
    }
    const gaps =(await page.evaluate(() => window.__gaps.slice())).slice(1, -1).sort((a, b) => a - b);
    const q = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))];
    res.meanMs = +(gaps.reduce((a, g) => a + g, 0) / gaps.length).toFixed(2); res.meanFps = +(1000 / res.meanMs).toFixed(1);   // not quantized to the 16.7 ms vsync step like the median: a small host or build difference shows here instead of flipping 60 <-> 30
    res.frames = gaps.length; res.medianMs = +q(0.5).toFixed(2); res.medianFps = +(1000 / q(0.5)).toFixed(1); res.p95Ms = +q(0.95).toFixed(2); res.worstMs = +gaps[gaps.length - 1].toFixed(1);
    const dbg = await page.evaluate(() => window.originsPreview.remote?.() ?? null);   // an empty-zone case on a build before #2929 has no remote() res.slots = dbg?.slots ?? null; res.drawn = dbg?.shown?.length ?? 0;
    res.programsAdded = (await page.evaluate(() => window.originsPreview.renderInfo().programNames)).filter((p) => !programs0.includes(p));
    res.pass = res.drawn === Math.min(n, 40) && res.programsAdded.length === 0 && (res.software ? null : res.medianFps >= BAR);   // null: a software run does not judge the bar
  } catch (e) { res.fail = String(e).slice(0, 300); res.pass = false; }
  await page.context().close(); results.push(res); console.log(JSON.stringify(res));
}
await browser.close(); srv?.close();
const receipt = { when: new Date().toISOString(), url: URL, viewport: '375x812 touch', windowMs: WINDOW, barFps: BAR, note: 'Physical-phone numbers (iPhone 12 / Pixel 6) stay Dom\'s; a software-GL row is not judged.', results };
fs.writeFileSync(`${OUT}/receipt.json`, JSON.stringify(receipt, null, 2));
const bad = results.filter((r) => r.pass === false);
if (bad.length) { console.error(`crowd-fps: ${bad.length} of ${results.length} cases failed (see ${OUT}/receipt.json)`); process.exit(1); }
console.log(`crowd-fps: ${results.length} cases, receipt ${OUT}/receipt.json`);
