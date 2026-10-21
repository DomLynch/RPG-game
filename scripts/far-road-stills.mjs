// Z-fight check for the road and rut tops (#3525): stand at STAND (an open spot), pick a road vertex 27-40 m away from the live scene, and (a) shoot it, (b) shoot 7 frames with the hero shifted 4 cm sideways each
// (z-fighting flips pixels between such frames; a stable surface barely changes), (c) walk 2 s taking frames. Reports, in the far ground band, the mean abs luminance difference between consecutive frames and the share of
// pixels moving by more than 40. Compare a build with the old road and rut tops against the new one.
//   node scripts/far-road-stills.mjs <built origins-preview dist> <out dir>   env: VIEW=375x812  STAND=-97.05,3.7  DSF=2  PIT_GL=1 (software GL: depth precision is NOT the phone's)  CHROME=<path>
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, OUT] = process.argv.slice(2), [W, H] = (process.env.VIEW || '375x812').split('x').map(Number), stand = process.env.STAND ? { x: +process.env.STAND.split(',')[0], z: +process.env.STAND.split(',')[1] } : null;
fs.mkdirSync(OUT, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, ''));
  if (!fs.existsSync(f) && fs.existsSync(path.join('public', u))) f = path.join('public', u);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF || 2), userAgent: IPHONE_UA }), page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => { window.__scenes = []; window.__THREE_DEVTOOLS__ = new EventTarget(); window.__THREE_DEVTOOLS__.addEventListener('observe', (e) => { if (e.detail?.isScene) window.__scenes.push(e.detail); }); });   // three announces its Scene here
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 420000 }); await page.waitForTimeout(12000);
  const renderer = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; });
  const pick = await page.evaluate((st) => {   // a road vertex (road tint, top face) 27-40 m from the stand spot, nearest 32 m
    let mesh; const w = (o) => { if (o.isMesh && o.name === 'frontier-ground-stone') mesh = o; o.children.forEach(w); }; window.__scenes.forEach(w);
    const g = mesh.geometry, col = g.getAttribute('color'), pos = g.getAttribute('position'), p0 = st ?? window.originsPreview.pos, e = mesh.matrixWorld.elements, cands = [];
    for (let v = 0; v < pos.count; v += 3) { if (col.getX(v).toFixed(2) !== '1.20' || col.getY(v).toFixed(2) !== '1.12') continue; const y = pos.getY(v); if (y < 0.045 || y > 0.08) continue; const lx = pos.getX(v), lz = pos.getZ(v); const x = e[0] * lx + e[4] * y + e[8] * lz + e[12], z = e[2] * lx + e[6] * y + e[10] * lz + e[14]; const d = Math.hypot(x - p0.x, z - p0.z); if (d > 27 && d < 40) cands.push({ x, z, d }); }
    cands.sort((a, b) => Math.abs(a.d - 32) - Math.abs(b.d - 32)); return { p0: { x: p0.x, z: p0.z }, p: cands[0] ?? null, n: cands.length };
  }, stand);
  if (!pick.p) { fs.writeFileSync(`${OUT}/far.json`, JSON.stringify({ fail: 'no road vertex 27-40 m away', pick })); console.log('no road vertex 27-40 m away'); process.exit(1); }
  const ux = (pick.p.x - pick.p0.x) / pick.p.d, uz = (pick.p.z - pick.p0.z) / pick.p.d, hx = pick.p0.x, hz = pick.p0.z, hd = Math.atan2(ux, uz), px = -uz, pz = ux;
  const put = (dx) => page.evaluate(([a, b, c]) => window.originsPreview.place(a, b, c), [hx + px * dx, hz + pz * dx, hd]);
  const band = { x: 0, y: Math.round(H * 0.22), width: W, height: Math.round(H * 0.22) };   // the far ground band, above the hero
  await put(0); await page.waitForTimeout(4500); await page.screenshot({ path: `${OUT}/far.png` });
  const shots = [];
  for (let i = 0; i < 7; i++) { await put(i * 0.04); await page.waitForTimeout(900); shots.push((await page.screenshot({ clip: band })).toString('base64')); }
  const walk = []; await put(0); await page.waitForTimeout(1500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: H - 112, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: H - 162, id: 1 }] });
  const t0 = Date.now(); while (Date.now() - t0 < 2000) walk.push((await page.screenshot({ clip: band })).toString('base64'));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const stats = await page.evaluate(async ([a, b]) => {
    const px = async (b64) => { const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob(), bm = await createImageBitmap(blob), c = new OffscreenCanvas(bm.width, bm.height), x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, bm.width, bm.height).data, l = new Float32Array(bm.width * bm.height); for (let i = 0; i < l.length; i++) l[i] = 0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]; return l; };
    const run = async (list) => { const fr = []; for (const s of list) fr.push(await px(s)); let sum = 0, big = 0, n = 0; for (let i = 1; i < fr.length; i++) { if (fr[i].length !== fr[0].length) continue; for (let k = 0; k < fr[i].length; k++) { const d = Math.abs(fr[i][k] - fr[i - 1][k]); sum += d; if (d > 40) big++; n++; } } return { frames: fr.length, meanAbsDiff: +(sum / n).toFixed(3), pctOver40: +(100 * big / n).toFixed(3) }; };
    return { jitter4cm: await run(a), walking2s: await run(b) };
  }, [shots, walk]);
  const out = { view: `${W}x${H}`, renderer, stand: { hx, hz }, roadPoint: pick.p, candidates: pick.n, ...stats };
  fs.writeFileSync(`${OUT}/far.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out));
} finally { await browser.close(); server.close(); }
