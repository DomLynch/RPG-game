// Rank look stream gate (src/rank-look.ts, docs/briefs/tier-looks-runtime.md; the five rows Lead accepted 2026-09-27, plus A and B).
// The real game in mobile Chromium at 375x812 against a vite dev server, the look served from public/looks/ (never committed).
//   node scripts/rank-look-check.mjs --opponent goblin --look /looks/goblin-l3.glb [--dist dist] [--runs 3] [--mbps 9] [--latency 40] [--label goblin-l3] [--skip-load] [--skip-replay]
// --dist <dir>: a `vite build` output (meshopt-packed, as shipped) served gzipped like the host (Armour's look-load-ab.mjs server), with the
// look at <dir><look>; otherwise the vite dev server with the look at public<look>.
// LOAD (rows 1–5), --runs fresh contexts per variant at --mbps / --latency (CDP emulation):
//   1 first playable (the game's ?perf=1 "first fight at N s") with the flag on ≤ flag off + 0.3 s (median);
//   2 stream-in = the look's fetch start → ready (decoded) ≤ --stream s (default 4.0; a whole-body look: pass its own ceiling);
//   3 swap ≤ 2 s after ready (the first idle beat), phases asserted quiet on the swap frame by the unit test's idleBeat;
//   4 the swap frame ≤ 50 ms (the worst rAF interval within 300 ms of the swap: the opened-waist rebake lands there);
//   5 phone memory: the look's added tris ≤ 45k and its textures ≤ 22 MB uploaded (RGBA + mips) at the phone cap.
// REPLAY (A, B), one winning fight vs the opponent (the AI drives the player, as scripts/herolook-kill-record.mjs), unthrottled:
//   A the same record replays to the same final tick and victim with the flag off and on (the look is presentation only);
//   B with the look OFF and then ON, every finisher row (decapitation, splitCrown, opened, runThrough, quietOne, plainDeath) forced through the dev
//     select: stills every 0.4 s from the kill through the kill-cam into artifacts/herolook/<label>/<finisher>/NN.png.
// SETTLE (C), when --finishers has opened: the same record with the look on and Opened forced, at --cpu × CPU (default 4, CDP throttle):
//   the waist-cut rebake is stepped one piece a frame after the swap (scene.ts): the worst step (ms), the step count, whether the kill
//   came before the last step and forced the rest (drained), and the finisher clock's steps, so a catch-up jump shows against the median.
// Row 4 is the worst frame from the look's fetch end (its warm-up: compile, one map upload per frame) to 300 ms after the swap; it also reports its p90 and, for the worst run, the long tasks (PerformanceObserver) that overlap the worst frame.
// Receipt: artifacts/herolook/<label>/receipt.json. Guest only; nothing is sent anywhere. Never part of the build or the runtime.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { decide, initialAi } from '../src/ai.ts';
import { LEVEL_ANCHORS, OPPONENTS, PROFILES, profileAt } from '../src/moves.ts';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OPP = arg('--opponent', 'goblin'), LOOK = arg('--look'), RUNS = Number(arg('--runs', 3)), MBPS = Number(arg('--mbps', 9)), LATENCY = Number(arg('--latency', 40));
const CPU = Number(arg('--cpu', 4)), STREAM = Number(arg('--stream', 4.0)), LABEL = arg('--label', `${OPP}-rank-look`), DIR = `artifacts/herolook/${LABEL}`;
// --finishers a,b,c limits the B rows (auto = the spec's own pick, which also plays the kill-cam); --look-only drops the flag-off rows and the
// A pair (a second look on the same build: the flag-off path is proven once, by the first look's run).
const FINISHERS = arg('--finishers', 'decapitation,splitCrown,opened,runThrough,quietOne,plainDeath').split(','), LOOK_ONLY = process.argv.includes('--look-only');
if (!LOOK) { console.error('--look /looks/<name>.glb is required'); process.exit(2); }
const DIST = arg('--dist'), LOOK_FILE = `${DIST ?? 'public'}${LOOK}`;
await fs.access(LOOK_FILE).catch(() => { console.error(`${LOOK_FILE} is not there: copy the look file in first (untracked)`); process.exit(2); });
// A gzip-serving static server for a built dist, SPA fallback to index.html (scripts/look-load-ab.mjs, Armour): the host compresses.
async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}
const server = DIST ? await serveDist(DIST) : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
if (!DIST) await server.listen();
const origin = DIST ? server.origin : `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const os = await import('node:os');   // the box's load at the start and end: Lead takes no row 4 / C numbers measured above 15
const out = { loadStart: os.loadavg().map((v) => +v.toFixed(1)), opponent: OPP, look: LOOK, bytes: (await fs.stat(LOOK_FILE)).size, served: DIST ? `dist ${DIST} (gzip)` : 'vite dev (raw)', mbps: MBPS, latency: LATENCY, load: { off: [], on: [] }, replay: {}, rows: {} };
const phone = () => browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
async function guest(page, query = '') { await page.goto(`${origin}/?opponent=${OPP}${query}`); await page.waitForFunction(() => localStorage.getItem('frankendom.fighter.v1')); }

try {
  if (!process.argv.includes('--skip-load')) for (const variant of ['off', 'on']) for (let r = 0; r < RUNS; r++) {
    const context = await phone(), page = await context.newPage(), cdp = await context.newCDPSession(page);
    await page.route('**/*sentry.io/**', (x) => x.abort()); await cdp.send('Network.enable');
    await guest(page);   // the profile is written unthrottled, as look-load-ab.mjs does; the measured load is the second
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY, downloadThroughput: MBPS * 1e6 / 8, uploadThroughput: MBPS * 1e6 / 8 });
    // Frame intervals from the page's own rAF, so the swap frame is measured where it lands.
    await page.addInitScript(() => {
      const f = (globalThis.__frames = []); let last = 0; const tick = (t) => { if (last) f.push([t, t - last]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      const l = (globalThis.__long = []); try { new PerformanceObserver((list) => { for (const e of list.getEntries()) l.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch { /* no long-task API */ }
    });
    // Every request that failed (Lead, #918: a look's texture URIs must all resolve, 0 404s).
    const run = { first: NaN, failed: [] }; page.on('response', (x) => { if (x.status() >= 400) run.failed.push([x.status(), new URL(x.url()).pathname]); });
    try {
      await page.goto(`${origin}/?opponent=${OPP}&perf=1${variant === 'on' ? `&ranklook=${LOOK}` : ''}`);
      const enter = page.getByRole('button', { name: 'Enter the arena' });
      for (let w = 0; w < 600; w++) { if (/first fight at [\d.]+ s/.test(await page.textContent('#perf').catch(() => ''))) break; if (await enter.isVisible().catch(() => false)) { await enter.tap(); break; } await page.waitForTimeout(100); }
      await page.waitForFunction(() => /first fight at [\d.]+ s/.test(document.querySelector('#perf')?.textContent ?? ''), null, { timeout: 90000 });
      run.first = Number(/first fight at ([\d.]+) s/.exec(await page.textContent('#perf'))[1]);
      if (variant === 'on') {
        await page.waitForFunction(() => ['on', 'failed'].includes(globalThis.__rankLook?.state()), null, { timeout: 60000 });
        Object.assign(run, await page.evaluate((look) => {
          const s = globalThis.__rankLook.stamps(), fetch = performance.getEntriesByType('resource').find((e) => e.name.endsWith(look));
          // The swap frame is the worst frame from the fetch's end to swap + 300 ms; rebake steps inside that span count here (Lead, #918).
          const from = fetch?.responseEnd ?? s.on - 20, near = globalThis.__frames.filter(([t]) => t >= from && t <= s.on + 300);
          const worst = near.reduce((a, b) => (b[1] > a[1] ? b : a), [0, 0]), swapFrame = worst[1];
          // Where the worst frame sits against the swap stamp, and the long tasks that overlap it (what row 4 is made of).
          const worstAt = +(worst[0] - s.on).toFixed(1), longTasks = globalThis.__long.filter(([t, d]) => t < worst[0] && t + d > worst[0] - worst[1]).map(([t, d]) => [+(t - s.on).toFixed(1), +d.toFixed(1)]);
          return { state: globalThis.__rankLook.state(), fetchStart: fetch?.startTime, fetchEnd: fetch?.responseEnd, loaded: s.loaded, on: s.on, applyMs: s.applyMs, swapFrame, worstAt, longTasks, cost: globalThis.__rankLookOn };
        }, LOOK));
        run.stream = +((run.loaded - run.fetchStart) / 1000).toFixed(2); run.swap = +((run.on - run.loaded) / 1000).toFixed(2);
      }
    } catch (e) { run.error = String(e).slice(0, 240); }
    out.load[variant].push(run); console.log(`${variant} run ${r + 1}:`, JSON.stringify(run));
    await context.close();
  }

  if (!process.argv.includes('--skip-replay')) {
    // One winning fight vs the opponent (the first seed the AI-driven hero wins), as herolook-kill-record.mjs.
    let rec;
    for (let s = 0; s < 40 && !rec; s++) {
      const seed = 731 + s * 97, level = LEVEL_ANCHORS.normal, recorder = createRecorder({ build: 'rank-look', opponent: OPP, weapon: 'longsword', level, seed });
      let practice = initialPractice(seed, OPPONENTS[OPP]), hero = initialAi(seed ^ 0x5bd1e995);
      while (!practice.finish && practice.duel.tick < 60 * 120) { const w = decide(practice.duel, 0, hero, PROFILES.normal); hero = w.ai; practice = stepPractice(practice, recorder.push(practice.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[OPP], level)); }
      if (practice.finish && !practice.finish.draw && practice.finish.victim === 1) rec = { seed, ticks: practice.duel.tick, query: `?replay=${await encodeRecord(recorder.finish('killed'))}` };
    }
    if (!rec) throw new Error(`no winning fight vs ${OPP} in 40 seeds`);
    out.replay.record = { seed: rec.seed, ticks: rec.ticks };
    for (const [name, look, finisher] of [...(LOOK_ONLY ? [] : [['off', false, 'auto'], ['on', true, 'auto']]), ...FINISHERS.flatMap((f) => LOOK_ONLY ? [[`${f}-on`, true, f]] : [[`${f}-off`, false, f], [`${f}-on`, true, f]])]) {
      const context = await phone(), page = await context.newPage(); page.setDefaultTimeout(240000);
      const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (x) => x.abort());
      await guest(page);
      await page.goto(`${origin}/?opponent=${OPP}&debug${look ? `&ranklook=${LOOK}` : ''}&${rec.query.slice(1)}`);
      await page.waitForFunction(() => document.querySelector('#replay-banner')?.textContent === 'Replay' && document.querySelector('#art-status')?.textContent === '');
      if (finisher !== 'auto') await page.evaluate((f) => { const s = document.getElementById('finisher-select'); s.value = f; s.dispatchEvent(new Event('change')); }, finisher);
      await page.addStyleTag({ content: '#replay-banner,#replay-still,#reset-button,.play-now,#debug{display:none!important}' });
      const row = { errors };
      if (name === 'off' || name === 'on') {
        await page.waitForFunction(() => document.querySelector('#debug')?.dataset.finishPhase, null, { timeout: 180000 });
        row.tick = Number(await page.evaluate(() => document.querySelector('#debug').dataset.tick));
        row.lookState = await page.evaluate(() => globalThis.__rankLook?.state() ?? 'off');
        row.waited = await page.evaluate(() => globalThis.__rankLook?.stamps().waited);
      } else {
        await page.waitForFunction(() => document.querySelector('#debug')?.dataset.finishPhase, null, { timeout: 180000 });
        row.lookState = await page.evaluate(() => globalThis.__rankLook?.state() ?? 'off');
        const dir = `${DIR}/${name}`; await fs.mkdir(dir, { recursive: true });
        for (let i = 0; i < 14; i++) { await page.screenshot({ path: `${dir}/${String(i).padStart(2, '0')}.png` }); await page.waitForTimeout(400); }
        row.stills = dir;
      }
      out.replay[name] = row; console.log(`replay ${name}:`, JSON.stringify(row));
      await context.close();
    }
    if (FINISHERS.includes('opened')) {
      const context = await phone(), page = await context.newPage(), cdp = await context.newCDPSession(page); page.setDefaultTimeout(240000);
      const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (x) => x.abort());
      await guest(page);
      // Each rAF: its interval, the frozen flag and the finisher clock (the #debug probe the game wrote on the frame before).
      await page.addInitScript(() => { const f = (globalThis.__frames = []); let last = 0; const tick = (t) => { const d = document.querySelector('#debug')?.dataset; if (last) f.push([t, t - last, d?.frozen === 'true', d?.finishPhase ? JSON.parse(d.finishPhase).age : null]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await page.goto(`${origin}/?opponent=${OPP}&debug&ranklook=${LOOK}&${rec.query.slice(1)}`);
      await page.waitForFunction(() => document.querySelector('#replay-banner')?.textContent === 'Replay' && document.querySelector('#art-status')?.textContent === '');
      await page.evaluate(() => { const s = document.getElementById('finisher-select'); s.value = 'opened'; s.dispatchEvent(new Event('change')); });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await page.waitForFunction(() => document.querySelector('#debug')?.dataset.finishPhase, null, { timeout: 240000 });
      await page.waitForTimeout(2500);
      Object.assign(out.replay.settle = { cpu: CPU, errors }, await page.evaluate(() => {
        const f = globalThis.__frames, bake = globalThis.__rankLookSteps ?? [];
        const aged = f.filter(([, , , age]) => age !== null), steps = aged.slice(1).map((x, k) => +(x[3] - aged[k][3]).toFixed(4));
        const sorted = [...steps].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] ?? null;
        return {
          lookState: globalThis.__rankLook?.state() ?? 'off', medianAgeStep: median, maxAgeStep: sorted.at(-1) ?? null,
          worstFrame: +Math.max(...f.map(([, ms]) => ms)).toFixed(1),
          bakeSteps: bake.length, worstStep: bake.length ? +Math.max(...bake).toFixed(1) : null, drained: !!globalThis.__rankLookDrained,
        };
      }));
      console.log('settle (C):', JSON.stringify(out.replay.settle));
      await context.close();
    }
  }
} finally { await browser.close(); await server.close(); }   // both servers expose close()

const on = out.load.on, off = out.load.off;
if (on.length) {
  const cost = on.find((r) => r.cost)?.cost;
  out.rows = {
    // 'failed' = the file was refused (no extras.keep, L1): a FAIL, never a flake (Lead, #918).
    '0 look state on in every run': { value: on.every((r) => r.state === 'on') ? 1 : 0, limit: 1, min: true, states: on.map((r) => r.state) },
    '0b no failed requests (404s)': { value: [...on, ...off].reduce((n, r) => n + r.failed.length, 0), limit: 0, failed: [...new Set([...on, ...off].flatMap((r) => r.failed.map(String)))] },
    '1 first playable delta ≤ +0.3 s': { value: +(med(on.map((r) => r.first)) - med(off.map((r) => r.first))).toFixed(2), limit: 0.3 },
    [`2 stream-in ≤ ${STREAM} s`]: { value: med(on.map((r) => r.stream)), limit: STREAM },
    '3 swap ≤ 2 s after ready': { value: med(on.map((r) => r.swap)), limit: 2 },
    '4 swap frame ≤ 50 ms': { value: Math.max(...on.map((r) => r.swapFrame ?? Infinity)), limit: 50, p90: [...on.map((r) => r.swapFrame ?? Infinity)].sort((a, b) => a - b)[Math.ceil(on.length * 0.9) - 1], runs: on.map((r) => r.swapFrame) },
    '5a added tris ≤ 45k': { value: cost?.tris ?? NaN, limit: 45000 },
    '5b look textures ≤ 22 MB': { value: cost?.gpuMB ?? NaN, limit: 22 },
  };
}
if (out.replay.off && out.replay.on) out.rows['A replay identical (final tick), look on'] = { value: out.replay.on.tick === out.replay.off.tick && out.replay.on.lookState === 'on' ? 1 : 0, limit: 1, min: true, off: out.replay.off.tick, on: out.replay.on.tick };
for (const f of FINISHERS) for (const v of ['off', 'on']) { const r = out.replay[`${f}-${v}`]; if (r) out.rows[`B ${f} look ${v}: ${v === 'on' ? 'look on, ' : ''}no page errors`] = { value: r.lookState === (v === 'on' ? 'on' : 'off') && !r.errors.length ? 1 : 0, limit: 1, min: true }; }
if (out.replay.settle) { const c = out.replay.settle; out.rows[`C opened: worst rebake step ≤ 50 ms at CPU ×${CPU}, done before the kill`] = { value: c.bakeSteps && !c.drained && !c.errors.length ? c.worstStep : Infinity, limit: 50, steps: c.bakeSteps, drained: c.drained, medianAgeStep: c.medianAgeStep, maxAgeStep: c.maxAgeStep }; }
let pass = true;
for (const [name, r] of Object.entries(out.rows)) { const ok = Number.isFinite(r.value) && (r.min ? r.value >= r.limit : r.value <= r.limit); pass &&= ok; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${r.value}${r.p90 !== undefined ? ` (p90 ${r.p90}, runs ${r.runs.join(' ')})` : ''}${r.steps !== undefined ? ` (${r.steps} steps, drained ${r.drained}, clock step max ${r.maxAgeStep} vs median ${r.medianAgeStep})` : ''}`); }
out.pass = pass; out.loadEnd = os.loadavg().map((v) => +v.toFixed(1)); console.log(`load start ${out.loadStart.join(' ')} → end ${out.loadEnd.join(' ')}`);
await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(`${DIR}/receipt.json`, JSON.stringify(out, null, 2));
console.log(`${pass ? 'PASS' : 'FAIL'}; ${DIR}/receipt.json (B stills: look at each finisher's frames by eye: the helm leaves with the Head, the waist cut shows the look)`);
process.exit(pass ? 0 : 1);
