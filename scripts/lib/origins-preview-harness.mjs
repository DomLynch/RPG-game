// What the ground-loot pickup checks share (scripts/ground-pickup-stills.mjs, scripts/ground-prompt-check.mjs): serve a built origins preview the way nginx does, and stand in for the writer on a signed-in page
// (open, ground_state, ground_take answered by a stub; the page, the view and the prompt are the real ones, only the network is faked).
/* global window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { groundPointOf } from '../../origins/world/ground-point.ts';

export const ITEM = 'item:starter.rusty-sword', AUTH_KEY = 'frankendom.auth.v1';
export const centre = groundPointOf({ zone: 'zone1', place: 'cinder-fields' });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };

/** Serve `dist` at /preview/origins/ and the repo's public folders beside it. */
export async function serveOriginsPreview(dist, root = process.cwd()) {
  const roots = { '/preview/origins/': `${path.resolve(dist)}/` };
  for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
    for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
    if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
    if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** A signed-in page whose writer is a stub. `offsets` are [dx, dz] metres from the walker (one ground row each, ids ground:still-N); `take` is 'taken' (the take succeeds) or 'race' (409 taken). */
export async function stubSignedIn(page, { offsets, take }) {
  await page.addInitScript(([key, exp]) => { localStorage.setItem(key, JSON.stringify({ access_token: 'stub.token.value', expires_at: exp })); }, [AUTH_KEY, Math.floor(Date.now() / 1000) + 3600]);
  await page.route('**/origins/open', (route) => json(route, 200, { ok: true, result: { characters: [{ id: 'pc:still', name: 'Still' }] } }));
  await page.route('**/origins/ground_state', async (route) => {
    let pos; for (let i = 0; i < 600 && !pos; i++) { pos = await page.evaluate(() => window.originsPreview?.pos && { x: window.originsPreview.pos.x, z: window.originsPreview.pos.z }).catch(() => undefined); if (!pos) await new Promise((r) => setTimeout(r, 250)); }
    const items = offsets.map(([dx, dz], i) => ({ instance: `ground:still-${i}`, item: ITEM, zone: 'zone1', place: 'cinder-fields', offsetX: pos.x + dx - centre.x, offsetZ: pos.z + dz - centre.z, radiusM: 1.5, available: true, visible: true }));
    json(route, 200, { ok: true, result: { now: new Date().toISOString(), items } });
  });
  await page.route('**/origins/ground_take', (route) => (take === 'race' ? json(route, 409, { ok: false, error: 'already taken', code: 'taken' }) : json(route, 200, { ok: true, result: { result: 'taken', instance: 'ground:still-0', item: ITEM, qty: 1, availableAt: new Date(Date.now() + 3.6e6).toISOString() } })));
}
