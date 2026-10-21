// How many draw calls per frame does Zone 1 make, and how many are the static dressing? Counts every WebGL draw the page issues, per frame, by render target (the screen, the shadow map, other
// offscreen passes), in two views: the opening view and the fight camera, and labels the draws that are the merged dressing meshes (frontier-*, camp-*) by their exact index count.
//   node scripts/draw-histogram.mjs <built origins-preview dist> <out json>     env: VIEW=375x812  FRAMES=40  PIT_GL=1 (software GL: the COUNT does not depend on the GPU; times do)  CHROME=<path>
// Measures only: no row, no prop, no render setting is changed. Run on the VPS (PIT_GL=1) or the Mac; the numbers are draw counts, not times.
/* global process, console, window, document */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import * as THREE from 'three';
import { chromium } from 'playwright';
import { frontierBuild, frontierPlan } from '../origins/preview/frontier-plan.ts';
import { frontierDress } from '../origins/preview/frontier-dress.ts';
import { meshPieces } from '../origins/preview/exchange.ts';

const [dist, outFile] = process.argv.slice(2);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, ''));
  if (!fs.existsSync(f) && fs.existsSync(path.join('public', u))) f = path.join('public', u);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

// What the static dressing draws as, by index count (the same meshing the page does: exchange.ts meshPieces, one merged mesh per layer; frontier.ts passes build, ground, dress and camp pieces).
const F = frontierPlan(), B = frontierBuild(F), D = frontierDress(F, B);
const mats = { stone: new THREE.MeshBasicMaterial(), iron: new THREE.MeshBasicMaterial(), coal: new THREE.MeshBasicMaterial() };
const expected = new Map();   // index count -> label
for (const [prefix, pieces] of [['frontier', B.pieces], ['frontier-ground', D.ground], ['frontier-dress', D.pieces]]) {
  const g = new THREE.Group(); meshPieces(g, pieces, mats, prefix, {});
  for (const m of g.children) if (m.geometry?.index) expected.set(m.geometry.index.count, m.name);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const result = { view: process.env.VIEW || '375x812', expected: Object.fromEntries([...expected].map(([k, v]) => [v, k])), scenarios: {} };
try {
  const [w, h] = (process.env.VIEW || '375x812').split('x').map(Number), FRAMES = +(process.env.FRAMES || 40);
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, userAgent: IPHONE_UA })).newPage();
  await page.addInitScript(() => {
    const rec = { on: false, frame: 0, frames: [], fbo: null, vp: [0, 0], prog: 0, progs: new WeakMap(), nextProg: 1, switches: [], binds: [] };
    window.__draws = rec;
    window.__scenes = []; window.__THREE_DEVTOOLS__ = new EventTarget(); window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => { if (e.detail?.isScene) window.__scenes.push(e.detail); });   // three announces its Scene here
    const note = (kind, count, inst) => { if (!rec.on) return; (rec.frames[rec.frame] ??= []).push([kind, count, inst, rec.fbo ? 1 : 0, rec.vp[0], rec.vp[1], rec.prog]); };
    for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
      const orig = (n) => proto[n];
      const wrap = (name, fn) => { const o = orig(name); if (!o) return; proto[name] = function (...a) { fn(a); return o.apply(this, a); }; };
      wrap('bindFramebuffer', (a) => { if (a[0] === 36009 || a[0] === 36160) rec.fbo = a[1]; });
      wrap('useProgram', (a) => { if (a[0] && !rec.progs.has(a[0])) rec.progs.set(a[0], rec.nextProg++); rec.prog = a[0] ? rec.progs.get(a[0]) : 0; if (rec.on) (rec.switches[rec.frame] ??= []).push(rec.prog); });
      wrap('bindTexture', () => { if (rec.on) rec.binds[rec.frame] = (rec.binds[rec.frame] ?? 0) + 1; });
      wrap('viewport', (a) => { rec.vp = [a[2], a[3]]; });
      wrap('drawElements', (a) => note('e', a[1], 1)); wrap('drawArrays', (a) => note('a', a[2], 1));
      wrap('drawElementsInstanced', (a) => note('ei', a[1], a[4])); wrap('drawArraysInstanced', (a) => note('ai', a[2], a[4])); wrap('drawRangeElements', (a) => note('e', a[4], 1));
    }
    const tick = () => { rec.frame++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0&worldfight&debug=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 420000 });
  await page.waitForTimeout(4000);
  const sample = async (name, extra = {}) => {
    await page.evaluate(() => { window.__draws.frames = []; window.__draws.frame = 0; window.__draws.on = true; });
    await page.waitForFunction((n) => window.__draws.frame >= n, FRAMES + 5, { timeout: 300000 });
    const got = await page.evaluate(() => { window.__draws.on = false; return { f: window.__draws.frames.slice(2, -2), sw: window.__draws.switches.slice(2, -2), bd: window.__draws.binds.slice(2, -2) }; });
    // the scene graph census: every visible mesh (all ancestors visible), by class; meshes ~ scene draws (x material groups), unique materials, unique material types, how many cast shadows
    const census = await page.evaluate(() => {
      const scene = window.__scenes[0], classes = {}, add = (cls, o, mats) => { const c = (classes[cls] ??= { meshes: 0, instanced: 0, castShadow: 0, tris: 0, materials: new Set(), types: new Set(), textures: new Set(), names: {} });
        c.meshes++; if (o.isInstancedMesh) c.instanced++; if (o.castShadow) c.castShadow++; c.tris += ((o.geometry?.index?.count ?? o.geometry?.attributes?.position?.count ?? 0) / 3) * (o.isInstancedMesh ? o.count : 1);
        for (const m of mats) { c.materials.add(m.uuid); c.types.add(m.type + (m.skinning ? '' : '')); for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (m[k]) c.textures.add(m[k].uuid); }
        const nm = (o.name || o.parent?.name || '?').replace(/[-_]?\d+$/, '').slice(0, 28); c.names[nm] = (c.names[nm] ?? 0) + 1; };
      const walk = (o, hidden) => { if (!o.visible) return; if (o.isMesh || o.isSkinnedMesh) {
          const mats = [].concat(o.material), cls = o.isSkinnedMesh ? 'skinned (creatures+hero)' : o.isInstancedMesh ? 'instanced (kit/fx)' : /^frontier|^camp/.test(o.name) ? 'dressing merged' : 'other mesh'; add(cls, o, mats); }
        for (const ch of o.children) walk(ch); };
      if (scene) walk(scene);
      return Object.fromEntries(Object.entries(classes).map(([k, c]) => [k, { meshes: c.meshes, instanced: c.instanced, castShadow: c.castShadow, tris: Math.round(c.tris), uniqueMaterials: c.materials.size, materialTypes: [...c.types], uniqueTextures: c.textures.size, topNames: Object.entries(c.names).sort((a, b) => b[1] - a[1]).slice(0, 8) }]));
    });
    const full = got.f.filter(Boolean), n = full.length || 1, groups = {}, shapes = {}, uniq = {};
    for (const f of full) for (const [kind, count, inst, fbo, vw, vh, prog] of f) {
      (uniq[fbo ? 'offscreen' : 'screen'] ??= new Set()).add(prog);
      const g = fbo ? `offscreen ${vw}x${vh}` : `screen ${vw}x${vh}`; groups[g] = (groups[g] ?? 0) + 1;
      const k = `${g} | ${kind} count=${count} inst=${inst}`; shapes[k] = (shapes[k] ?? 0) + 1;
    }
    const top = Object.entries(shapes).map(([k, v]) => [k, +(v / n).toFixed(2)]).sort((a, b) => b[1] - a[1]);
    const label = (k) => { const m = /count=(\d+) inst=(\d+)/.exec(k); return m && expected.has(+m[1]) && m[2] === '1' ? expected.get(+m[1]) : (m && +m[2] > 1 ? 'instanced (kit/crowd/fx)' : ''); };
    result.scenarios[name] = { frames: n, ...extra, census,uniqueProgramsByTarget: Object.fromEntries(Object.entries(uniq).map(([k, v]) => [k, v.size])), programSwitchesPerFrame: +(got.sw.reduce((s, f) => s + (f?.length ?? 0), 0) / n).toFixed(1), textureBindsPerFrame: +(got.bd.reduce((s, v) => s + (v || 0), 0) / n).toFixed(1), drawsPerFrameByTarget: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, +(v / n).toFixed(1)])), top: top.slice(0, 40).map(([k, v]) => ({ shape: k, perFrame: v, label: label(k) })),
      staticDressingMergedPerFrame: +top.filter(([k]) => label(k).startsWith('frontier')).reduce((s, [, v]) => s + v, 0).toFixed(1), instancedPerFrame: +top.filter(([k]) => /inst=(?!1\b)/.test(k)).reduce((s, [, v]) => s + v, 0).toFixed(1) };
  };
  await sample('opening-view', { at: await page.evaluate(() => ({ x: window.originsPreview.pos.x, z: window.originsPreview.pos.z })) });
  // the fight camera: the hero beside the nearest scavenger, a light tap to engage, then the page's fight camera
  const target = await page.evaluate(() => { const p = window.originsPreview.pos, all = window.originsPreview.mobs().mobs.filter((m) => /scavenger/.test(m.id)).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)); return all[0] ? { id: all[0].id, x: all[0].x, z: all[0].z } : null; });
  if (target) {
    for (let t = 0; t < 10 && !(await page.evaluate(() => document.body.classList.contains('infight'))); t++) {
      await page.evaluate(([id]) => { const m = window.originsPreview.mobs().mobs.find((q) => q.id === id); if (m) window.originsPreview.place(m.x, m.z - 1.4, 0); window.originsPreview.press?.('light'); }, [target.id]);
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(2500);
    await sample('fight-camera', { target: target.id, infight: await page.evaluate(() => document.body.classList.contains('infight')) });
  }
  fs.writeFileSync(outFile, JSON.stringify(result, null, 1));
  for (const [name, s] of Object.entries(result.scenarios)) console.log(name, JSON.stringify({ frames: s.frames, byTarget: s.drawsPerFrameByTarget, census: JSON.stringify(s.census), programs: s.uniqueProgramsByTarget, switches: s.programSwitchesPerFrame, binds: s.textureBindsPerFrame, staticDressingMergedPerFrame: s.staticDressingMergedPerFrame, instancedPerFrame: s.instancedPerFrame, infight: s.infight }));
} finally { await browser.close(); server.close(); }
