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
// Usage: node scripts/load-time-check.mjs <base dist> <head dist>
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import http2 from 'node:http2';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const DELTA_S = 1.0, LIMIT_S = 30, RUNS = Number(process.env.RUNS || 5), RULED = process.env.LOAD_TIME_RULED === '1', MBPS = 9, LATENCY_MS = 85, MB = 1048576;
const out = 'artifacts/load-time';

// nginx's mime.types for what dist/ holds; anything else is its default_type, application/octet-stream (so a .glb is gzipped).
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/x-m4a', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.ico': 'image/x-icon', '.xml': 'text/xml' };
const GZIP = new Set(['text/html', 'application/javascript', 'text/css', 'application/json', 'image/svg+xml', 'application/octet-stream']);

async function serveLikeLive(root) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'load-time-')), key = path.join(dir, 'key.pem'), cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=127.0.0.1', '-days', '1', '-keyout', key, '-out', cert], { stdio: 'ignore', timeout: 30000 });
  const cache = new Map();
  const server = http2.createSecureServer({ key: await fs.readFile(key), cert: await fs.readFile(cert), allowHTTP1: true }, async (req, res) => {
    const url = new URL(req.url, 'https://x');
    // location / try_files $uri $uri/ =404, and /s/ serves index.html.
    let file = url.pathname.startsWith('/s/') ? '/index.html' : decodeURIComponent(url.pathname);
    if (file.endsWith('/')) file += 'index.html';
    const full = path.join(root, path.normalize(file));
    if (!full.startsWith(path.normalize(root) + path.sep)) { res.writeHead(404); res.end(); return; }
    const bytes = await fs.readFile(full).catch(() => null);
    if (!bytes) { res.writeHead(404); res.end(); return; }
    const type = TYPES[path.extname(full)] ?? 'application/octet-stream';
    if (GZIP.has(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      if (!cache.has(full)) cache.set(full, gzipSync(bytes, { level: 1 }));
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', vary: 'Accept-Encoding' }); res.end(cache.get(full));
    } else { res.writeHead(200, { 'content-type': type, 'content-length': bytes.length }); res.end(bytes); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `https://127.0.0.1:${server.address().port}/`, close: async () => { await new Promise((resolve) => server.close(resolve)); await fs.rm(dir, { recursive: true, force: true }); } };
}

async function once(browser, url) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    await page.route('**/*sentry.io/**', (r) => r.abort());
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const bytesPerSecond = (MBPS * 1e6) / 8;
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY_MS, downloadThroughput: bytesPerSecond, uploadThroughput: bytesPerSecond });
    let bytes = 0, files = 0;
    cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; files += 1; });
    await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
    // The page's own clock (performance.now() from navigation start, the figure ?perf=1 shows on a phone), polled from Node so a
    // busy renderer cannot hold the stamp back behind a rAF-driven wait.
    const deadline = Date.now() + 180000;
    for (;;) {
      const st = await page.evaluate(() => ({ now: performance.now(), ready: document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false' })).catch(() => null);
      if (st?.ready) return { s: +(st.now / 1000).toFixed(2), mb: +(bytes / MB).toFixed(2), files };
      if (Date.now() > deadline) throw new Error(`not playable within 180 s (${(bytes / MB).toFixed(2)} MB in ${files} files)`);
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally { await context.close(); }
}

const [baseDir, headDir] = process.argv.slice(2);
if (!baseDir || !headDir) throw new Error('usage: node scripts/load-time-check.mjs <base dist> <head dist>');
const sites = { base: await serveLikeLive(baseDir), head: await serveLikeLive(headDir) };
const browser = await chromium.launch({ headless: true });
const receipt = { profile: `${MBPS} Mbps / ${LATENCY_MS} ms`, runs: RUNS, deltaLimitS: DELTA_S, limitS: LIMIT_S, ruled: RULED, base: { dir: baseDir, samples: [] }, head: { dir: headDir, samples: [] }, passed: false };
try {
  for (let i = 0; i < RUNS; i++) for (const side of ['base', 'head']) {
    const r = await once(browser, sites[side].url); receipt[side].samples.push(r); console.log(`load-time ${side} ${i + 1}: ${JSON.stringify(r)}`);
  }
  for (const side of ['base', 'head']) {
    const sorted = [...receipt[side].samples].sort((a, b) => a.s - b.s), mid = sorted[Math.floor(sorted.length / 2)];
    Object.assign(receipt[side], { medianS: mid.s, mb: mid.mb, files: mid.files });
  }
  receipt.deltaS = +(receipt.head.medianS - receipt.base.medianS).toFixed(2);
  receipt.deltaFail = receipt.deltaS > DELTA_S && !RULED;
  receipt.limitFail = receipt.head.medianS > LIMIT_S;
  receipt.passed = !receipt.deltaFail && !receipt.limitFail;
} finally {
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); await sites.base.close(); await sites.head.close();
}
const { base, head } = receipt;
console.log(`load-time-check: first playable at ${receipt.profile}, median of ${RUNS}: base ${base.medianS} s (${base.mb} MB, ${base.files} files), head ${head.medianS} s (${head.mb} MB, ${head.files} files), delta ${receipt.deltaS >= 0 ? '+' : ''}${receipt.deltaS} s (limit +${DELTA_S} s; tripwire ${LIMIT_S} s)`);
if (RULED) console.log(`load-time-check: label load-time-ruled is on this PR (Lead's ruling): the delta is report-only; the ${LIMIT_S} s tripwire still applies`);
if (receipt.deltaFail) console.error(`load-time-check: FAIL, head is ${receipt.deltaS} s slower than base (over +${DELTA_S} s). An intended rise needs Lead's ruling: the PR label load-time-ruled.`);
if (receipt.limitFail) console.error(`load-time-check: FAIL, the head median ${head.medianS} s is over the ${LIMIT_S} s tripwire`);
if (!receipt.passed) process.exit(1);
