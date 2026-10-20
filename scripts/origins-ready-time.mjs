// Zone-ready timing A/B (throwaway probe for #3412): two built checkouts, N interleaved loads each of /preview/origins/?region=1&zone=1 at 375 wide, real GPU when REAL_GPU=1.
// Per load: first playable (the cover lifting, originsPreview.cover().atMs), [zone ready] (window.__zoneReady.atMs) and how many "[zone ready] deferred" re-plans the page logged.
// Usage: node scripts/origins-ready-time.mjs <base checkout> <head checkout> [runs]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [baseRoot, headRoot, runsArg] = process.argv.slice(2), RUNS = Number(runsArg || 3);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
async function serve(root) {
  const built = path.join(root, 'artifacts/origins-preview'), roots = { '/preview/origins/': `${built}/` };
  for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
    for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
    if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
    if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}
const sides = { base: await serve(baseRoot), head: await serve(headRoot) };
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const rows = [];
for (let i = 0; i < RUNS; i++) for (const side of ['base', 'head']) {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  let deferred = 0; page.on('console', (m) => { if (m.text().includes('[zone ready] deferred')) deferred++; });
  await page.goto(`${sides[side].origin}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 180000 }).catch(() => {});
  const r = await page.evaluate(() => ({ playableMs: window.originsPreview?.cover?.().atMs ?? null, readyMs: window.__zoneReady?.atMs ?? null, programs: window.__zoneReady?.programs ?? null }));
  rows.push({ run: i + 1, side, ...r, deferred }); console.log(JSON.stringify(rows.at(-1)));
  await page.context().close();
}
const median = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
for (const side of ['base', 'head']) { const s = rows.filter((r) => r.side === side); console.log(`MEDIAN ${side}: playable ${median(s.map((r) => r.playableMs))} ms, ready ${median(s.map((r) => r.readyMs))} ms, deferred re-plans ${s.map((r) => r.deferred).join(',')}`); }
await browser.close(); for (const s of Object.values(sides)) s.server.close();
