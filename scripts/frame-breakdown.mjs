// Per-object breakdown of ONE Zone 1 fight frame (read-only; Lead 2026-10-22: which meshes own the triangles and draws at ?crowd=0). Counts, for the frame the renderer draws, every mesh that is visible and inside the camera's frustum:
// triangles (index or position count, x instances, honouring the draw range), draws (one per drawn mesh/group), and whether it also casts into the shadow pass. Grouped by owner (the nearest named ancestor chain), top N by triangles,
// reconciled against the GL context's own draw/triangle counters for the same frame. No game code: the scene and the camera are read through three's __THREE_DEVTOOLS__ hook and a wrapped renderer.render.
//   node scripts/frame-breakdown.mjs <built origins-preview dist> <out dir> [--query "&crowd=0"] [--topn 10]
/* global process, console, window, document, performance */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const argv = process.argv.slice(2), dist = argv[0], out = argv[1], opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : d; };
if (!dist || !out) throw new Error('usage: frame-breakdown.mjs <dist> <out dir> [--query "&crowd=0"] [--topn 10]');
const QUERY = opt('query', '&crowd=0'), TOPN = Number(opt('topn', 10));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const root = process.cwd(), roots = [['/preview/origins/', `${path.resolve(dist)}/`]];
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots.push([`/${d}/`, `${root}/public/${d}/`]);
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of roots) { if (!u.startsWith(p)) continue; const f = path.join(r, u.slice(p.length) || 'index.html'); if (fs.existsSync(f)) { hit = fs.statSync(f).isDirectory() ? path.join(f, 'index.html') : f; if (fs.existsSync(hit)) break; hit = null; } }
  if (!hit) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage(); page.setDefaultTimeout(240000);
page.on('pageerror', (e) => console.error('pageerror', String(e).slice(0, 200)));
await page.addInitScript(() => {
  // three announces every renderer and scene to __THREE_DEVTOOLS__ when it exists at construction time.
  const seen = { renderer: null, scenes: [] }; window.__seen = seen;
  const bus = new EventTarget(); window.__THREE_DEVTOOLS__ = bus;
  bus.addEventListener('observe', (e) => { const o = e.detail; if (o?.isWebGLRenderer && !seen.renderer) seen.renderer = o; else if (o?.isScene) seen.scenes.push(o); });
  // GL-side truth for the frame: draws and triangles between two markers.
  const P = window.WebGL2RenderingContext?.prototype, gl = { calls: 0, tris: 0 }; window.__gl = gl;
  const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0), W = (name, f) => { const o = P?.[name]; if (o) P[name] = function (...a) { f(a); return o.apply(this, a); }; };
  W('drawElements', (a) => { gl.calls++; gl.tris += tri(a[0], a[1]); }); W('drawArrays', (a) => { gl.calls++; gl.tris += tri(a[0], a[2]); });
  W('drawElementsInstanced', (a) => { gl.calls++; gl.tris += tri(a[0], a[1]) * a[4]; }); W('drawArraysInstanced', (a) => { gl.calls++; gl.tris += tri(a[0], a[2]) * a[3]; });
});
await page.goto(`${base}/preview/origins/?region=1&worldfight&presence=0${QUERY}`, { waitUntil: 'commit' });
await page.waitForFunction(() => !!window.originsPreview, null, { polling: 200 });
await page.waitForFunction(() => window.originsPreview?.settledAt?.() >= 0 || !!window.__zoneReady, null, { polling: 200 }).catch(() => {});
await page.waitForTimeout(2000);
// Into a fight: stand by the nearest drawn creature and tap it (the probe's route).
const engaged = await page.evaluate(async () => {
  const ms = window.originsPreview.mobs().mobs.filter((m) => m.drawn), p = window.originsPreview.pos;
  const m = ms.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; if (!m) return { ok: false, drawn: 0 };
  window.originsPreview.place(m.x, m.z - 2.5, 0); for (let i = 0; i < 40 && !document.body.classList.contains('infight'); i++) await new Promise((r) => setTimeout(r, 250));
  if (!document.body.classList.contains('infight')) window.originsPreview.tapMob(m.id);
  return { ok: true, drawn: ms.length, id: m.id, infight: document.body.classList.contains('infight') };
});
await page.waitForTimeout(4000);
const frame = await page.evaluate(() => new Promise((resolve) => {
  const { renderer, scenes } = window.__seen; if (!renderer) return resolve({ error: 'no renderer seen through __THREE_DEVTOOLS__ (three build without the hook?)' });
  const renders = []; const real = renderer.render.bind(renderer);
  let armed = false;
  renderer.render = function (scene, camera) {
    if (armed) { const gl0 = { ...window.__gl }; const ret = real(scene, camera); renders.push({ scene, camera, calls: window.__gl.calls - gl0.calls, tris: Math.round(window.__gl.tris - gl0.tris) }); return ret; }
    return real(scene, camera);
  };
  requestAnimationFrame(() => { armed = true; requestAnimationFrame(() => requestAnimationFrame(() => {
    armed = false; renderer.render = real;
    // The frame's renders: the main scene pass (and any composer passes). Pick the one with the most GL triangles as the world pass.
    const main = [...renders].sort((a, b) => b.tris - a.tris)[0]; if (!main) return resolve({ error: 'no render call captured', renders: renders.length });
    const { scene, camera } = main; scene.updateMatrixWorld(); camera.updateMatrixWorld();
    const mat = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse), planes = [];
    const e = mat.elements; const row = (i) => [e[i], e[4 + i], e[8 + i], e[12 + i]];
    const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3), add = (a, b, s) => a.map((v, i) => v + s * b[i]);
    for (const p of [add(r3, r0, 1), add(r3, r0, -1), add(r3, r1, 1), add(r3, r1, -1), add(r3, r2, 1), add(r3, r2, -1)]) { const l = Math.hypot(p[0], p[1], p[2]) || 1; planes.push(p.map((v) => v / l)); }
    const inFrustum = (o) => {
      const g = o.geometry; if (!g) return true; if (o.frustumCulled === false) return true;
      if (!g.boundingSphere) g.computeBoundingSphere(); const s = g.boundingSphere; if (!s) return true;
      const c = s.center.clone().applyMatrix4(o.matrixWorld), sc = o.matrixWorld.getMaxScaleOnAxis() * s.radius;
      return planes.every((p) => p[0] * c.x + p[1] * c.y + p[2] * c.z + p[3] >= -sc);
    };
    const trisOf = (o) => {
      const g = o.geometry; if (!g) return 0; const idx = g.index, total = idx ? idx.count : g.attributes.position?.count ?? 0, dr = g.drawRange, count = Math.min(total - dr.start, dr.count === Infinity ? total : dr.count);
      const inst = o.isInstancedMesh ? o.count : 1; return Math.max(0, count / 3) * inst;
    };
    const chain = (o) => { const names = []; for (let p = o.parent; p && p !== scene; p = p.parent) if (p.name) names.unshift(p.name); return names; };
    const groups = new Map(), rows = []; let totalTris = 0, totalDraws = 0, shadowTris = 0, shadowDraws = 0, skinned = 0, instanced = 0;
    scene.traverseVisible((o) => {
      if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite) || !o.geometry && !o.isSprite) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material]; if (mats.every((m) => m && m.visible === false)) return;
      const inView = inFrustum(o), t = o.isSprite ? 2 : trisOf(o), draws = Array.isArray(o.material) ? Math.max(1, (o.geometry.groups?.length) || 1) : 1;
      if (o.castShadow && o.geometry) { shadowTris += t; shadowDraws += draws; }   // the directional light's shadow pass draws it again (view-independent here: the caster set, not the shadow frustum)
      if (!inView) return;
      totalTris += t; totalDraws += draws; if (o.isSkinnedMesh) skinned++; if (o.isInstancedMesh) instanced++;
      const top = chain(o), key = (top.slice(0, 2).join(' > ') || o.type) + (o.isSkinnedMesh ? ' [skinned]' : o.isInstancedMesh ? ` [instanced x${o.count}]` : '');
      const g = groups.get(key) ?? { owner: key, meshes: 0, draws: 0, tris: 0, castShadow: 0, samples: [] }; g.meshes++; g.draws += draws; g.tris += t; if (o.castShadow) g.castShadow++; if (g.samples.length < 3) g.samples.push(`${o.name || o.type}:${Math.round(t)}`); groups.set(key, g);
      rows.push({ name: o.name || o.type, owner: key, tris: Math.round(t), draws, shadow: !!o.castShadow, skinned: !!o.isSkinnedMesh, instanced: o.isInstancedMesh ? o.count : 0 });
    });
    resolve({ renders: renders.map((r) => ({ calls: r.calls, tris: r.tris })), mainPass: { calls: main.calls, tris: main.tris }, countedMainPass: { tris: Math.round(totalTris), draws: totalDraws, skinned, instanced }, shadowCasters: { tris: Math.round(shadowTris), draws: shadowDraws },
      groups: [...groups.values()].sort((a, b) => b.tris - a.tris).map((g) => ({ ...g, tris: Math.round(g.tris) })), topMeshes: rows.sort((a, b) => b.tris - a.tris).slice(0, 25), sceneChildren: scene.children.map((c) => `${c.type}:${c.name || '-'}:${c.children?.length ?? 0}`).slice(0, 60) });
  })); });
}));
const result = { engaged, query: QUERY, ...frame }; fs.writeFileSync(path.join(out, 'frame-breakdown.json'), JSON.stringify(result, null, 1));
if (frame.error) { console.log('FRAME-BREAKDOWN error', frame.error); } else {
  console.log(`FRAME-BREAKDOWN engaged=${JSON.stringify(engaged)} renders=${JSON.stringify(frame.renders)} GLmain=${JSON.stringify(frame.mainPass)} counted=${JSON.stringify(frame.countedMainPass)} shadowCasters=${JSON.stringify(frame.shadowCasters)}`);
  console.log('TOP BY TRIANGLES (owner | meshes | draws | tris | % of counted | shadow casters | samples)');
  for (const g of frame.groups.slice(0, TOPN)) console.log(`  ${g.owner} | ${g.meshes} | ${g.draws} | ${g.tris} | ${(100 * g.tris / Math.max(1, frame.countedMainPass.tris)).toFixed(1)}% | ${g.castShadow} | ${g.samples.join(', ')}`);
}
await browser.close(); await new Promise((r) => server.close(r));
