// Stills of the spell-slot buttons (spell slots 3b, visual-pr-stills): the fight cluster at 375 and 320 wide, BEFORE = the live site (slot b does not exist), AFTER = this branch's build with
// slot b filled (the SPELL 2 button un-hidden the way the pick does), plus a receipt of every visible action box: none overlaps another, all inside the viewport, each at least 44 px.
//   node scripts/spell-slots-still.mjs --dist dist [--before-url https://frankendom.com] [--out artifacts/spell-slots] [--dpr 2]
/* global process, console, document */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), BEFORE = arg('before-url', ''), OUT = arg('out', 'artifacts/spell-slots'), DPR = Number(arg('dpr', 2));
const VIEWPORTS = [{ w: 375, h: 812 }, { w: 320, h: 568 }];
const QUERY = '?opponent=veteran&spar=1&weapon=longsword&difficulty=dummy&debug';

async function serveDist(dir) {
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const receipt = [];
try {
  await fs.rm(OUT, { recursive: true, force: true }); await fs.mkdir(OUT, { recursive: true });
  const runs = [{ label: 'after', origin: server.origin, slotB: true }, ...(BEFORE ? [{ label: 'before', origin: BEFORE, slotB: false }] : [])];
  for (const run of runs) for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true, deviceScaleFactor: DPR }), page = await context.newPage();
    page.on('pageerror', (e) => console.log('pageerror:', e.message));
    await page.goto(`${run.origin}/${QUERY}`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '', null, { timeout: 180000, polling: 200 });
    await page.addStyleTag({ content: '#debug{display:none!important}' });
    await page.locator('#attack-button').tap().catch(() => {});   // draw: the cluster is up
    await page.waitForTimeout(1500);
    if (run.slotB) await page.evaluate(() => { const b = document.getElementById('skill2-button'); if (b) { b.removeAttribute('hidden'); b.removeAttribute('aria-disabled'); Object.defineProperty(b, 'hidden', { get: () => false, set: () => {} }); } });   // slot b filled: what the pick does; the Pit HUD re-hides it every update (its fighter has no slot b), so pin it visible
    await page.waitForTimeout(300);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.actions button')].filter((b) => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return !b.hidden && s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0; }).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id, l: Math.round(r.left * 10) / 10, t: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; }));
    const overlaps = [], circle = (b) => ({ cx: b.l + b.w / 2, cy: b.t + b.h / 2, r: b.w / 2 });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = circle(boxes[i]), b = circle(boxes[j]); if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r - 0.5) overlaps.push([boxes[i].id, boxes[j].id]); }
    const off = boxes.filter((b) => b.l < 0 || b.t < 0 || b.l + b.w > vp.w || b.t + b.h > vp.h).map((b) => b.id), small = boxes.filter((b) => b.w < 44 || b.h < 44).map((b) => b.id);
    receipt.push({ run: run.label, viewport: `${vp.w}x${vp.h}`, buttons: boxes.map((b) => b.id), hasSkill2: boxes.some((b) => b.id === 'skill2-button'), overlaps, off, small, boxes });
    await page.screenshot({ path: `${OUT}/${run.label}-${vp.w}.png`, animations: 'disabled' });
    await context.close();
  }
  await fs.writeFile(`${OUT}/receipt.json`, JSON.stringify(receipt, null, 2));
  for (const r of receipt) console.log(`${r.run} ${r.viewport}: ${r.buttons.length} buttons${r.hasSkill2 ? ' (SPELL 2 shown)' : ''}, overlaps ${JSON.stringify(r.overlaps)}, off-screen ${JSON.stringify(r.off)}, under 44px ${JSON.stringify(r.small)}`);
  if (receipt.some((r) => r.run === 'after' && (r.overlaps.length || r.off.length || !r.hasSkill2))) { console.log('FAIL: after has an overlap, an off-screen button or no SPELL 2'); process.exitCode = 1; }
} finally { await browser.close(); await server.close(); }
