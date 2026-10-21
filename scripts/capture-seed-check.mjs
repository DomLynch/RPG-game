// ?capture=seed replay-twice row (World lane): the same build, loaded twice from cold, must put every creature in the same place after advance(N), and a flag-off load must carry no capture hook.
// Usage: node scripts/capture-seed-check.mjs <built origins-preview dist> [out.json]   env: TICKS=300 SPOT=-97.05,3.7 PIT_GL=1 (software GL: --disable-gpu, the VPS/HF CPU path)
// Per run: wait originsPreview.capture.ready(), place the hero at SPOT, wait ready() again, advance(TICKS), read originsPreview.mobs() (id, x, z, mode of every creature) and hash a screenshot.
// Exit 0 = both runs' creature lists are identical (the screenshot hash equality is reported, not gated: software GL may differ in the last bit); 1 = they differ; 3 = never ready.
/* global process, console, window */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist, out] = process.argv.slice(2), TICKS = +(process.env.TICKS || 300), [sx, sz] = (process.env.SPOT || '-97.05,3.7').split(',').map(Number);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(path.resolve(dist), u.replace(/^\/preview\/origins\//, ''));
  if (!fs.existsSync(f) && fs.existsSync(path.join(path.resolve('public'), u))) f = path.join(path.resolve('public'), u);   // the built page does not carry public/ (the kit, the bodies): read it from the repo
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('content-type', mime[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: process.env.PIT_GL === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : [] });
const base = `http://127.0.0.1:${server.address().port}/preview/origins/?region=1&zone=1&presence=0`;
const readyWait = (page) => page.waitForFunction(() => window.originsPreview?.capture?.ready?.(), null, { timeout: 600000, polling: 500 });

async function run(flag) {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  try {
    await page.goto(flag ? `${base}&capture=seed` : base, { waitUntil: 'load' });
    if (!flag) { await page.waitForFunction(() => window.originsPreview, null, { timeout: 600000 }); return { capture: await page.evaluate(() => window.originsPreview.capture ?? null) }; }
    await readyWait(page);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [sx, sz]);
    await page.waitForTimeout(500); await readyWait(page);
    const ticks = await page.evaluate((n) => window.originsPreview.capture.advance(n), TICKS);
    await page.waitForTimeout(1500);   // two drawn frames at dt 0 (the held walk) so the screenshot is the state at `ticks`
    const mobs = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => [m.id, m.x, m.z, m.mode, m.drawn, m.model]));
    const shot = crypto.createHash('sha256').update(await page.screenshot()).digest('hex').slice(0, 16);
    return { ticks, mobs, shot };
  } finally { await page.context().close(); }
}

let code = 0; const result = { ticks: TICKS, spot: [sx, sz] };
try {
  const off = await run(false); result.flagOff = off;
  if (off.capture !== null) { console.log('FAIL: flag-off load carries a capture hook'); code = 1; }
  const a = await run(true), b = await run(true); result.a = a; result.b = b;
  const same = JSON.stringify(a.mobs) === JSON.stringify(b.mobs) && a.ticks === b.ticks && a.ticks === TICKS;
  result.positionsIdentical = same; result.stillIdentical = a.shot === b.shot;
  if (!same) { const diff = a.mobs.filter((m, i) => JSON.stringify(m) !== JSON.stringify(b.mobs[i])).slice(0, 8); result.diff = diff; code = 1; }
  console.log(JSON.stringify({ positionsIdentical: same, stillIdentical: result.stillIdentical, creatures: a.mobs.length, ticks: a.ticks, flagOffCapture: off.capture }));
} catch (error) { console.log(`FAIL: ${String(error).slice(0, 300)}`); code = 3; }
finally { if (out) fs.writeFileSync(out, JSON.stringify(result, null, 1)); await browser.close(); server.close(); }
process.exit(code);
