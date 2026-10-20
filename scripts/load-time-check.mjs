// Load-time gate (Strategy ruling 2026-09-27, on Dom's words): the phone's wait, not a byte count, is what a change may not grow.
// It runs beside check-budget's per-fight (12 MB) and whole-of-dist (44 MB) caps, which stay (Lead ruling (a), 2026-09-28). Two builds on ONE runner, the PR's base and its
// head, each served the way frankendom.com serves it (nginx, HTTP/2, gzip at its default level 1 on html/js/css/json/svg and
// application/octet-stream, which is every .glb; webp, audio and wasm go as they are: /etc/nginx/sites-available/frankendom.com,
// read 2026-09-27). A fresh guest on a 393x852 mobile Chromium page, cache off, CDP network at 9 Mbps / 85 ms, seconds from
// navigation start to #attack-button enabled (first playable; looks streamed in after it never count). RUNS each, interleaved
// base, head, base, ...; medians compared. FAIL when head - base > DELTA_S, or when the head median is over LIMIT_S.
// Why a delta and not a bar (Lead's ruling (a)): the absolute time is CPU-bound on the runner's software GL and swung ~5 s
// between two ubuntu runners on the same live site (16.9 s in CI 36304847884, 21.9 s in 36305661196); base and head on the
// same runner cancel that. An intended rise needs Lead's ruling: the PR label `load-time-ruled` (LOAD_TIME_RULED=1, read live
// by the job) makes the delta report-only; the tripwire still fails. CI only (quality.yml `load-time`), never a deploy.sh row.
// Two pages (Strategy via Lead 2026-10-20: Zone 1's gfx cost, on by default since K6g, went unmeasured): `--page pit` (the default, the game's
// dist at the site root, ready at #attack-button enabled) and `--page zone1` (the origins preview build, artifacts/origins-preview, served under
// its vite base /preview/origins/ with the tree's public/ at the site root, where live serves the game's folders the zone fetches; ready when the
// hero and the zone kit have settled, the page's own stamp originsPreview.settledAt()). Same profile, same delta, same tripwire. The pages are the
// PAGES rows below; each writes its own receipt (pit keeps receipt.json).
// What zone1 does NOT catch (Lead 2026-10-20): per-frame render cost. settledAt is load-bound on purpose, because the cover's own lift on software
// GL is always its max hold (HF cpu-upgrade 6ad7a8345275124786e19cf7 + 6ad7aa6b5275124786e19e8e: 12 of 12 samples), so it timed the hold's jitter.
// A render cost like the K6g lift (+4.6 s on Zone 1) shows in the Pit row, which runs the same shared lift module. Instead zone1 adds a byte
// tripwire: after the stamp it keeps counting until the network is quiet (the whole load, ~28 MB / ~240 files on 2026-10-20) and fails when
// head grows past base by more than the row's mbDelta or filesDelta, even when the time delta sits inside jitter.
// Usage: node scripts/load-time-check.mjs <base dist> <head dist> [--page pit|zone1]
/* global window */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http2 from 'node:http2';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const DELTA_S = 1.0, LIMIT_S = 30, RUNS = Number(process.env.RUNS || 5), RULED = process.env.LOAD_TIME_RULED === '1', MBPS = 9, LATENCY_MS = 85, MB = 1048576;
const out = 'artifacts/load-time';

// The pages this gate can time. prefix: where the dist is mounted (its vite base). query: appended to the page address. spa: a path under the
// prefix answered with the dist's index.html (live's /s/ share links), or null. publicFrom: the folder (relative to the dist) served at the site
// root beside the prefix, or null (nothing outside the prefix). ready: runs in the page and returns { now, ready } (now in ms from navigation
// start). receipt: its file under artifacts/load-time/. bytes: null, or the whole-load tripwire { quietMs: the network is done after this long with
// no response finishing, capS: the longest it waits for that, mbDelta / filesDelta: how far head may grow past base }.
export const PAGES = {
  pit: { label: 'Pit', prefix: '/', query: '', spa: '/s/', publicFrom: null, receipt: 'receipt.json', bytes: null,
    ready: () => ({ now: performance.now(), ready: document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false' }) },
  // Zone 1 by name (?zone=1; the path form /zone/<id>/ is outside the vite base) with no presence server (?presence=0).
  zone1: { label: 'Zone 1', prefix: '/preview/origins/', query: '?zone=1&presence=0', spa: null, publicFrom: '../../public', receipt: 'receipt-zone1.json',
    bytes: { quietMs: 3000, capS: 120, mbDelta: 1.0, filesDelta: 10 },
    ready: () => { const at = window.originsPreview?.settledAt?.() ?? -1; return at >= 0 ? { now: at, ready: true } : { now: performance.now(), ready: false }; } },
};
export const DEFAULT_PAGE = 'pit';
/** `--page <name>` or `--page=<name>` (DEFAULT_PAGE when absent) and the positional args. Throws on an unknown page. */
export function parseArgs(argv) {
  const dirs = []; let page = DEFAULT_PAGE;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--page') page = argv[++i];
    else if (argv[i].startsWith('--page=')) page = argv[i].slice('--page='.length);
    else dirs.push(argv[i]);
  }
  if (!Object.hasOwn(PAGES, page)) throw new Error(`load-time-check: no page ${page} (pages: ${Object.keys(PAGES).join(', ')})`);
  return { page, dirs };
}
/** The file a request names, as [folder, path inside it], or null (404): under the page's prefix its dist, elsewhere its site-root folder. */
export function routeOf(spec, root, site, pathname) {
  const mine = pathname.startsWith(spec.prefix), base = mine ? root : site;
  if (base === null) return null;
  // location / try_files $uri $uri/ =404, and the spa path serves index.html.
  let file = mine && spec.spa !== null && pathname.startsWith(spec.prefix + spec.spa.slice(1)) ? '/index.html' : mine ? `/${pathname.slice(spec.prefix.length)}` : pathname;
  if (file.endsWith('/')) file += 'index.html';
  return [base, file];
}

// nginx's mime.types for what dist/ holds; anything else is its default_type, application/octet-stream (so a .glb is gzipped).
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/x-m4a', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon', '.xml': 'text/xml' };
const GZIP = new Set(['text/html', 'application/javascript', 'text/css', 'application/json', 'image/svg+xml', 'application/octet-stream']);

async function serveLikeLive(root, spec) {
  const site = spec.publicFrom === null ? null : path.resolve(root, spec.publicFrom);
  if (site !== null) await fs.access(site).catch(() => { throw new Error(`load-time-check: ${spec.label} serves ${site} at the site root and it is not there`); });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'load-time-')), key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=127.0.0.1', '-days', '1', '-keyout', key, '-out', cert], { stdio: 'ignore', timeout: 30000 });
  const cache = new Map();
  const server = http2.createSecureServer({ key: await fs.readFile(key), cert: await fs.readFile(cert), allowHTTP1: true }, async (req, res) => {
    const url = new URL(req.url, 'https://x');
    const hit = routeOf(spec, root, site, decodeURIComponent(url.pathname));
    if (!hit) { res.writeHead(404); res.end(); return; }
    const [base, file] = hit, full = path.join(base, path.normalize(file));
    if (!full.startsWith(path.normalize(base) + path.sep)) { res.writeHead(404); res.end(); return; }
    const bytes = await fs.readFile(full).catch(() => null);
    if (!bytes) { res.writeHead(404); res.end(); return; }
    const type = TYPES[path.extname(full)] ?? 'application/octet-stream';
    if (GZIP.has(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      if (!cache.has(full)) cache.set(full, gzipSync(bytes, { level: 1 }));
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', vary: 'Accept-Encoding' }); res.end(cache.get(full));
    } else { res.writeHead(200, { 'content-type': type, 'content-length': bytes.length }); res.end(bytes); }
  });
  // server.close() waits for every open session to end. A session the page left open (the zone page keeps fetching past the stamp) never ends
  // once the browser is gone, and with nothing else on the loop the top-level await is left unsettled: node exits 13 before the verdict prints
  // (HF cpu-upgrade job 6ad7a8345275124786e19cf7, --page zone1). So close destroys the sockets it still holds.
  const sockets = new Set();
  server.on('secureConnection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `https://127.0.0.1:${server.address().port}${spec.prefix}${spec.query}`, close: async () => { const closed = new Promise((resolve) => server.close(resolve)); for (const s of sockets) s.destroy(); await closed; await fs.rm(dir, { recursive: true, force: true }); } };
}

async function once(browser, url, spec) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    await page.route('**/*sentry.io/**', (r) => r.abort());
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const bytesPerSecond = (MBPS * 1e6) / 8;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY_MS, downloadThroughput: bytesPerSecond, uploadThroughput: bytesPerSecond });
    let bytes = 0, files = 0, lastAt = Date.now();
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; files += 1; lastAt = Date.now(); });
    // The whole load (spec.bytes): after the stamp, wait until no response has finished for quietMs (capS at most), then the totals.
    const whole = async (r) => {
      if (!spec.bytes) return r;
      const cap = Date.now() + spec.bytes.capS * 1000;
      while (Date.now() - lastAt < spec.bytes.quietMs && Date.now() < cap) await new Promise((ok) => setTimeout(ok, 200));
      return { ...r, totalMb: +(bytes / MB).toFixed(2), totalFiles: files, ...(Date.now() >= cap ? { quietCapped: true } : {}) };
    };
    await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
    // The page's own clock (performance.now() from navigation start, the figure ?perf=1 shows on a phone), polled from Node so a
    // busy renderer cannot hold the stamp back behind a rAF-driven wait.
    const deadline = Date.now() + 180000;
    for (;;) {
      const st = await page.evaluate(spec.ready).catch(() => null);
      if (st?.ready) return await whole({ s: +(st.now / 1000).toFixed(2), mb: +(bytes / MB).toFixed(2), files });
      if (Date.now() > deadline) throw new Error(`not playable within 180 s (${(bytes / MB).toFixed(2)} MB in ${files} files)`);
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally { await context.close(); }
}

async function main() {
  const { page: pageName, dirs: [baseDir, headDir] } = parseArgs(process.argv.slice(2)), spec = PAGES[pageName];
  if (!baseDir || !headDir) throw new Error('usage: node scripts/load-time-check.mjs <base dist> <head dist> [--page pit|zone1]');
  const sites = { base: await serveLikeLive(baseDir, spec), head: await serveLikeLive(headDir, spec) };
  const browser = await chromium.launch({ headless: true });
  const receipt = { page: pageName, profile: `${MBPS} Mbps / ${LATENCY_MS} ms`, runs: RUNS, deltaLimitS: DELTA_S, limitS: LIMIT_S, ruled: RULED, base: { dir: baseDir, samples: [] }, head: { dir: headDir, samples: [] }, passed: false };
  try {
    for (let i = 0; i < RUNS; i++) for (const side of ['base', 'head']) {
      const r = await once(browser, sites[side].url, spec); receipt[side].samples.push(r); console.log(`load-time ${side} ${i + 1}: ${JSON.stringify(r)}`);
    }
    for (const side of ['base', 'head']) {
      const sorted = [...receipt[side].samples].sort((a, b) => a.s - b.s), mid = sorted[Math.floor(sorted.length / 2)];
      Object.assign(receipt[side], { medianS: mid.s, mb: mid.mb, files: mid.files });
      if (spec.bytes) Object.assign(receipt[side], { totalMb: median(receipt[side].samples.map((x) => x.totalMb)), totalFiles: median(receipt[side].samples.map((x) => x.totalFiles)) });
    }
    receipt.deltaS = +(receipt.head.medianS - receipt.base.medianS).toFixed(2);
    receipt.deltaFail = receipt.deltaS > DELTA_S && !RULED;
    receipt.limitFail = receipt.head.medianS > LIMIT_S;
    if (spec.bytes) Object.assign(receipt, bytesVerdict(spec.bytes, receipt.base, receipt.head, RULED));
    receipt.passed = !receipt.deltaFail && !receipt.limitFail && !receipt.bytesFail;
  } finally {
    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(`${out}/${spec.receipt}`, JSON.stringify(receipt, null, 2));
    await browser.close(); await sites.base.close(); await sites.head.close();
  }
  const { base, head } = receipt;
  console.log(`load-time-check: ${spec.label} first playable at ${receipt.profile}, median of ${RUNS}: base ${base.medianS} s (${base.mb} MB, ${base.files} files), head ${head.medianS} s (${head.mb} MB, ${head.files} files), delta ${receipt.deltaS >= 0 ? '+' : ''}${receipt.deltaS} s (limit +${DELTA_S} s; tripwire ${LIMIT_S} s)`);
  if (RULED) console.log(`load-time-check: label load-time-ruled is on this PR (Lead's ruling): the delta is report-only; the ${LIMIT_S} s tripwire still applies`);
  if (receipt.deltaFail) console.error(`load-time-check: FAIL, head is ${receipt.deltaS} s slower than base (over +${DELTA_S} s). An intended rise needs Lead's ruling: the PR label load-time-ruled.`);
  if (receipt.limitFail) console.error(`load-time-check: FAIL, the head median ${head.medianS} s is over the ${LIMIT_S} s tripwire`);
  if (spec.bytes) console.log(`load-time-check: ${spec.label} whole load, median: base ${base.totalMb} MB / ${base.totalFiles} files, head ${head.totalMb} MB / ${head.totalFiles} files (limit +${spec.bytes.mbDelta} MB, +${spec.bytes.filesDelta} files)`);
  if (receipt.bytesFail) console.error(`load-time-check: FAIL, head loads ${receipt.mbGrowth} MB / ${receipt.filesGrowth} files more than base. An intended rise needs Lead's ruling: the PR label load-time-ruled.`);
  if (!receipt.passed) process.exit(1);
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
/** The whole-load tripwire: head's totals against base's, failing past mbDelta or filesDelta unless ruled (the label makes it report-only, like the time delta). */
export function bytesVerdict(limits, base, head, ruled) {
  const mbGrowth = +(head.totalMb - base.totalMb).toFixed(2), filesGrowth = head.totalFiles - base.totalFiles;
  return { mbGrowth, filesGrowth, bytesFail: (mbGrowth > limits.mbDelta || filesGrowth > limits.filesDelta) && !ruled };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
