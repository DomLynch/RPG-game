// Zone 1 start area and gate at 375x812 on a built origins-preview page, with the renderer's draw cost: spawn.png (where a player starts), gate.png (8 m east of the gate torches, looking west: heading -pi/2), camp.png (the camp centre looking along its wall),
// and renderInfo() (triangles, draw calls, programs) at each. Usage: node scripts/banner-stills.mjs <built origins-preview dist> <out dir>   (PIT_GL=1 = software GL)
/* global process, console, window, document */
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
// the page's own files come from the dist at /preview/origins/; the shared models and pictures (/world/kit/*.glb, /arena, /weapons ...) are the repo's public/ folder, as nginx serves them
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); let f = u.startsWith('/preview/origins/') ? path.join(path.resolve(dist), u.slice('/preview/origins/'.length)) : path.join(process.cwd(), 'public', u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; res.end(); return; } res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchBrowser(chromium, { args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const result = { views: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/preview/origins/?region=1&worldfight&zone=1&presence=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 300000 }); await page.waitForTimeout(8000);
  const info = () => page.evaluate(() => { const r = window.originsPreview.renderInfo(); return { triangles: r.triangles, calls: r.calls, programs: r.programs, pos: { ...window.originsPreview.pos } }; });
  // the two gate banners stood at (-105.3, -0.5) and (-110.0, 3.4) (camp centre (-84, 30), ring 37.2, angles -2.53 / -2.37); the hero stands 6 m east of them and looks each way
  for (const [name, at] of [['spawn', null], ['gate-h0', [-99, 1.5, 0]], ['gate-h90', [-99, 1.5, Math.PI / 2]], ['gate-h180', [-99, 1.5, Math.PI]], ['gate-h270', [-99, 1.5, -Math.PI / 2]], ['camp-h180', [-84, 30, Math.PI]], ['camp-h0', [-84, 30, 0]]]) {
    if (at) { await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), at); await page.waitForTimeout(3500); }
    await page.screenshot({ path: path.join(out, `${name}.png`) }); result.views.push({ name, ...(await info()) });
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(out, 'banner-stills.json'), JSON.stringify(result, null, 1)); console.log(JSON.stringify(result));
