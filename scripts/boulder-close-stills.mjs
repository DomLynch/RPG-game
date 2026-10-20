// Zone 1 boulders, close: the hero stands DIST m south of a spot (default: the boulder pair at -48, 44) facing it, the walk camera, no fight; a still of the page at VIEW (default 375x812).
// Usage: node scripts/boulder-close-stills.mjs <built origins-preview dist> <out dir>   env: X=-48 Z=44 DIST=8 VIEW=375x812 WAIT=5000 PIT_GL=1 (software GL)
/* global process, console, window */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), X = +(process.env.X || -48), Z = +(process.env.Z || 44), DIST = +(process.env.DIST || 8), WAIT = +(process.env.WAIT || 5000); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, '')); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
try {
  const [vw, vh] = (process.env.VIEW || '375x812').split('x').map(Number);
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.model), null, { timeout: 300000 }); await page.waitForTimeout(4000);
  const only = process.env.H === undefined ? null : process.env.H.split(',').map(Number);   // H=0 keeps only heading 0 (facing +z, the boulder 5 m ahead)
  for (const [i, h] of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].entries()) {   // four headings: which way the pair lies from here is not known until a still shows it
    if (only && !only.includes(i)) continue;
    await page.evaluate(([x, z, hh]) => window.originsPreview.place(x, z, hh), [X, Z - DIST, h]); await page.waitForTimeout(i ? 1500 : WAIT);
    await page.screenshot({ path: path.join(out, `boulders-h${i}.png`) });
    console.log(JSON.stringify({ X, Z, DIST, size: [vw, vh], heading: h, pos: await page.evaluate(() => { const p = window.originsPreview.pos; return [p.x, p.z]; }) }));
  }
} finally { await browser.close(); server.close(); }
