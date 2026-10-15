// Stills of the ground-loot pickup prompt at a phone (visual-pr-stills; ground loot slice 3): the built origins preview, the walk camera, a signed-in session with the writer's ground_state / ground_take answered by a stub
// (the page, the view and the prompt are the real ones; only the network is faked, so a take and a lost race can be filmed). Chromium on software GL (VPS `capture`).
//   frames per width:  near      one drop inside the pickup radius, the prompt up, then the tap (take answered 'taken': item gone, the line)
//                      several   six drops lying about the walker (the beam-per-item watch item), the prompt for the nearest
//                      race      the same prompt, the tap answered 409 'taken' (the refuse line)
//   BEFORE=1 films a build WITHOUT the feature (trunk) through the same stub: the same spot, nothing drawn, no prompt.
//   ZONE_DIST=<built origins preview> OUT=<dir> LABEL=<before|after> WIDTHS=375,320 node scripts/ground-pickup-stills.mjs
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { groundPointOf } from '../origins/world/ground-point.ts';

const ZONE = process.env.ZONE_DIST, out = process.env.OUT || 'artifacts/ground-pickup-stills', LABEL = process.env.LABEL || 'after', BEFORE = process.env.BEFORE === '1', root = process.cwd();
const WIDTHS = (process.env.WIDTHS || '375,320').split(',').map(Number), ITEM = 'item:starter.rusty-sword', AUTH_KEY = 'frankendom.auth.v1';
const centre = groundPointOf({ zone: 'zone1', place: 'cinder-fields' });
// Offsets from the walker, metres: near = one inside the 1.5 m radius; several = six about the walker, the nearest inside the radius (x across, z ahead).
const OFFSETS = { near: [[0.3, 1.0]], several: [[0.3, 1.0], [-2.2, 2.6], [2.4, 3.4], [-0.8, 4.4], [3.4, 5.6], [-3.6, 6.4]], race: [[0.3, 1.0]] };
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const roots = { '/preview/origins/': `${path.resolve(ZONE)}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { errors: [], frames: {} };
const shoot = (page, name) => page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 80, timeout: 240000 });
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function frame(width, scenario) {
  const page = await (await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(`pageerror ${scenario}@${width}: ${String(e).slice(0, 200)}`));
  await page.addInitScript(([key, exp]) => { localStorage.setItem(key, JSON.stringify({ access_token: 'stub.token.value', expires_at: exp })); }, [AUTH_KEY, Math.floor(Date.now() / 1000) + 3600]);
  let rowsSeen = 0;
  await page.route('**/origins/ground_state', async (route) => {
    let pos; for (let i = 0; i < 600 && !pos; i++) { pos = await page.evaluate(() => window.originsPreview?.pos && { x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }).catch(() => undefined); if (!pos) await new Promise((r) => setTimeout(r, 250)); }
    const items = OFFSETS[scenario].map(([dx, dz], i) => ({ instance: `ground:still-${i}`, item: ITEM, zone: 'zone1', place: 'cinder-fields', offsetX: pos.x + dx - centre.x, offsetZ: pos.z + dz - centre.z, radiusM: 1.5, available: true, visible: true }));
    rowsSeen = items.length; json(route, 200, { ok: true, result: { now: new Date().toISOString(), items } });
  });
  await page.route('**/origins/ground_take', (route) => (scenario === 'race' ? json(route, 409, { ok: false, error: 'already taken', code: 'taken' }) : json(route, 200, { ok: true, result: { result: 'taken', instance: 'ground:still-0', item: ITEM, qty: 1, availableAt: new Date(Date.now() + 3.6e6).toISOString() } })));
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
  if (!BEFORE) await page.waitForFunction(() => window.originsPreview.ground.anchor('ground:still-0') !== undefined, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const prompt = await page.evaluate(() => { const p = document.getElementById('prompt'); return { hidden: p.hidden, text: p.textContent }; });
  receipt.frames[`${scenario}-${width}`] = { rowsSeen, prompt };
  await shoot(page, `${LABEL}-${scenario}-${width}.jpg`);
  if (!BEFORE && scenario !== 'several') {
    // A thumb taps the middle of the prompt: record what is on top there (the fight buttons share the bottom band), then tap that point.
    const hit = await page.evaluate(() => { const r = document.getElementById('prompt').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, top: e?.id || e?.className || e?.tagName, box: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
    receipt.frames[`${scenario}-${width}`].hit = hit;
    await page.touchscreen.tap(hit.x, hit.y); await page.waitForTimeout(1200);
    receipt.frames[`${scenario}-${width}`].after = await page.evaluate(() => ({ toast: document.getElementById('world-toast')?.textContent ?? null, drawn: window.originsPreview.ground.anchor('ground:still-0') !== undefined }));
    await shoot(page, `${LABEL}-${scenario}-${width}-tap.jpg`);
  }
  await page.context().close();
}
try {
  for (const width of WIDTHS) for (const scenario of (process.env.SCENARIOS ? process.env.SCENARIOS.split(',') : BEFORE ? ['near', 'several'] : ['near', 'several', 'race'])) await frame(width, scenario);
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); server.close(); }
