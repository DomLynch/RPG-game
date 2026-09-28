// Release row: a shared fight replays to the SAME outcome in the browser and in Node (Strategy via Lead, 2026-09-29; Code Quality owns
// the row, Combat the fixtures and the divergence tool). Background: a Dwarf record replayed as a hero loss in the browser (tick 2,172)
// while Node said a hero win (2,248), and Node alone could not reproduce it; record-replay-check and kill-link-check are Node-only, so no
// row compared the two until this one.
//
// One pinned record per playable roster opponent (tests/fixtures/browser-replay-records.json). Each is replayed twice:
//   Node    — exactly as the page constructs it (match.ts startReplay): initialPractice(record.seed, opponentAt(opp, level), weapon, skill),
//             then stepPractice over the record's intents with profileAt(opp, level) until the finish;
//   browser — the page itself at /?opponent=<opp>&replay=<share string>, served from THIS tree (vite dev, the source on disk), run to its
//             'Replay over' banner; the page writes the end state to #debug's data-replay (main.ts, "<tick>/<victim|draw>") as it writes
//             data-record for a live fight.
// The row passes only when, for every opponent, the fixture's pinned outcome, the Node replay and the browser replay agree on the victim,
// the draw flag and the end tick, and the browser page raised no error. A record the decoder refuses (a version bump) FAILS with the
// regenerate command: the bump's PR carries the new fixture (fix-forward), so the row is never vacuous.
//
// Serving: the vite dev server on this checkout by default, so the browser runs the same source Node just stepped, by construction. --dist
// <dir> serves a built dist instead, and only one this tree made: <dir>/release.json's revision and index.html's data-release stamp must
// both equal `git rev-parse HEAD`, else the row refuses (the prime suspect in the Dwarf case was an unverified dist/ served by another
// harness's --dist). Either way the receipt records the revision and whether the sim files were dirty.
//
// Usage: node scripts/browser-replay-check.mjs [--only goblin,dwarf] [--concurrency 2] [--dist dist]
//        node scripts/browser-replay-check.mjs --write            regenerate the fixture (Combat's method: L18, AI hero, seeds 731 + 97k)
// Receipt: artifacts/browser-replay-check/receipt.json. Exits 1 on any disagreement, page error or refused record.
/* global document */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { initialPractice, stepPractice, PROFILES } from '../src/combat.ts';
import { createRecorder, decodeRecord, encodeRecord, RECORD_VERSION } from '../src/record.ts';
import { LEVEL_ANCHORS, OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { decide, initialAi } from '../src/ai.ts';

export const FIXTURE = new URL('../tests/fixtures/browser-replay-records.json', import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

/** The playable roster: held bodies have no live fights to link (the page's opponentFor falls back to the Centurion for them). */
export const playable = () => Object.keys(ROSTER).filter((id) => !ROSTER[id].hold);
/** Combat's per-tick state hash (replay-fixtures.mts / dwarf828.mts): the same expression bisects a browser run to its first divergent second. */
export const stateHash = (p) => createHash('sha256').update(JSON.stringify({ d: p.duel, f: p.finish })).digest('hex').slice(0, 12);
export const loadFixture = () => JSON.parse(readFileSync(FIXTURE, 'utf8'));

/** The page's own construction of a decoded record (match.ts startReplay), stepped to the finish. */
export function replayInNode(record, sampleEvery = 60) {
  const o = OPPONENTS[record.opponent];
  let p = initialPractice(record.seed, opponentAt(o, record.level), record.weapon, record.skill ?? null);
  const hashes = {};
  for (let t = 0; t < record.intents.length && !p.finish; t++) {
    p = stepPractice(p, record.intents[t], profileAt(o, record.level));
    if (p.duel.tick % sampleEvery === 0) hashes[p.duel.tick] = stateHash(p);
  }
  hashes[p.duel.tick] = stateHash(p);
  return { victim: p.finish?.victim ?? null, draw: !!p.finish?.draw, tick: p.duel.tick, finished: !!p.finish, hashes };
}

/** Combat's recording method (replay-fixtures.mts): L18, the AI drives the hero, tick 0 forced 'light', the first seed of 731 + 97k that ends. */
export async function generateFixture() {
  const level = LEVEL_ANCHORS.normal, records = [];
  for (const id of playable()) {
    for (let k = 0; k < 20; k++) {
      const seed = 731 + 97 * k, recorder = createRecorder({ build: 'replay-row', opponent: id, weapon: 'longsword', level, seed });
      let p = initialPractice(seed, opponentAt(OPPONENTS[id], level)), hero = initialAi(seed ^ 0x5bd1e995), killed = -1;
      while (!p.finish && p.duel.tick < 7200) {
        const w = decide(p.duel, 0, hero, PROFILES.normal); hero = w.ai;
        p = stepPractice(p, recorder.push(p.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[id], level));
        if (killed < 0 && p.events.some((e) => e.type === 'Killed')) killed = p.duel.tick;
      }
      if (!p.finish) continue;
      const won = !p.finish.draw && p.finish.victim === 1, encoded = await encodeRecord(recorder.finish(won ? 'killed' : 'died'));
      const back = replayInNode(await decodeRecord(encoded));   // the page path must agree with the live fight before it is pinned
      if (back.tick !== p.duel.tick || back.victim !== p.finish.victim || back.draw !== !!p.finish.draw) throw new Error(`${id} ${seed}: the Node round trip disagrees with the live fight`);
      records.push({ opponent: id, seed, level, encoded, expect: { victim: p.finish.victim, draw: !!p.finish.draw, tick: p.duel.tick, killedTick: killed }, hashes: back.hashes });
      break;
    }
  }
  return records;
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

async function main() {
  if (process.argv.includes('--write')) {
    const records = await generateFixture();
    const note = loadFixture().note;
    writeFileSync(FIXTURE, `${JSON.stringify({ note, generated: { revision: git('rev-parse', '--short', 'HEAD'), recordVersion: RECORD_VERSION, by: 'scripts/browser-replay-check.mjs --write' }, records }, null, 1)}\n`);
    console.log(records.map((f) => `${f.opponent} seed ${f.seed}: victim ${f.expect.victim}${f.expect.draw ? ' (draw)' : ''} at ${f.expect.tick}`).join('\n'));
    return;
  }
  const started = Date.now(), only = arg('--only', '').split(',').filter(Boolean), concurrency = Math.max(1, Number(arg('--concurrency', 2)));
  const fixture = loadFixture(), records = fixture.records.filter((r) => !only.length || only.includes(r.opponent));
  const dir = `${root}artifacts/browser-replay-check`; mkdirSync(dir, { recursive: true });
  const receipt = { revision: git('rev-parse', 'HEAD'), dirtySim: git('status', '--porcelain', '--', 'src').split('\n').filter(Boolean), fixture: fixture.generated, served: null, results: {}, failures: [], passed: false, seconds: 0 };
  const fail = (where, detail) => { receipt.failures.push(`${where}: ${detail}`); console.error(`FAIL ${where}: ${detail}`); };

  // Leg 1, Node: the fixture must still be what this tree replays (a refused version or a moved outcome = regenerate, with the PR as the receipt).
  const decoded = new Map();
  for (const f of records) {
    try {
      const record = await decodeRecord(f.encoded), node = replayInNode(record);
      decoded.set(f.opponent, { record, node });
      if (!node.finished) fail(f.opponent, `Node replay never finished (tick ${node.tick})`);
      else if (node.victim !== f.expect.victim || node.draw !== f.expect.draw || node.tick !== f.expect.tick) fail(f.opponent, `fixture stale: Node replays victim ${node.victim}${node.draw ? ' (draw)' : ''} at ${node.tick}, pinned victim ${f.expect.victim}${f.expect.draw ? ' (draw)' : ''} at ${f.expect.tick}. A deliberate rules change re-pins: node scripts/browser-replay-check.mjs --write`);
    } catch (error) { fail(f.opponent, `record refused: ${error.message}. A record bump regenerates the fixture: node scripts/browser-replay-check.mjs --write`); }
  }
  const expected = playable();
  if (JSON.stringify(records.map((r) => r.opponent)) !== JSON.stringify(only.length ? expected.filter((id) => only.includes(id)) : expected)) fail('fixture', `records for [${records.map((r) => r.opponent)}], the playable roster is [${expected}]: regenerate`);

  // Leg 2, browser: the page itself, on this tree's source.
  const { chromium } = await import('playwright');
  const server = arg('--dist') ? await serveDist(arg('--dist')) : await serveTree(); receipt.served = server.served;
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });   // full Chrome for Testing: the GPU, not the headless shell's SwiftShader (row 46's lesson)
  try {
    const queue = records.filter((f) => decoded.has(f.opponent));
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        const t0 = Date.now(), errors = [], context = await browser.newContext({ viewport: { width: 1024, height: 768 } }), page = await context.newPage();
        page.setDefaultTimeout(90000); page.on('pageerror', (e) => errors.push(String(e))); await page.route('**/*sentry.io/**', (r) => r.abort());
        const result = { opponent: f.opponent, node: decoded.get(f.opponent).node, browser: null, errors, seconds: 0 };
        try {
          await page.goto(`${server.origin}/?opponent=${f.opponent}&replay=${f.encoded}`, { waitUntil: 'commit' });
          await page.waitForFunction(() => document.getElementById('replay-banner')?.textContent === 'Replay', null, { polling: 100 });   // decoded, fast-forwarded to the tail, running
          const end = await page.waitForFunction(() => document.getElementById('debug')?.dataset.replay ?? null, null, { polling: 100 });   // main.ts writes "<tick>/<victim>/<draw 0|1>" on 'Replay over'
          const [tick, victim, draw] = String(await end.jsonValue()).split('/');
          result.browser = { tick: Number(tick), victim: victim === '' ? null : Number(victim), draw: draw === '1', banner: await page.locator('#replay-banner').textContent() };
        } catch (error) { errors.push(`browser leg: ${error.message.split('\n')[0]}`); }
        finally { await context.close(); }
        result.seconds = +((Date.now() - t0) / 1000).toFixed(1); receipt.results[f.opponent] = result;
        const n = result.node, b = result.browser;
        if (!b) fail(f.opponent, `no browser outcome (${errors.join('; ') || 'no error captured'})`);
        else if (b.draw !== n.draw || b.victim !== n.victim || b.tick !== n.tick) fail(f.opponent, `browser replays ${b.draw ? 'a draw' : `victim ${b.victim}`} at tick ${b.tick}, Node ${n.draw ? 'a draw' : `victim ${n.victim}`} at ${n.tick} (banner "${b.banner}"); bisect with Combat's dwarf828.mts and the fixture's hashes`);
        if (errors.length && b) fail(f.opponent, `page errors: ${errors.join('; ')}`);
        console.log(`${f.opponent}: node victim ${n.draw ? 'draw' : n.victim} @ ${n.tick} | browser ${b ? `${b.draw ? 'draw' : `victim ${b.victim}`} @ ${b.tick}` : 'none'} | ${result.seconds}s${errors.length ? ` | errors ${errors.length}` : ''}`);
      }
    }));
  } finally { await browser.close(); await server.close(); }
  receipt.seconds = +((Date.now() - started) / 1000).toFixed(1); receipt.passed = !receipt.failures.length;
  writeFileSync(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(`browser-replay-check: ${receipt.passed ? 'PASS' : `FAIL (${receipt.failures.length})`} ${records.length} records, ${receipt.served}, ${receipt.seconds}s; receipt ${dir}/receipt.json`);
  process.exit(receipt.passed ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
