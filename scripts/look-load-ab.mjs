// Load-time A/B for a tier look shipped as a whole-body swap (Lead's size ruling, 2026-09-27): the game's own `?perf=1` stamp
// ("first fight at N s" in #perf, main.ts) at 9 Mbps (CDP network emulation), fresh context per run, base body vs look body
// swapped on disk between variants (vite dev serves src/assets from disk). Gate: look head ≤ base + 1.0 s; tripwire 25 s.
//   node scripts/look-load-ab.mjs --opponent goblin --target src/assets/goblin.glb --base <glb> --look <glb> [--runs 3] [--mbps 9]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OPP = arg('--opponent', 'goblin'), TARGET = arg('--target'), BASE = arg('--base'), LOOK = arg('--look'), RUNS = Number(arg('--runs', 3)), MBPS = Number(arg('--mbps', 9)), LABEL = arg('--label', `${OPP}-load-ab`);
const DIST_BASE = arg('--dist-base'), DIST_LOOK = arg('--dist-look');   // dist mode (Lead 2026-09-27): two `vite build` outputs (meshopt-packed, as shipped), served gzipped like the host
// A gzip-serving static server for a built dist (vite preview sends bytes raw; the host compresses): SPA fallback to index.html.
async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p); let data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const type = types[path.extname(file)] ?? 'application/octet-stream'; const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise(r => srv.close(r)) };
}
const dist = DIST_BASE && DIST_LOOK;
const server = dist ? null : await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); if (server) await server.listen();
let origin = server ? server.resolvedUrls.local[0].replace(/\/$/, '') : ''; let served = null;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const out = { opponent: OPP, mode: DIST_BASE ? 'dist (vite build, gzip-served)' : 'vite dev server (raw bytes)', mbps: MBPS, runs: RUNS, variants: {} };
try {
  for (const [name, file] of dist ? [['base', DIST_BASE], ['look', DIST_LOOK]] : [['base', BASE], ['look', LOOK]]) {
    if (dist) { served = await serveDist(file); origin = served.origin; } else await fs.copyFile(file, TARGET);
    out.variants[name] = { file, bytes: dist ? undefined : (await fs.stat(file)).size, stamps: [] };
    for (let r = 0; r < RUNS; r++) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
      const page = await context.newPage(); const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: MBPS * 1e6 / 8, uploadThroughput: MBPS * 1e6 / 8 });
      await page.route('**/*sentry.io/**', (x) => x.abort());
      // The stamp is taken at the first PLAYABLE frame (main.ts fightPlayable), which is after the arena is entered: a guest profile first
      // (unthrottled warm-up, like herolook-game-stills), then the measured load, tapping "Enter the arena" the moment it shows.
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await page.goto(`${origin}/?opponent=${OPP}`); await page.waitForFunction(() => localStorage.getItem('frankendom.fighter.v1'));
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: MBPS * 1e6 / 8, uploadThroughput: MBPS * 1e6 / 8 });
      const t0 = Date.now(); let stamp = NaN;
      try {
        await page.goto(`${origin}/?opponent=${OPP}&perf=1`);
        const enter = page.getByRole('button', { name: 'Enter the arena' });
        for (let w = 0; w < 600; w++) { if (/first fight at [\d.]+ s/.test(await page.textContent('#perf').catch(() => ''))) break; if (await enter.isVisible().catch(() => false)) { await enter.tap(); break; } await page.waitForTimeout(100); }
        await page.waitForFunction(() => /first fight at [\d.]+ s/.test(document.querySelector('#perf')?.textContent ?? ''), null, { timeout: 60000 });
        stamp = Number(/first fight at ([\d.]+) s/.exec(await page.textContent('#perf'))[1]);
      } catch (e) { out.variants[name].error = String(e).slice(0, 200); }
      out.variants[name].stamps.push({ stamp, wall: +((Date.now() - t0) / 1000).toFixed(1) }); console.log(`${name} run ${r + 1}: first fight at ${stamp} s (wall ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      await context.close();
    }
    if (served) { await served.close(); served = null; }
  }
} finally { if (!dist) await fs.copyFile(LOOK, TARGET); await browser.close(); if (server) await server.close(); }   // the tree keeps the look installed for the stills
const med = (a) => { const s = a.map(x => x.stamp).filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
out.base = med(out.variants.base.stamps); out.look = med(out.variants.look.stamps); out.delta = +(out.look - out.base).toFixed(2); out.pass = out.delta <= 1.0 && out.look <= 25;
await fs.mkdir(`artifacts/armour/${LABEL}`, { recursive: true }); await fs.writeFile(`artifacts/armour/${LABEL}/receipt.json`, JSON.stringify(out, null, 2));
console.log(`median first fight: base ${out.base} s, look ${out.look} s, delta ${out.delta} s → ${out.pass ? 'PASS' : 'FAIL'} (gate ≤ +1.0 s, tripwire 25 s); artifacts/armour/${LABEL}/receipt.json`);
