// Triangle and draw-call census of the Zone 1 page by owner (probe hook originsPreview.census): at zone ready, then after the hero walks to each creature camp, 375x812 phone. Usage: node scripts/zone-census.mjs <checkout> <out json>. REAL_GPU=1.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [root, out] = process.argv.slice(2);
if (!root || !out) throw new Error('usage: zone-census.mjs <checkout> <out json>');
const built = path.join(root, 'artifacts/origins-preview'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wasm': 'application/wasm' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts', 'preview']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null, best = -1;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p) && p.length > best) { best = p.length; hit = path.join(r, u.slice(p.length) || 'index.html'); }
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.REAL_GPU === '1' ? [] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
await page.route('**/*sentry.io/**', (route) => route.abort());
await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000, polling: 100 });
await new Promise((r) => setTimeout(r, 2000));
const snaps = [];
const snap = async (label) => { await new Promise((r) => setTimeout(r, 1500)); snaps.push({ label, ...(await page.evaluate(() => window.originsPreview.census())) }); };
await snap('spawn');
const camps = await page.evaluate(() => window.originsPreview.region?.()?.camps?.map((c) => ({ at: c.at })) ?? []);
for (let i = 0; i < Math.min(3, camps.length); i++) { const [x, z] = camps[i].at; await page.evaluate(([px, pz]) => window.originsPreview.place(px, pz - 4, 0), [x, z]); await snap(`camp-${i}`); }
fs.writeFileSync(out, JSON.stringify({ snaps }, null, 2));
for (const s of snaps) {
  console.log(`CENSUS ${s.label}: renderer tris ${s.renderer.triangles} calls ${s.renderer.calls} geoms ${s.renderer.geometries} textures ${s.renderer.textures} programs ${s.renderer.programs}`);
  const tot = s.rows.reduce((a, r) => ({ trisIn: a.trisIn + r.trisIn, drawsIn: a.drawsIn + r.drawsIn, trisAll: a.trisAll + r.trisAll, drawsAll: a.drawsAll + r.drawsAll }), { trisIn: 0, drawsIn: 0, trisAll: 0, drawsAll: 0 });
  console.log(`  scene total: tris in-frustum ${tot.trisIn} (all ${tot.trisAll}), draws in-frustum ${tot.drawsIn} (all ${tot.drawsAll})`);
  for (const r of s.rows.slice(0, 30)) console.log(`  ${String(r.trisIn).padStart(8)} tris in / ${String(r.trisAll).padStart(8)} all | ${String(r.drawsIn).padStart(4)} draws in / ${String(r.drawsAll).padStart(4)} all | meshes ${r.meshes} skinned ${r.skinned} inst ${r.instanced} mats ${r.materials} | ${r.owner}`);
}
await browser.close(); server.close();
