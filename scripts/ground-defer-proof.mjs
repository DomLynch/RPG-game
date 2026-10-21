// What a phone fetches before [zone ready], before vs after the ground-model defer: serve a built checkout (gzip on, like the host), phone-tier load of Zone 1, record every request with its gzip size, split at the moment `window.__zoneReady` appears.
// Usage: node scripts/ground-defer-proof.mjs <built checkout root> <label> <out dir>   (software GL: bytes and order are real, timings are not)
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const [root, label, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${root}/artifacts/origins-preview/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const gz = /\.(glb|js|mjs|css|json|html)$/;
const wire = new Map();   // url path -> gzip bytes served
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(hit); const headers = { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' };
  if (gz.test(hit)) { body = zlib.gzipSync(body); headers['content-encoding'] = 'gzip'; }
  wire.set(u, body.length); res.writeHead(200, headers); res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: IPHONE })).newPage();
  await page.addInitScript(() => { const st = window.setTimeout.bind(window); window.setTimeout = (f, ms, ...a) => (ms === 30000 ? 0 : st(f, ms, ...a)); });   // software GL reaches [zone ready] after the 30 s groundDeferMax backstop (a real phone does in ~9 s): this run drops that one timer so what it shows is the gate on [zone ready] itself
  const errors = [], seq = []; let ready = false;
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  const cdp = await page.context().newCDPSession(page); await cdp.send('Network.enable'); await cdp.send('Debugger.enable'); await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 32 });
  const who = new Map();   // glb path -> who asked (the initiator's top frames, function names readable in the unminified build)
  cdp.on('Network.requestWillBeSent', (e) => { const u = new URL(e.request.url).pathname; if (/\.glb$/.test(u) && !who.has(u)) { const frames = []; for (let s = e.initiator.stack; s && frames.length < 14; s = s.parent) for (const f of s.callFrames) frames.push(`${f.functionName || '(anon)'}@${f.url.split('/').pop()}:${f.lineNumber}`); who.set(u, frames.filter((f) => !/three|GLTFLoader|FileLoader|Loader/i.test(f)).slice(0, 4).join(' < ')); } });
  page.on('requestfinished', (r) => { const u = new URL(r.url()).pathname; if (/\.(glb|webp|png|jpe?g|ktx2)$/.test(u)) seq.push({ u, ready }); });
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 480000, polling: 1000 }).catch(() => console.log(label, 'NO __zoneReady within 480 s'));
  ready = true; await page.waitForTimeout(150000);   // software GL parses slowly after ready: give the deferred models time to arrive
  // The browser's own resource timing against __zoneReady.atMs (both ms since the page's time origin): a file counts as BEFORE ready when its request started before the zone said ready.
  const rt = await page.evaluate(() => ({ at: window.__zoneReady?.atMs ?? Infinity, res: performance.getEntriesByType('resource').filter((r) => /\.(glb|webp|png|jpe?g|ktx2)(\?|$)/.test(r.name)).map((r) => ({ u: new URL(r.name).pathname, start: Math.round(r.startTime), kb: Math.round(r.encodedBodySize / 1024) })) }));
  const seen = new Set(), uniq = rt.res.filter((r) => (seen.has(r.u) ? false : seen.add(r.u)));
  const before = uniq.filter((r) => r.start < rt.at), after = uniq.filter((r) => r.start >= rt.at);
  const kb = (list) => list.reduce((n, s) => n + s.kb, 0);
  const models = (list) => list.filter((s) => /\.glb$/.test(s.u)).map((s) => `${s.u.split('/').pop()} ${s.kb}KB@${Math.round((s.start - rt.at) / 1000)}s`);
  console.log(`${label} BEFORE-READY: ${before.length} files ${kb(before)} KB gzip; models ${models(before).length}: ${models(before).join(', ')}`);
  console.log(`${label} AFTER-READY (150 s): ${after.length} files ${kb(after)} KB; models ${models(after).length}: ${models(after).join(', ')}`);
  for (const s of before.filter((x) => /\/(loot|longsword|bow|bow-v1|staff-v1|cleaver|estoc|gladius|shield)[-.]/.test(x.u))) console.log(`${label} WHO ${s.u.split('/').pop()}: ${who.get(s.u) ?? '?'}`);
  console.log(`${label} ready=${await page.evaluate(() => window.__zoneReady?.atMs ?? null)} ms (software GL, not a timing); page errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  await page.screenshot({ path: path.join(out, `${label}-after-ready.png`), timeout: 240000 });
} finally { await browser.close(); server.close(); }
