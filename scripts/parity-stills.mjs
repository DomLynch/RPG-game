// Visual parity of two builds of the same special moves (a conversion to rows must not move a pixel): ?special=<name> on two built dists, the fight camera at 375 wide, the page's
// own harness clock stepping 16 ms at a time (scripts/lib/harness-clock.mjs, as special-clip.mjs), the same ticks shot on both, and the two PNGs compared pixel by pixel in the browser
// (no image library). Reports per special: the tick the wind-up starts and the strike lands on each build (the timing rows' own receipt), and per shot the differing pixel count.
//   node scripts/parity-stills.mjs --a <dist before> --b <dist after> [--specials all|set,hades,...] [--arena a] [--every 6] [--out artifacts/parity]
// Any special whose start/land tick or any shot differs is a finding; the differing shots are kept as <out>/<special>/<tick>-a|b.jpg (up to --keep, default 24) and the summary is
// <out>/parity.json + parity.md. PARITY_SW=1 adds the SwiftShader flags (a box with no GPU); on the HF T4 the gpu-run wrapper supplies the GPU flags.
/* global process, console, document, URL, globalThis, createImageBitmap, OffscreenCanvas, fetch */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const A = arg('a'), B = arg('b'), ARENA = arg('arena', ''), EVERY = Number(arg('every', 6)), OUT = arg('out', 'artifacts/parity'), KEEP = Number(arg('keep', 24)), PRE = Number(arg('pre', 40)), POST = Number(arg('post', 70));
if (!A || !B) { console.error('usage: parity-stills.mjs --a <dist> --b <dist> [--specials all|a,b] [--arena a] [--every 6] [--out dir]'); process.exit(2); }
let names = arg('specials', 'all').split(',');
if (names[0] === 'all') { const { SPECIAL_TESTS } = await import('../src/fight/special-look.ts'); names = Object.keys(SPECIAL_TESTS); }

async function serveDist(dir) {   // special-clip.mjs's static server: gzip, no-store, SPA fallback
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const servers = { a: await serveDist(A), a2: await serveDist(A), b: await serveDist(B) };   // a2 = the before build again: same code, so its difference from a is the run-to-run noise floor
const browser = await chromium.launch({ headless: true, args: process.env.PARITY_SW ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const stage = (page) => page.evaluate(() => { const s = globalThis.__special(); return { tick: s.tick, caster: s.stages[1] ?? s.stages[0] }; });

// One deterministic run of one special on one build. plan null: draws off, find the wind-up start and the strike. Otherwise draw from plan.from and shoot every EVERY ticks from the wind-up start to POST after the strike (keyed by offset from the wind-up start `w` or the strike `r`).
async function run(side, special, plan) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await context.newPage();
  page.on('pageerror', (e) => console.log(`pageerror[${side} ${special}]:`, e.message));
  try {
    await page.goto(`${servers[side].origin}/?special=${special}${ARENA ? `&arena=${ARENA}` : ''}&debug`);
    await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    const clock = await harnessClock(page);
    await skipDraws(page, true);
    await page.locator('#attack-button').tap().catch(() => {});
    const seen = { start: null, land: null }, shots = new Map(); let drawing = false;
    for (let n = 0; n < 6000; n++) {
      const { tick, caster } = await stage(page);
      if (caster?.stage === 'windup' && seen.start === null) seen.start = tick;
      if (caster?.stage === 'recover' && seen.land === null) seen.land = tick;
      if (!plan) { if (seen.land !== null && tick >= seen.land + POST) return seen; }
      else {
        if (!drawing && tick >= plan.from) { await skipDraws(page, false); await clock.run(48); drawing = true; }
        // Keyed by the offset from this run's own wind-up start (w) or strike (r), not the absolute tick: the start tick drifts a few ticks between runs of identical code (the fight's opening is wall-timed), the wind-up length does not.
        const key = seen.land !== null ? ((tick - seen.land) % EVERY === 0 ? `r${tick - seen.land}` : null) : seen.start !== null ? ((tick - seen.start) % EVERY === 0 ? `w${tick - seen.start}` : null) : null;
        if (drawing && key && !shots.has(key)) shots.set(key, await page.screenshot({ type: 'png', animations: 'disabled' }));
        if (seen.land !== null && tick >= seen.land + POST) return { seen, shots };
        if (tick > plan.limit) throw new Error(`pass 2 saw no strike by tick ${plan.limit} (pass 1 saw it earlier): a missed or late cast`);
      }
      await clock.run(16);
    }
    throw new Error('no cast within 6000 frames');
  } finally { await context.close(); }
}

const cmp = await browser.newPage();   // a blank page that decodes both PNGs and counts the pixels that differ in any channel
await cmp.goto('about:blank');
const diff = (a, b) => cmp.evaluate(async ([x, y]) => {
  const load = async (s) => { const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${s}`)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height); };
  const p = await load(x), q = await load(y);
  if (p.width !== q.width || p.height !== q.height) return { size: [p.width, p.height, q.width, q.height] };
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < p.data.length; i += 4) { const d = Math.max(Math.abs(p.data[i] - q.data[i]), Math.abs(p.data[i + 1] - q.data[i + 1]), Math.abs(p.data[i + 2] - q.data[i + 2]), Math.abs(p.data[i + 3] - q.data[i + 3])); if (d) { n++; max = Math.max(max, d); const px = (i / 4) % p.width, py = Math.floor(i / 4 / p.width); x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); } }
  return { n, max, box: n ? [x0, y0, x1, y1] : null, total: p.width * p.height };
}, [a.toString('base64'), b.toString('base64')]);

await fs.mkdir(OUT, { recursive: true });
const rows = []; let kept = 0;
for (const special of names) {
  try {
    const [sa, sa2, sb] = await Promise.all([run('a', special, null), run('a2', special, null), run('b', special, null)]);   // pass 1: where the wind-up starts and the strike lands, per build
    const row = { special, a: sa, a2: sa2, b: sb, windup: [sa.land - sa.start, sa2.land - sa2.start, sb.land - sb.start], timingSame: sa.land - sa.start === sb.land - sb.start, noiseTimingSame: sa.land - sa.start === sa2.land - sa2.start, shots: 0, flagged: [] };
    const plan = (s) => ({ from: Math.max(0, s.start - PRE), limit: s.land + POST + 120 });   // limit: the strike pass 1 saw + POST + slack; a pass 2 that gets past it never saw the strike
    const [ra, ra2, rb] = await Promise.all([run('a', special, plan(sa)), run('a2', special, plan(sa2)), run('b', special, plan(sb))]);   // pass 2: shoot, matched by offset from each run's own wind-up start / strike
    row.shotsList = [];
    for (const [tick, pa] of ra.shots) {
      const pa2 = ra2.shots.get(tick), pb = rb.shots.get(tick); if (!pa2 || !pb) { row.flagged.push({ tick, missing: !pa2 ? 'a2' : 'b' }); continue; }
      row.shots++; const noise = await diff(pa, pa2), cross = await diff(pa, pb);
      const nn = noise.n ?? 0, cn = cross.n ?? 0; row.shotsList.push({ tick, noise: nn, cross: cn });
      if (cross.size || cn > nn * 1.5 + 25) {   // a cross diff clearly above the same-code noise at that tick
        row.flagged.push({ tick, noise: nn, ...cross });
        if (kept < KEEP) { kept++; await fs.mkdir(`${OUT}/${special}`, { recursive: true }); await fs.writeFile(`${OUT}/${special}/${tick}-a.png`, pa); await fs.writeFile(`${OUT}/${special}/${tick}-b.png`, pb); }
      }
    }
    rows.push(row);
    console.log(`${special}: wind-up ${row.timingSame ? `${sa.land - sa.start} ticks, same` : `DIFF a ${sa.land - sa.start} b ${sb.land - sb.start}`}${row.noiseTimingSame ? '' : ' (a vs a2 wind-up length differs: noisy run)'}, ${row.shots} shots, ${row.flagged.length} above noise`);
  } catch (e) { rows.push({ special, error: String(e.message ?? e) }); console.log(`${special}: ERROR ${e.message}`); }
}
await browser.close(); await servers.a.close(); await servers.a2.close(); await servers.b.close();

const bad = rows.filter((r) => r.error || !r.timingSame || r.flagged.length), cross = rows.reduce((t, r) => t + (r.shotsList ?? []).reduce((u, d) => u + d.cross, 0), 0), noise = rows.reduce((t, r) => t + (r.shotsList ?? []).reduce((u, d) => u + d.noise, 0), 0);
const md = [`# Visual parity: ${A} (before) vs ${B} (after)`, '', `${rows.length} specials, ${rows.reduce((s, r) => s + (r.shots ?? 0), 0)} shots (375x812, every ${EVERY} ticks from the wind-up start to ${POST} after the strike; the draws turn on ${PRE} ticks before the wind-up so its first frame is a live one). ${bad.length} specials with a timing difference, an error or a shot above the noise floor. Differing pixels in all: before-vs-after ${cross}, before-vs-before (same code, the noise floor) ${noise}.`, '',
  '| special | wind-up ticks before | wind-up ticks after | shots | above noise | px before-vs-after | px noise |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => r.error ? `| ${r.special} | ERROR ${r.error} | | | | | |` : `| ${r.special} | ${r.a.land - r.a.start} | ${r.b.land - r.b.start} | ${r.shots} | ${r.flagged.length} | ${r.shotsList.reduce((u, d) => u + d.cross, 0)} | ${r.shotsList.reduce((u, d) => u + d.noise, 0)} |`)].join('\n');
await fs.writeFile(`${OUT}/parity.json`, JSON.stringify({ a: A, b: B, every: EVERY, rows }, null, 1)); await fs.writeFile(`${OUT}/parity.md`, md + '\n');
console.log(md.split('\n').slice(0, 4).join('\n'));
process.exitCode = bad.length ? 3 : 0;
