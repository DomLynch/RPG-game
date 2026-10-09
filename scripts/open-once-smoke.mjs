// One universal "your character exists" rule, in a browser (src/fight/open.ts): the Pit, /zone1/ and /zone/2/ each load with a stored sign-in against a stand-in writer, and each page asks the writer's
// `open` exactly once, with no page or console error. Serves dist/ (the Pit, `npm run build`) and artifacts/origins-preview (the zone page, `npx vite build --config origins/preview/vite.config.mjs`) the way nginx
// does (deploy/frankendom.com.conf: /zone1/ and /zone/<n>/ are the preview page). Usage: node scripts/open-once-smoke.mjs   Exit 1 with the counts and errors on a miss; receipt to artifacts/open-once-smoke.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd(), pit = path.join(root, 'dist'), zone = path.join(root, 'artifacts/origins-preview');
for (const d of [pit, zone]) assert.ok(fs.existsSync(path.join(d, 'index.html')), `${d} is built`);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  if (u === '/zone1/' || /^\/zone\/[^/]+\/$/.test(u)) hit = path.join(zone, 'index.html');
  else if (u.startsWith('/preview/origins/')) hit = path.join(zone, u.slice('/preview/origins/'.length) || 'index.html');
  else hit = path.join(pit, u === '/' ? 'index.html' : u.slice(1));
  for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) if (u.startsWith(`/${d}/`) && !fs.existsSync(hit)) hit = path.join(root, 'public', u.slice(1));
  if (fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const row = { seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 };
const opened = { ok: true, result: { marks: 0, career: row, characters: [{ id: 'pc:00000000000000000000000000000001', name: 'Wanderer aaaaaa' }], items: [], quests: [], journal: [], talk: [] } };
const pages = [['pit', '/'], ['zone1', '/zone1/'], ['zone2', '/zone/2/']];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, pages: {} };
let failed = false;
try {
  for (const [name, route] of pages) {
    const errors = [], opens = [];
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { localStorage.setItem('frankendom.auth.v1', JSON.stringify({ access_token: 'smoke-token', expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: 'u' } })); });
    await ctx.route('**/origins/**', (r) => {
      const op = new URL(r.request().url()).pathname.split('/').pop();
      if (op === 'open') { opens.push(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opened) }); }
      return r.fulfill({ status: 503, contentType: 'application/json', body: '{"ok":false}' });   // anything else the page asks is not this check's business
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|404|503|WebGL|GPU stall|supabase/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`); });
    await page.goto(`${origin}${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(9000);   // the page's own load-time open, its auth renewal and first frames
    receipt.pages[name] = { route, opens: opens.length, errors };
    if (opens.length !== 1 || errors.length) failed = true;
    await ctx.close();
  }
  assert.ok(!failed, 'each page asks open exactly once and has no page or console error');
  fs.mkdirSync('artifacts', { recursive: true }); fs.writeFileSync('artifacts/open-once-smoke.json', JSON.stringify(receipt, null, 2));
  console.log('open-once smoke OK', JSON.stringify(receipt));
} catch (error) { console.error('open-once smoke FAILED', JSON.stringify(receipt), String(error).slice(0, 300)); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
