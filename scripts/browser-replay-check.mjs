// Release row: a shared fight replays to the SAME outcome in the browser and in Node (Strategy via Lead, 2026-09-29; Code Quality owns
// the row, Combat the fixtures and the divergence tool). Background: a Dwarf record (seed 828) replayed as a hero loss in the browser
// (tick 2,172) while Node said a hero win (2,248), and Node alone could not reproduce it. Combat's cause (2026-09-29): ENGINE NUMERICS,
// Node's V8 and Playwright's Chromium disagree by 1 ulp on some Math.atan2 / Math.sin calls, so the pure sim splits at tick 1,412 of that
// fight. record-replay-check and kill-link-check are Node-only, so no row compared the two engines until this one; it is the gate for the
// fix (src/detmath.ts, Combat) and stays as the standing guard.
//
// Fixtures (tests/fixtures/browser-replay-records.json, Strategy's spec: at least one record per playable roster opponent, plus every
// known-divergent record): each is replayed twice:
//   Node    — exactly as the page constructs it (match.ts startReplay): initialPractice(record.seed, opponentAt(opp, level), weapon, skill),
//             then stepPractice over the record's intents until the finish;
//   browser — the page itself at /?opponent=<opp>&replay=<share string>, served from THIS tree (vite dev, the source on disk); the page
//             steps the whole record in Chromium (the silent fast-forward, then the rendered tail) and on 'Replay over' writes the end state
//             to #debug's data-replay (main.ts, "<tick>/<victim>/<draw>") as it writes data-record for a live fight.
// The row passes only when, for every fixture, the pinned outcome, the Node replay and the browser replay agree on the victim, the draw
// flag and the end tick, and the browser page raised no error. A record the decoder refuses (a version bump) FAILS with the regenerate
// command: the bump's PR carries the new fixture (fix-forward), so the row is never vacuous.
//
// Serving: the vite dev server on this checkout by default, so the browser runs the same source Node just stepped, by construction. --dist
// <dir> serves a built dist instead, and only one this tree made: <dir>/release.json's revision and index.html's data-release stamp must
// both equal `git rev-parse HEAD`, else the row refuses (an unverified dist/ served by another harness's --dist was the first suspect).
// Either way the receipt records the revision and whether src/ was dirty.
//
// Usage: node scripts/browser-replay-check.mjs [--only goblin,dwarf] [--concurrency 2] [--dist dist]
//        node scripts/browser-replay-check.mjs --write                    regenerate the fixture (Combat's method, below) on this tree
//        node scripts/browser-replay-check.mjs --engine webkit [--count-flips N]   the same compare in Playwright's WebKit (Safari's engine;
//                                                                        Dom plays on iPhone/iPad Safari): release row 49, fixtures only
//                                                                        (Strategy 2026-09-29); receipt-webkit.json. Default engine: chromium.
//        node scripts/browser-replay-check.mjs --count-flips N [--only …]  Combat's engine gate: N standard-battery seeds per opponent
//                                                                        (731 + 97k), each fought in Node and replayed in Chromium; counts
//                                                                        the fights whose outcome flips between the engines; exit 1 if any.
// Receipt: artifacts/browser-replay-check/receipt.json. Exits 1 on any disagreement, page error or refused record.
/* global document */
import { harnessClock, skipDraws } from './lib/harness-clock.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { initialPractice, stepPractice, PROFILES } from '../src/combat.ts';
import { recordSpecials } from '../src/replay.ts';
import { createRecorder, decodeRecord, encodeRecord, RECORD_VERSION } from '../src/record.ts';
import { underPlayScale } from '../src/play-radius.ts';
import { setStab } from '../src/stab-rule.ts';
import { LEVEL_ANCHORS, OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { decide, initialAi } from '../src/ai.ts';
import { underRecord } from '../src/detmath.ts';

export const FIXTURE = new URL('../tests/fixtures/browser-replay-records.json', import.meta.url);
/** Known-divergent records (Strategy's "plus every known-divergent record"), pinned at their exact seed after the roster set. */
export const REPROS = [
  { opponent: 'dwarf', seed: 828, label: '2026-09-29 repro (Finishers): the browser replayed a hero loss at 2,172 while Node said a hero win at 2,248; Combat: engine numerics, first divergent tick 1,412' },
];
const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ENGINE = arg('--engine', 'chromium');
if (!['chromium', 'webkit'].includes(ENGINE)) throw new Error(`--engine ${ENGINE}: chromium (row 48) or webkit (Safari's engine)`);
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10_000 }).trim();   // bounded (tests/child-process-bounds.test.ts)
const MAX_TICKS = 7200;

/** The playable roster: held bodies have no live fights to link (the page's opponentFor falls back to the Centurion for them). */
export const playable = () => Object.keys(ROSTER).filter((id) => !ROSTER[id].hold);
/** Combat's per-tick state hash (replay-fixtures.mts / dwarf828.mts): the same expression bisects a browser run to its first divergent second. */
export const stateHash = (p) => createHash('sha256').update(JSON.stringify({ d: p.duel, f: p.finish })).digest('hex').slice(0, 12);
export const loadFixture = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));
const outcomeOf = (p) => ({ victim: p.finish?.victim ?? null, draw: !!p.finish?.draw, tick: p.duel.tick, finished: !!p.finish });
const sameOutcome = (a, b) => a.victim === b.victim && a.draw === b.draw && a.tick === b.tick;
const show = (o) => o ? `${o.draw ? 'draw' : `victim ${o.victim}`} @ ${o.tick}` : 'none';

/** The page's own construction of a decoded record (match.ts startReplay), stepped to the finish. */
export function replayInNode(record, sampleEvery = 60) {
  return underRecord(record, () => {   // the record's version picks the sim's math (src/detmath.ts), exactly as match.ts startReplay does
    const o = OPPONENTS[record.opponent];
    let p = initialPractice(record.seed, opponentAt(o, record.level), record.weapon, record.skill ?? null, recordSpecials(record));
    const hashes = {};
    for (let t = 0; t < record.intents.length && !p.finish; t++) {
      p = stepPractice(p, record.intents[t], profileAt(o, record.level));
      if (p.duel.tick % sampleEvery === 0) hashes[p.duel.tick] = stateHash(p);
    }
    hashes[p.duel.tick] = stateHash(p);
    return { ...outcomeOf(p), hashes };
  });
}

/** One standard-battery fight, recorded as rank-look-check records (Combat's method): L18, the AI drives the hero, tick 0 forced 'light'. */
export async function recordFight(opponent, seed) {
  setStab(true);   // a live fight (the Goblin's stab is an era flag, stab-rule.ts): without it the record is stamped v24, which RECORD_VERSION 29 refuses
  const level = LEVEL_ANCHORS.normal;
  const { p, killed, recorder } = underPlayScale(opponent, RECORD_VERSION, () => {   // fought in the circle this build records it in (play-radius.ts); the recorder is born inside it, so its version stamp names that circle
    const recorder = createRecorder({ build: 'replay-row', opponent, weapon: 'longsword', level, seed });
    let p = initialPractice(seed, opponentAt(OPPONENTS[opponent], level)), hero = initialAi(seed ^ 0x5bd1e995), killed = -1;
    while (!p.finish && p.duel.tick < MAX_TICKS) {
      const w = decide(p.duel, 0, hero, PROFILES.normal); hero = w.ai;
      p = stepPractice(p, recorder.push(p.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[opponent], level));
      if (killed < 0 && p.events.some((e) => e.type === 'Killed')) killed = p.duel.tick;
    }
    return { p, killed, recorder };
  });
  if (!p.finish) return null;
  const won = !p.finish.draw && p.finish.victim === 1, encoded = await encodeRecord(recorder.finish(won ? 'killed' : 'died'));
  const back = replayInNode(await decodeRecord(encoded));   // the page path must agree with the live fight before anything is pinned or compared
  if (!sameOutcome(back, outcomeOf(p))) throw new Error(`${opponent} ${seed}: the Node round trip disagrees with the live fight (${show(back)} vs ${show(outcomeOf(p))})`);
  return { opponent, seed, level, encoded, expect: { victim: p.finish.victim, draw: !!p.finish.draw, tick: p.duel.tick, killedTick: killed }, hashes: back.hashes };
}

/** The fixture set: per playable opponent the first seed of 731 + 97k that ends, then every REPROS record at its exact seed (labelled). */
export async function generateFixture() {
  const records = [];
  for (const id of playable()) for (let k = 0; k < 20; k++) { const f = await recordFight(id, 731 + 97 * k); if (f) { records.push(f); break; } }
  for (const r of REPROS) {
    const f = await recordFight(r.opponent, r.seed);
    if (!f) throw new Error(`repro ${r.opponent} seed ${r.seed} never ends within ${MAX_TICKS} ticks`);
    records.push({ ...f, label: r.label });
  }
  return records;
}

/** The fixture's shape: the unlabelled records are the playable roster in order; labelled ones are the known-divergent repros. */
export function fixtureShapeError(records) {
  const roster = records.filter((r) => !r.label).map((r) => r.opponent), repros = records.filter((r) => r.label).map((r) => `${r.opponent}:${r.seed}`);
  if (JSON.stringify(roster) !== JSON.stringify(playable())) return `roster records [${roster}] but the playable roster is [${playable()}]`;
  const wanted = REPROS.map((r) => `${r.opponent}:${r.seed}`);
  if (JSON.stringify(repros) !== JSON.stringify(wanted)) return `repro records [${repros}] but REPROS is [${wanted}]`;
  return null;
}

async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path'), fs = await import('node:fs/promises');
  const revision = git('rev-parse', 'HEAD');
  const release = JSON.parse(readFileSync(path.join(dir, 'release.json'), 'utf8')), html = readFileSync(path.join(dir, 'index.html'), 'utf8');
  if (release.revision !== revision) throw new Error(`--dist ${dir} is not this tree's build: release.json says ${release.revision}, HEAD is ${revision}`);
  if (!html.includes(`data-release="${revision}"`)) throw new Error(`--dist ${dir}/index.html carries no data-release="${revision}" stamp`);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${srv.address().port}`, served: `dist ${dir} @ ${revision.slice(0, 8)} (verified)`, close: () => new Promise((r) => srv.close(r)) };
}

async function serveTree() {
  const { createServer } = await import('vite');
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  return { origin: `http://127.0.0.1:${server.httpServer.address().port}`, served: 'vite dev (this checkout)', close: () => server.close() };
}

/** The browser leg for one record: the page steps it in Chromium and reports the end state; errors are collected, never thrown. */
async function replayInBrowser(browser, origin, f) {
  const t0 = Date.now(), errors = [], context = await browser.newContext({ viewport: { width: 1024, height: 768 } }), page = await context.newPage();
  page.setDefaultTimeout(90000); page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
  let browserOut = null, banner = null, stage = 'boot';
  try {
    // Boot on real time (asset loads are promise-driven and machine-dependent): decoded, fast-forwarded, running.
    await page.goto(`${origin}/?opponent=${f.opponent}&replay=${f.encoded}`, { waitUntil: 'commit' });
    await page.waitForFunction(() => document.getElementById('replay-banner')?.textContent === 'Replay', null, { polling: 100, timeout: 120000 });
    // Then the replay's last seconds on the gate's clock with the canvas unpainted (scripts/lib/harness-clock.mjs). On a GPU-less runner
    // each painted frame is a ~0.5 s software-GL draw and the sim moves at most 0.1 s a frame, so on real time the tail outran the 90 s wait
    // on every fight (CI job 109179455928, 11/11). The replay steps recorded intents per tick, so the outcome doesn't depend on the clock.
    stage = 'play'; const clock = await harnessClock(page); await skipDraws(page, true);
    await clock.until(() => document.getElementById('debug')?.dataset.replay ?? null, 60_000);   // main.ts: "<tick>/<victim>/<draw 0|1>" on 'Replay over'
    const end = await page.evaluate(() => document.getElementById('debug').dataset.replay);
    const [tick, victim, draw] = String(end).split('/');
    browserOut = { tick: Number(tick), victim: victim === '' ? null : Number(victim), draw: draw === '1' }; banner = await page.locator('#replay-banner').textContent();
  } catch (error) {
    const at = await page.evaluate(() => ({ banner: document.getElementById('replay-banner')?.textContent, art: document.getElementById('art-status')?.textContent, tick: document.getElementById('debug')?.dataset.tick })).catch(() => ({}));
    errors.push(`browser leg (${stage}; banner ${JSON.stringify(at.banner)}, art ${JSON.stringify(at.art)}, tick ${at.tick ?? '?'}): ${error.message.split('\n')[0]}`);
  }
  finally { await context.close(); }
  return { browser: browserOut, banner, errors, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
}

/** Run `work` over `items`, `width` at a time, in order of pickup. */
async function pool(items, width, work) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(width, queue.length) }, async () => { for (let item = queue.shift(); item; item = queue.shift()) await work(item); }));
}

async function main() {
  if (process.argv.includes('--write')) {
    const records = await generateFixture();
    const note = loadFixture().note;
    writeFileSync(FIXTURE, `${JSON.stringify({ note, generated: { revision: git('rev-parse', '--short', 'HEAD'), recordVersion: RECORD_VERSION, by: 'scripts/browser-replay-check.mjs --write' }, records }, null, 1)}\n`);
    console.log(records.map((f) => `${f.opponent} seed ${f.seed}: victim ${f.expect.victim}${f.expect.draw ? ' (draw)' : ''} at ${f.expect.tick}${f.label ? ` [${f.label.slice(0, 40)}…]` : ''}`).join('\n'));
    return;
  }
  const started = Date.now(), only = arg('--only', '').split(',').filter(Boolean), concurrency = Math.max(1, Number(arg('--concurrency', 2))), flips = Number(arg('--count-flips', 0));
  const dir = `${root}artifacts/browser-replay-check`; mkdirSync(dir, { recursive: true });
  const receipt = { mode: flips ? `count-flips ${flips}` : 'fixtures', revision: git('rev-parse', 'HEAD'), dirtySrc: git('status', '--porcelain', '--', 'src').split('\n').filter(Boolean), engines: { node: process.version }, fixture: null, served: null, results: {}, failures: [], flips: null, passed: false, seconds: 0 };
  const fail = (where, detail) => { receipt.failures.push(`${where}: ${detail}`); console.error(`FAIL ${where}: ${detail}`); };
  const opponents = only.length ? playable().filter((id) => only.includes(id)) : playable();

  // The fights to compare: the pinned fixtures (checked against Node first), or N fresh standard-battery seeds per opponent.
  const fights = [];
  if (flips) {
    for (const id of opponents) for (let k = 0; k < flips; k++) {
      const seed = 731 + 97 * k, f = await recordFight(id, seed);
      if (f) fights.push({ key: `${id}:${seed}`, ...f, node: { victim: f.expect.victim, draw: f.expect.draw, tick: f.expect.tick } });
      else receipt.results[`${id}:${seed}`] = { skipped: `no finish within ${MAX_TICKS} ticks` };
    }
  } else {
    const fixture = loadFixture(); receipt.fixture = fixture.generated;
    const shape = fixtureShapeError(fixture.records); if (shape) fail('fixture', `${shape}: node scripts/browser-replay-check.mjs --write`);
    for (const f of fixture.records.filter((r) => !only.length || only.includes(r.opponent))) {
      const key = `${f.opponent}:${f.seed}`;
      try {
        const node = replayInNode(await decodeRecord(f.encoded));
        if (!node.finished) { fail(key, `Node replay never finished (tick ${node.tick})`); continue; }
        if (!sameOutcome(node, f.expect)) { fail(key, `fixture stale: Node replays ${show(node)}, pinned ${show(f.expect)}. A deliberate rules change re-pins: node scripts/browser-replay-check.mjs --write`); continue; }
        fights.push({ key, ...f, node });
      } catch (error) { fail(key, `record refused: ${error.message}. A record bump regenerates the fixture: node scripts/browser-replay-check.mjs --write`); }
    }
  }

  // The browser leg, on this tree's source.
  const playwright = await import('playwright');
  const server = arg('--dist') ? await serveDist(arg('--dist')) : await serveTree(); receipt.served = server.served;
  // chromium: full Chrome for Testing (the GPU, not the headless shell's SwiftShader, row 46's lesson). webkit: Playwright's WebKit build,
  // Safari's engine (JavaScriptCore), for the iPhone's numerics; page.clock and routing are engine-neutral.
  const browser = ENGINE === 'webkit' ? await playwright.webkit.launch({ headless: true }) : await playwright.chromium.launch({ headless: true, executablePath: playwright.chromium.executablePath() });
  receipt.engines[ENGINE] = browser.version();
  let flipped = 0, dead = 0;   // fail fast: after 2 browser legs with no outcome the rest are not run (an all-timeout row stays well under 10 min)
  try {
    await pool(fights, concurrency, async (f) => {
      if (dead >= 2) { fail(f.key, 'not run: 2 browser legs already gave no outcome (fail fast)'); return; }
      const run = await replayInBrowser(browser, server.origin, f), b = run.browser, n = f.node;
      if (!b) dead++;
      const flip = !!b && !sameOutcome(b, n);
      receipt.results[f.key] = { opponent: f.opponent, seed: f.seed, label: f.label, node: n, browser: b, banner: run.banner, flip, errors: run.errors, seconds: run.seconds };
      if (!b) fail(f.key, `no browser outcome (${run.errors.join('; ') || 'no error captured'})`);
      else if (flip) { flipped++; if (!flips) fail(f.key, `browser replays ${show(b)}, Node ${show(n)} (banner "${run.banner}"); bisect with Combat's dwarf828.mts and the fixture's hashes`); }
      if (run.errors.length && b) fail(f.key, `page errors: ${run.errors.join('; ')}`);
      console.log(`${f.key}${f.label ? ' [repro]' : ''}: node ${show(n)} | browser ${show(b)}${flip ? ' | FLIP' : ''} | ${run.seconds}s${run.errors.length ? ` | errors ${run.errors.length}` : ''}`);
    });
  } finally { await browser.close(); await server.close(); }
  if (flips) { receipt.flips = { fights: fights.length, flipped }; if (flipped) fail('engines', `${flipped} of ${fights.length} fights flip outcome between Node ${process.version} and ${ENGINE} ${receipt.engines[ENGINE]}`); }
  receipt.seconds = +((Date.now() - started) / 1000).toFixed(1); receipt.passed = !receipt.failures.length;
  const receiptFile = `${dir}/${ENGINE === 'chromium' ? 'receipt' : `receipt-${ENGINE}`}.json`;   // row 48's receipt.json stays Chromium's
  writeFileSync(receiptFile, JSON.stringify(receipt, null, 2));
  console.log(`browser-replay-check (${receipt.mode}): ${receipt.passed ? 'PASS' : `FAIL (${receipt.failures.length})`} ${fights.length} fights${flips ? `, ${flipped} flipped` : ''}, ${receipt.served}, node ${process.version} vs ${ENGINE} ${receipt.engines[ENGINE]}, ${receipt.seconds}s; receipt ${receiptFile}`);
  process.exit(receipt.passed ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
