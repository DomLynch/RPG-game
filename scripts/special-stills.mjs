// Stills of a Special Move for the PR and Dom (visual-pr-stills: the fight camera at 375 wide): ?special=<name> on a built dist, phone
// viewport, the player draws and stands; the opponent casts, and three frames are taken off the page's own __special() stage hook
// (special-look.ts specialStage): mid wind-up, the strike, mid recover. Shared box only (a real browser): run it in a box slot.
//   node scripts/special-stills.mjs --dist dist [--special hades] [--out docs/stills/special-hades]
/* global process, console, document, globalThis */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const DIST = arg('dist', 'dist'), SPECIAL = arg('special', 'hades'), OUT = arg('out', `docs/stills/special-${SPECIAL}`);

async function serveDist(dir) {   // scripts/rank-look-check.mjs's static server: gzip, no-store, SPA fallback
  const http = await import('node:http'), zlib = await import('node:zlib'), path = await import('node:path');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.wasm': 'application/wasm', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    let file = path.join(dir, p), data; try { data = await fs.readFile(file); } catch { file = path.join(dir, 'index.html'); data = await fs.readFile(file); }
    const gz = zlib.gzipSync(data, { level: 6 });
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': gz.length, 'cache-control': 'no-store' }); res.end(gz);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); return { origin: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) };
}

const server = await serveDist(DIST), browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const shots = [];
try {
  await fs.mkdir(OUT, { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })).newPage();
  await page.goto(`${server.origin}/?special=${SPECIAL}&debug`);
  await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '', null, { timeout: 120000, polling: 100 });
  await page.addStyleTag({ content: '#debug{display:none!important}' });
  await page.locator('#attack-button').tap().catch(() => {});   // draw, then stand: the opponent closes and casts
  const want = [['windup', (s) => s.stage === 'windup' && s.progress >= 0.5], ['strike', (s) => s.stage === 'recover' && s.progress < 0.1], ['recover', (s) => s.stage === 'recover' && s.progress >= 0.5]];
  for (let polls = 0; polls < 3000 && want.length; polls++) {   // ~60 s at the 20 ms poll
    const { tick, stages } = await page.evaluate(() => globalThis.__special());
    const caster = stages[1] ?? stages[0];
    if (caster && want[0][1](caster)) {
      const [name] = want.shift(), file = `${OUT}/${name}.png`;
      await page.screenshot({ path: file, animations: 'disabled' });
      shots.push({ name, file, tick, stage: caster });
      console.log(`${name}: tick ${tick} ${caster.stage} ${caster.progress.toFixed(2)} -> ${file}`);
    } else await page.waitForTimeout(20);
  }
  if (want.length) throw new Error(`no ${want.map(([n]) => n).join(', ')} frame within 60 s (did the fight end first?)`);
} finally {
  await fs.writeFile(`${OUT}/stills.json`, JSON.stringify(shots, null, 2)).catch(() => {});
  await browser.close(); await server.close();
}
