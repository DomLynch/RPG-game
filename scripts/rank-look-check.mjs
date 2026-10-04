// Rank look stream gate (src/rank-look.ts, docs/briefs/tier-looks-runtime.md; the five rows Lead accepted 2026-09-27, plus A and B).
// The real game in mobile Chromium at 375x812 against a vite dev server, the look served from public/looks/ (never committed).
//   node scripts/rank-look-check.mjs --opponent goblin --look /looks/goblin-l3.glb [--dist dist [--build]] [--runs 3] [--mbps 9] [--latency 40] [--label goblin-l3] [--skip-load] [--skip-replay]
// --dist <dir>: a `vite build` output (meshopt-packed, as shipped) served gzipped like the host (Armour's look-load-ab.mjs server), with the
// look at <dir><look>; otherwise the vite dev server with the look at public<look>.
// LOAD (rows 1–5), --runs fresh contexts per variant at --mbps / --latency (CDP emulation):
//   1 first playable (the game's ?perf=1 "first fight at N s") with the flag on ≤ flag off + 0.3 s (median);
//   2 stream-in = the look's fetch start → ready (decoded) ≤ --stream s (default 4.0; a whole-body look: pass its own ceiling);
//     on a full-tier file of a set with phone LODs rows 2 and 4 are a REPORT under a hard 10 s / 150 ms ceiling (rank-look-rows.mjs);
//   3 swap ≤ 2 s after ready (the first idle beat), phases asserted quiet on the swap frame by the unit test's idleBeat;
//   4 the swap frame ≤ 50 ms (the worst rAF interval within 300 ms of the swap: the opened-waist rebake lands there);
//   5 phone memory: the look's added tris ≤ 45k and its textures ≤ 22 MB uploaded (RGBA + mips) at the phone cap. A look that replaces his
//     whole body (his fused CreatureBody goes off) is counted NET of that body's tris (Lead's ruling on #1001: the bar stays 45k, net).
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
import { LEVEL_ANCHORS, OPPONENTS, PROFILES, opponentAt, profileAt } from '../src/moves.ts';
import { PHONE_LOOKS, SHIPPING_LOOKS, lookMapCapMiB } from '../src/rank-look.ts';
import { rowVerdict } from './rank-look-rows.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OPP = arg('--opponent', 'goblin'), LOOK = arg('--look'), RUNS = Number(arg('--runs', 3)), MBPS = Number(arg('--mbps', 9)), LATENCY = Number(arg('--latency', 40));
const CPU = Number(arg('--cpu', 4)), STREAM = Number(arg('--stream', 4.0)), LABEL = arg('--label', `${OPP}-rank-look`), DIR = `artifacts/herolook/${LABEL}`;
// --finishers a,b,c limits the B rows (auto = the spec's own pick, which also plays the kill-cam); --look-only drops the flag-off rows and the
// A pair (a second look on the same build: the flag-off path is proven once, by the first look's run).
const FINISHERS = arg('--finishers', 'decapitation,splitCrown,opened,runThrough,quietOne,plainDeath').split(','), LOOK_ONLY = process.argv.includes('--look-only');
// --matched's verdict (Lead + Strategy 2026-09-29, #1061): a pixel counts only when some channel differs by >= 33 levels, and only at frame
// 240 (the fight is over and still). Data, NB L8 on the Mac: every A/A (the same look twice, 4 runs) <= 804 px at f240; every A/B (his rig vs
// the L8 look, 3 runs) >= 36,116 px, with the >= 33 box on him (x 384-775 of 1125). f60 stays a still but is not judged: its frame-wide
// 1-2-level noise is unnamed (a performance.now() rebase and equal real-time warm-up were both tried and changed nothing), and there a
// base-vs-base A/A reached 23,074 px, only ~2x under the A/B. Raise aaMaxPx only with new A/A data.
const MATCHED_DIFF = { level: 33, frame: 240, aaMaxPx: 5000 };
// Two screenshots compared in the browser (no PNG package in the repo): every RGB, plus the >= MATCHED_DIFF.level count and its box.
const diffShots = (page, x, y) => page.evaluate(async ([x, y, level]) => {
  const pixels = async (src) => { const i = new Image(); i.src = src; await i.decode(); const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return [g.getImageData(0, 0, i.width, i.height).data, i.width]; };
  const [[p, w], [q]] = [await pixels(x), await pixels(y)];
  let n = 0, big = 0; const box = [Infinity, Infinity, -1, -1], bigBox = [Infinity, Infinity, -1, -1];   // [x0, y0, x1, y1], screenshot pixels
  const grow = (b, px, py) => { b[0] = Math.min(b[0], px); b[1] = Math.min(b[1], py); b[2] = Math.max(b[2], px); b[3] = Math.max(b[3], py); };
  for (let k = 0; k < p.length; k += 4) {
    const d = Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])); if (!d) continue;
    const px = (k / 4) % w, py = Math.floor(k / 4 / w); n++; grow(box, px, py); if (d >= level) { big++; grow(bigBox, px, py); }
  }
  return { percent: +(100 * n / (p.length / 4)).toFixed(2), box: n ? box : null, [`px${level}`]: big, [`box${level}`]: big ? bigBox : null };
}, [x, y, MATCHED_DIFF.level]);
const pngUrl = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
const verdict = (d) => d ? (d[`px${MATCHED_DIFF.level}`] <= MATCHED_DIFF.aaMaxPx ? 'same' : 'look changed') : 'not judged (no f240 shot)';
// --judge <dir>:<a>,<b> [...]: the verdict re-run on shots already taken (offline, no server, no game): <dir>/<a>-f240.png vs <dir>/<b>-f240.png.
if (process.argv.includes('--judge')) {
  const b = await chromium.launch({ headless: true }), page = await b.newPage();
  for (const spec of process.argv.slice(process.argv.indexOf('--judge') + 1).filter((v) => !v.startsWith('--'))) {
    const [dir, pair] = spec.split(':'), [a, c] = pair.split(','), f = MATCHED_DIFF.frame;
    const d = await diffShots(page, await pngUrl(`${dir}/${a}-f${f}.png`), await pngUrl(`${dir}/${c}-f${f}.png`));
    console.log(`${dir} ${a} vs ${c} f${f}: ${verdict(d)} ${JSON.stringify(d)}`);
  }
  await b.close(); process.exit(0);
}
if (!LOOK) { console.error('--look /looks/<name>.glb is required'); process.exit(2); }
// --load-query '&gfx=phone&lookbake=off' adds to the load rows' page URL (the phone profile; the no-bake baseline for condition 2).
const LOAD_QUERY = arg('--load-query', '');
const DIST = arg('--dist'), LOOK_FILE = `${DIST ?? 'public'}${LOOK}`;
// A --dist replays the Node leg's record, so it must be the build of THIS tree (Combat/Lead 2026-09-29): a stale dist replays the same
// intents into a different fight and reads as a sim bug. --build runs `npm run build` INTO <dist> (never vite's default dist/) and stamps <dist>/.built-from.json with the tree it built;
// without a matching stamp and a clean src/, a --dist run refuses to start.
if (DIST) {
  const { execSync } = await import('node:child_process'), sh = (c) => execSync(c, { encoding: 'utf8', timeout: 10_000 }).trim();
  const tree = sh('git rev-parse HEAD^{tree}'), dirty = sh('git status --porcelain src') !== '';
  if (process.argv.includes('--build')) { execSync(`npm run build -- --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { stdio: 'inherit', timeout: 600_000 }); await fs.writeFile(`${DIST}/.built-from.json`, JSON.stringify({ tree, dirty })); }
  const stamp = await fs.readFile(`${DIST}/.built-from.json`, 'utf8').then(JSON.parse).catch(() => null);
  if (!stamp || stamp.tree !== tree || stamp.dirty || dirty) { console.error(`${DIST} is not the build of this tree (${tree.slice(0, 12)}${dirty ? ', src dirty' : ''}); stamp ${JSON.stringify(stamp)}: rerun with --build`); process.exit(2); }
}
const FULL_TIER_ONLY = PHONE_LOOKS.has(OPP) && !LOOK.endsWith('-phone.glb');   // the phone streams this set's -phone file instead (rank-look.ts)
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
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader","--use-gl=angle","--ignore-gpu-blocklist","--enable-unsafe-swiftshader"] });
const os = await import('node:os');   // the box's load at the start and end: Lead takes no row 4 / C numbers measured above 15
const out = { loadStart: os.loadavg().map((v) => +v.toFixed(1)), opponent: OPP, look: LOOK, bytes: (await fs.stat(LOOK_FILE)).size, served: DIST ? `dist ${DIST} (gzip)` : 'vite dev (raw)', mbps: MBPS, latency: LATENCY, load: { off: [], on: [] }, replay: {}, rows: {} };
const phone = () => browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
async function guest(page, query = '') { await page.goto(`${origin}/?opponent=${OPP}${query}`); await page.waitForFunction(() => localStorage.getItem('frankendom.fighter.v1')); }

// One winning fight vs the opponent (the first seed the AI-driven hero wins), as herolook-kill-record.mjs.
async function winningRecord() {
  for (let s = 0; s < 40; s++) {
    const seed = 731 + s * 97, level = LEVEL_ANCHORS.normal, recorder = createRecorder({ build: 'rank-look', opponent: OPP, weapon: 'longsword', level, seed });
    let practice = initialPractice(seed, opponentAt(OPPONENTS[OPP], level)), hero = initialAi(seed ^ 0x5bd1e995);   // the level's body, as the replay page builds it
    while (!practice.finish && practice.duel.tick < 60 * 120) { const w = decide(practice.duel, 0, hero, PROFILES.normal); hero = w.ai; practice = stepPractice(practice, recorder.push(practice.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[OPP], level)); }
    if (practice.finish && !practice.finish.draw && practice.finish.victim === 1) return { seed, ticks: practice.duel.tick, query: `?replay=${await encodeRecord(recorder.finish('killed'))}` };
  }
}

// Who fell in the browser's replay, read when the finish is on screen (Finishers 2026-09-29: every Dwarf replay ended with the HERO dead, the
// browser at tick 2,172 against the Node record's win at 2,248, and the rows still printed PASS). main.ts writes the replay banner on the frame
// the fight ends, before the #debug probe's finishPhase: 'Replay over · <his name> fell' = he fell (victim 1), '… the fighter fell' = the hero.
// The end tick is main.ts's stamp (#debug data-replay '<tick>/<victim>/<draw>', written on the frame the fight ends, as browser-replay-check
// reads it), not the live data-tick: that one is read after the finish is on screen and on a busy box it had moved on (Hero Look 2026-09-29:
// Pitborn phone 1836/1837 and Shieldmaiden auto rows 1431/1433 against Node 1834/1430, while the stamp matched Node on every quiet re-run).
const fallen = (page) => page.evaluate(() => { const t = document.querySelector('#replay-banner')?.textContent ?? '', d = document.querySelector('#debug')?.dataset ?? {};
  return { victim: !t.startsWith('Replay over') ? null : t.endsWith('the fighter fell') ? 0 : 1, browserTick: d.replay ? Number(d.replay.split('/')[0]) : Number(d.tick), tickSource: d.replay ? 'stamp' : 'live', liveTick: Number(d.tick) }; });

// --matched 'old=/looks/<a>.glb,new=/looks/<b>.glb' [--frames 60,240] (Lead 2026-09-29, a matched A/B for look PRs): the same winning record
// replayed once per variant under Playwright's clock, paused from before the page loads, so no frame runs until this script steps it. Each
// variant steps the same number of rAF frames from the replay's start (the fight camera, the arena's clock-driven light and the fighters'
// poses are then the same frame) and Math.random is one seeded sequence (gore). Loading the look takes frames by design; each gets 500 ms of real
// time so the fetch settles between steps. The swap frame can still differ by a frame or two (one map upload per frame: a file with fewer maps
// is ready sooner), recorded per variant as `on`. The fight only moves with the frame count, the same in every variant. No game hook.
// Writes artifacts/herolook/<label>/<variant>-f<frame>.png and matched.json (per frame, between the first two variants: the share of pixels that
// differ and their bounding box; a box that sits on him alone is the proof that nothing else in the frame moved).
// Each shot also records the page's performance.now() and the sim tick: two variants on the same frame must agree on both (the arena's
// firelight sways with performance.now, scene.ts).
if (process.argv.includes('--matched')) {
  const dir = `artifacts/herolook/${LABEL}`; await fs.mkdir(dir, { recursive: true });
  const variants = arg('--matched').split(',').map((v) => v.split('=')), frames = arg('--frames', '60,240').split(',').map(Number);
  const rec = await winningRecord(); if (!rec) throw new Error(`no winning fight vs ${OPP} in 40 seeds`);
  const result = { opponent: OPP, record: { seed: rec.seed, ticks: rec.ticks }, frames, variants: {} };
  try {
    for (const [name, look] of variants) {
      const context = await phone(), page = await context.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (x) => x.abort());
      await guest(page);
      // Limit (Auditer, #1055): three.js also draws Math.random for every object's UUID, and two look files make different object counts, so
      // gore can still differ between variants; a shot that lands on gore shows it as a second diff region, not a failure of the look.
      // Receipt: every rAF callback the page runs (a runFor(16) step that fires 0 or 2 frames would put the variants on different ticks).
      await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); globalThis.__rafs = 0; window.requestAnimationFrame = (cb) => raf((t) => { globalThis.__rafs++; cb(t); }); });
      await page.addInitScript(() => { let a = 0x9e3779b9; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
      await page.goto(`${origin}/?opponent=${OPP}&debug&ranklook=${look}&${rec.query.slice(1)}`);
      await page.waitForFunction(() => document.querySelector('#replay-banner')?.textContent === 'Replay' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 120000, polling: 100 });
      await page.addStyleTag({ content: '#replay-banner,#replay-still,#reset-button,.play-now,#debug{display:none!important}' });
      const shots = []; let on, realMs = 0;
      for (let f = 1; f <= Math.max(...frames); f++) {
        await page.clock.runFor(16);
        const state = await page.evaluate(() => globalThis.__rankLook?.state());
        // Loading takes frames by design (scene.ts: compileAsync, then one map upload per rAF), so the clock keeps stepping; each loading
        // frame gets 500 ms of real time so the fetch, the parse and the shader compile settle between steps rather than racing them.
        if (state === 'loading') { await page.waitForTimeout(500); realMs += 500; }
        if (state === 'on' && on === undefined) on = f;
        // CSS transitions run on real time, not the page clock (the .versus veil's 0.45 s fade, the HUD's): finished before the shot, so the
        // real-time waits above can't leave one variant mid-fade (Goblin L8 first run: 66.9% of pixels off by 1-32 levels, frame-wide).
        if (frames.includes(f)) { await page.screenshot({ path: `${dir}/${name}-f${f}.png`, animations: 'disabled' }); shots.push({ frame: f, look: state, ...await page.evaluate(() => ({ now: performance.now(), tick: Number(document.querySelector('#debug')?.dataset.tick), rafs: globalThis.__rafs })) }); }
      }
      result.variants[name] = { look, on, realMs, load: os.loadavg()[0].toFixed(1), shots, errors }; console.log(JSON.stringify({ variant: name, look, on, realMs, load: os.loadavg()[0].toFixed(1), shots, errors }));
      await context.close();
    }
    const [a, b] = variants.map(([n]) => n);
    if (b) {
      const page = await (await browser.newContext()).newPage(); result.differ = {};
      for (const f of frames) result.differ[`f${f}`] = await diffShots(page, await pngUrl(`${dir}/${a}-f${f}.png`), await pngUrl(`${dir}/${b}-f${f}.png`));
      result.verdict = verdict(result.differ[`f${MATCHED_DIFF.frame}`]);
      console.log(`pixels that differ ${a} vs ${b}: ${JSON.stringify(result.differ)}`);
      console.log(`verdict at f${MATCHED_DIFF.frame} (>= ${MATCHED_DIFF.level} levels, same if <= ${MATCHED_DIFF.aaMaxPx} px): ${result.verdict}`);
    }
  } finally { await fs.writeFile(`${dir}/matched.json`, JSON.stringify(result, null, 2)); await browser.close(); await server.close(); }
  process.exit(Object.values(result.variants).every((v) => !v.errors.length && v.shots.every((s) => s.look === 'on')) ? 0 : 1);
}

// --rungs (Strategy 2026-09-28, the stills Dom judges): the shipping path, no flag. For each rank (TIERS 1..10) a fresh phone page at
// ?opponent=<opp>&tier=<Rank>: enter, wait for the rank look to go on (rank 1: 'none', his rig as shipped), then the ready idle and one
// mid-fight frame at 375: the sword drawn and --approach ms given for him to close (the fight camera frames both), then an attack tapped.
// --tiers Recruit,Origin shoots a subset. No ?perf overlay. Writes artifacts/herolook/<label>/<n>-<Rank>-{idle,fight}.png and rungs.json.
if (process.argv.includes('--rungs')) {
  const { TIERS } = await import('../src/grades.ts');
  const dir = `artifacts/herolook/${LABEL}`; await fs.mkdir(dir, { recursive: true });
  // --query '&gfx=phone[&ranklook=/looks/<opp>-L{n}.glb]' adds to each page's URL, {n} = the rank (phone-LOD before/after stills, #1017).
  const rungs = [], only = arg('--tiers', '').split(',').filter(Boolean), approach = Number(arg('--approach', 3000)), query = arg('--query', '');
  try {
    for (const [i, tier] of TIERS.entries()) {
      if (only.length && !only.includes(tier)) continue;
      const context = await phone(), page = await context.newPage(), glbs = [], errors = [];
      page.on('pageerror', (e) => errors.push(String(e))); page.on('request', (r) => { const p = new URL(r.url()).pathname; if (p.startsWith('/looks/')) glbs.push(p); });
      await page.route('**/*sentry.io/**', (x) => x.abort());
      await guest(page, `&tier=${tier}`);
      await page.goto(`${origin}/?opponent=${OPP}&tier=${tier}${query.replaceAll('{n}', String(i + 1))}`);
      const enter = page.getByRole('button', { name: 'Enter the arena' });
      for (let w = 0; w < 600; w++) { if (await page.evaluate(() => globalThis.__rankLook?.state() !== undefined && globalThis.__rankLook.state() !== 'waiting')) break; if (await enter.isVisible().catch(() => false)) { await enter.tap(); break; } await page.waitForTimeout(100); }
      await page.waitForFunction(() => ['on', 'none', 'failed'].includes(globalThis.__rankLook?.state()), null, { timeout: 90000 });
      const state = await page.evaluate(() => globalThis.__rankLook.state()), name = `${String(i + 1).padStart(2, '0')}-${tier}`;
      await page.locator('#attack-button').tap().catch(() => {}); await page.waitForTimeout(approach);   // draw, and let him close
      await page.screenshot({ path: `${dir}/${name}-idle.png` });
      await page.locator('#attack-button').tap().catch(() => {}); await page.waitForTimeout(350);
      await page.screenshot({ path: `${dir}/${name}-fight.png` });
      rungs.push({ rank: i + 1, tier, state, looks: glbs, errors }); console.log(JSON.stringify(rungs.at(-1)));
      await context.close();
    }
  } finally { await fs.writeFile(`${dir}/rungs.json`, JSON.stringify({ opponent: OPP, rungs }, null, 2)); await browser.close(); await server.close(); }
  process.exit(rungs.every((r) => !r.errors.length && r.state === (SHIPPING_LOOKS[OPP]?.includes(r.rank) ? 'on' : 'none')) ? 0 : 1);   // a rank with no file (rank 1 but the Plague Doctor's, the Centurion's L6): his rig
}

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
      await page.goto(`${origin}/?opponent=${OPP}&perf=1${variant === 'on' ? `&ranklook=${LOOK}` : ''}${LOAD_QUERY}`);
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
          // Lead on 8d138778 (condition 2): the frames from the fetch's end to the swap hold the map uploads and the pre-swap bake; their p95
          // against the same span with ?lookbake=off (--load-query '&lookbake=off') is the no-hitch evidence.
          const span = globalThis.__frames.filter(([t]) => t >= from && t < s.on).map(([, ms]) => ms).sort((a, b) => a - b);
          const bakeP95 = span.length ? +span[Math.min(span.length - 1, Math.ceil(span.length * 0.95) - 1)].toFixed(1) : null, bakeFrames = span.length;
          return { bakeP95, bakeFrames, state: globalThis.__rankLook.state(), fetchStart: fetch?.startTime, fetchEnd: fetch?.responseEnd, loaded: s.loaded, on: s.on, applyMs: s.applyMs, swapFrame, worstAt, longTasks, cost: globalThis.__rankLookOn };
        }, LOOK));
        run.stream = +((run.loaded - run.fetchStart) / 1000).toFixed(2); run.swap = +((run.on - run.loaded) / 1000).toFixed(2); run.onAfterFirst = +(run.on / 1000 - run.first).toFixed(2);   // fight start to look on (Lead: before vs after)
      }
    } catch (e) { run.error = String(e).slice(0, 240); }
    out.load[variant].push(run); console.log(`${variant} run ${r + 1}:`, JSON.stringify(run));
    await context.close();
  }

  if (!process.argv.includes('--skip-replay')) {
    const rec = await winningRecord();
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
        Object.assign(row, await fallen(page), { nodeTick: rec.ticks });
        row.lookState = await page.evaluate(() => globalThis.__rankLook?.state() ?? 'off');
        row.waited = await page.evaluate(() => globalThis.__rankLook?.stamps().waited);
      } else {
        await page.waitForFunction(() => document.querySelector('#debug')?.dataset.finishPhase, null, { timeout: 180000 });
        Object.assign(row, await fallen(page), { nodeTick: rec.ticks });
        row.lookState = await page.evaluate(() => globalThis.__rankLook?.state() ?? 'off');
        const dir = `${DIR}/${name}`; await fs.mkdir(dir, { recursive: true });
        for (let i = 0; i < 14; i++) { await page.screenshot({ path: `${dir}/${String(i).padStart(2, '0')}.png` }); await page.waitForTimeout(400); }
        row.stills = dir;
      }
      out.replay[name] = row; console.log(`replay ${name}:`, JSON.stringify(row));
      await context.close();
    }
    // Row C with the look on, then the same replay with it off (control): the worst frame is split at the throttle start (page load vs fight).
    if (FINISHERS.includes('opened')) for (const [key, lookOn] of [['settle', true], ['settleOff', false]]) {
      const context = await phone(), page = await context.newPage(), cdp = await context.newCDPSession(page); page.setDefaultTimeout(240000);
      const errors = []; page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (x) => x.abort());
      await guest(page);
      // Each rAF: its interval, the frozen flag and the finisher clock (the #debug probe the game wrote on the frame before).
      await page.addInitScript(() => { const f = (globalThis.__frames = []); let last = 0; const tick = (t) => { const d = document.querySelector('#debug')?.dataset; if (last) f.push([t, t - last, d?.frozen === 'true', d?.finishPhase ? JSON.parse(d.finishPhase).age : null]); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
      await page.goto(`${origin}/?opponent=${OPP}&debug${lookOn ? `&ranklook=${LOOK}` : ''}&${rec.query.slice(1)}`);
      await page.waitForFunction(() => document.querySelector('#replay-banner')?.textContent === 'Replay' && document.querySelector('#art-status')?.textContent === '');
      await page.evaluate(() => { const s = document.getElementById('finisher-select'); s.value = 'opened'; s.dispatchEvent(new Event('change')); });
      const throttledAt = await page.evaluate(() => performance.now()); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await page.waitForFunction(() => document.querySelector('#debug')?.dataset.finishPhase, null, { timeout: 240000 });
      const fell = await fallen(page);
      await page.waitForTimeout(2500);
      Object.assign(out.replay[key] = { cpu: CPU, errors, ...fell, nodeTick: rec.ticks }, await page.evaluate((throttledAt) => {
        const f = globalThis.__frames, bake = globalThis.__rankLookSteps ?? [];
        const aged = f.filter(([, , , age]) => age !== null), steps = aged.slice(1).map((x, k) => +(x[3] - aged[k][3]).toFixed(4));
        const sorted = [...steps].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] ?? null;
        return {
          lookState: globalThis.__rankLook?.state() ?? 'off', medianAgeStep: median, maxAgeStep: sorted.at(-1) ?? null,
          worstFrame: +Math.max(...f.map(([, ms]) => ms)).toFixed(1),
          // [ms, ms from the throttle start, frozen, finisher age] of the worst frame before the throttle (page load) and after it (the fight).
          ...Object.fromEntries([['loadWorst', f.filter(([t]) => t <= throttledAt)], ['fightWorst', f.filter(([t]) => t > throttledAt)]].map(([k, xs]) => { const w = xs.reduce((m, x) => (x[1] > m[1] ? x : m), [0, 0]); return [k, [+w[1].toFixed(1), +(w[0] - throttledAt).toFixed(0), w[2] ?? null, w[3] ?? null]]; })),
          // Every rebake step is [ms, what it did]: the six worst by name, and the median (Lead, #918: name the step before fixing it).
          bakeSteps: bake.length, worstStep: bake.length ? +Math.max(...bake.map(([ms]) => ms)).toFixed(1) : null, drained: !!globalThis.__rankLookDrained, forced: !!globalThis.__rankLookForced, fallback: globalThis.__rankLookFallback ?? [],
          medianStep: bake.length ? +[...bake.map(([ms]) => ms)].sort((a, b) => a - b)[bake.length >> 1].toFixed(1) : null,
          worstSteps: bake.map(([ms, label], i) => [+ms.toFixed(1), i, label]).sort((a, b) => b[0] - a[0]).slice(0, 6),
        };
      }, throttledAt));
      console.log(`${key} (C${lookOn ? '' : ', look off'}):`, JSON.stringify(out.replay[key]));
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
    '5a added tris ≤ 45k (net of a freed CreatureBody)': { value: cost ? cost.tris - (cost.bodyFreed ?? 0) : NaN, limit: 45000 },
    // 5c (Dom 2026-09-28, "check the stats numbers first"; Lead's row): the phone pays skinned vertices, each pass, not net triangles — the live
    // PD L10 passed 5a at 43,711 net while carrying 121,511 vertices, 2.3× the body it frees. A body-replacing look (bodyFreed > 0) is read WHOLE
    // and must fit under 60k on the phone tier (Goblin L10: 39,413 passes); a pieces-only look reports its count and is not bound by this row.
    // A full-tier file of a set with phone LODs (PHONE_LOOKS) never reaches the phone: its <opp>-L<n>-phone.glb does, so 5c binds that run.
    '5c phone: a body-replacing look ≤ 60k skinned vertices whole': { value: cost?.bodyFreed && !FULL_TIER_ONLY ? cost.vertices ?? NaN : 0, limit: 60000, vertices: cost?.vertices ?? null, bodyReplacing: !!cost?.bodyFreed, ...(FULL_TIER_ONLY && { notOnPhone: LOOK.replace(/\.glb$/, '-phone.glb') }) },
    // 5b by tier (Strategy 2026-09-30, rank-look.ts lookMapCapMiB): 22 on the phone and for a set without LODs, 96 for a full-tier desktop file.
    [`5b look textures ≤ ${lookMapCapMiB(OPP, !FULL_TIER_ONLY)} MB`]: { value: cost?.gpuMB ?? NaN, limit: lookMapCapMiB(OPP, !FULL_TIER_ONLY) },
  };
}
// Row 0r: every replay the gate judged ends with HIM fallen (victim 1). A replay that ends another way (the hero dead, no end) is judging
// the wrong fight, so every row built on it is void: this row fails the run (Finishers + Strategy, 2026-09-29). Logs both tick counts.
{ const played = Object.entries(out.replay).filter(([k, r]) => k !== 'record' && r && typeof r === 'object' && 'victim' in r);
  if (played.length) out.rows['0r every replay ends with him fallen (victim 1)'] = { value: played.every(([, r]) => r.victim === 1) ? 1 : 0, limit: 1, min: true,
    replays: Object.fromEntries(played.map(([k, r]) => [k, `victim ${r.victim} · browser tick ${r.browserTick} (${r.tickSource}) · node tick ${r.nodeTick}`])) };
  if (played.length) console.log('replay finishes:', JSON.stringify(out.rows['0r every replay ends with him fallen (victim 1)'].replays));
  // Row 0t (Lead 2026-09-29, #1055 review note; Finishers +1): the same replays also end on the tick Node's sim ended the record on. 0r
  // alone passes a split that still ends with him fallen, a tick early or late (the Dwarf split, seed 828, was 2,172 vs 2,248).
  if (played.length) out.rows['0t every replay ends on the Node tick'] = { value: played.every(([, r]) => r.browserTick === r.nodeTick) ? 1 : 0, limit: 1, min: true }; }
if (out.replay.off && out.replay.on) out.rows['A replay identical (final tick), look on'] = { value: out.replay.on.tick === out.replay.off.tick && out.replay.on.lookState === 'on' ? 1 : 0, limit: 1, min: true, off: out.replay.off.tick, on: out.replay.on.tick };
for (const f of FINISHERS) for (const v of ['off', 'on']) { const r = out.replay[`${f}-${v}`]; if (r) out.rows[`B ${f} look ${v}: ${v === 'on' ? 'look on, ' : ''}no page errors`] = { value: (v === 'on' ? r.lookState === 'on' : ['off', 'none'].includes(r.lookState)) && !r.errors.length ? 1 : 0, limit: 1, min: true }; }
// A look that plays runThrough for opened at its rank (RUN_THROUGH_LOOKS, Strategy 22:27) takes no bake: row C is n/a, and the log must show
// the opened kill played runThrough.
if (out.replay.settle?.forced) { const c = out.replay.settle; out.rows['C opened: n/a, runThrough forced at this rank (opened kill played runThrough)'] = { value: c.bakeSteps === 0 && c.fallback.some((l) => l.endsWith('-> runThrough')) ? 1 : 0, limit: 1, min: true, fallback: c.fallback }; }
else if (out.replay.settle) { const c = out.replay.settle; out.rows[`C opened: worst rebake step ≤ 50 ms at CPU ×${CPU}, done before the kill`] = { value: c.bakeSteps && !c.drained && !c.errors.length ? c.worstStep : Infinity, limit: 50, steps: c.bakeSteps, drained: c.drained, medianAgeStep: c.medianAgeStep, maxAgeStep: c.maxAgeStep }; }
// The verdict: every bound as written, except the phone's bounds on a full-tier file (rows 2/4/5a/5c: REPORT, rows 2/4 with a hard ceiling).
const { pass, lines } = rowVerdict(out.rows, FULL_TIER_ONLY);
for (const { name, r, status } of lines) console.log(`${status} ${name}: ${r.value}${r.p90 !== undefined ? ` (p90 ${r.p90}, runs ${r.runs.join(' ')})` : ''}${r.steps !== undefined ? ` (${r.steps} steps, drained ${r.drained}, clock step max ${r.maxAgeStep} vs median ${r.medianAgeStep})` : ''}`);
out.pass = pass; out.loadEnd = os.loadavg().map((v) => +v.toFixed(1)); console.log(`load start ${out.loadStart.join(' ')} → end ${out.loadEnd.join(' ')}`);
await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(`${DIR}/receipt.json`, JSON.stringify(out, null, 2));
console.log(`${pass ? 'PASS' : 'FAIL'}; ${DIR}/receipt.json (B stills: look at each finisher's frames by eye: the helm leaves with the Head, the waist cut shows the look)`);
process.exit(pass ? 0 : 1);
