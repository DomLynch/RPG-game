// Gear fit check (Characters, 2026-10-09; for Web's gear screen in Zone 1): the Zone 1 hero wearing each loot piece through the engine's wear(pieces) path (gear-fit.html).
//   node scripts/gear-fit-stills.mjs --out <dir> [--stills goblin] [--width 375 --height 812]
// Writes <out>/fit.json (every loot id: did wear throw, skinned, sits on the body, height ratio) and a still per id whose name starts with --stills (default: none). Never part of the build.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const args = process.argv.slice(2), option = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = option('out', 'artifacts/gear-fit'), width = +option('width', 375), height = +option('height', 812), stills = option('stills', '');
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${server.resolvedUrls.local[0]}gear-fit.html`); await page.waitForFunction(() => window.__fit?.ready, null, { timeout: 120000 });
  const ids = await page.evaluate(() => window.__fit.ids), report = [];
  for (const id of ids) {
    const r = await page.evaluate((i) => { const x = window.__fit.wear(i); window.__fit.shoot(); return x; }, id); report.push(r);
    if (stills && (stills === 'all' || id.startsWith(stills))) await page.screenshot({ path: `${out}/${id}.png` });
  }
  await page.evaluate(() => window.__fit.clear());
  await fs.writeFile(`${out}/fit.json`, JSON.stringify({ bodyHeight: await page.evaluate(() => window.__fit.bodyHeight), errors, report }, null, 1));
  const bad = report.filter((r) => r.failed.length || !r.allSkinned || !r.finite || !r.onBody || r.heightRatio > 1.05);
  console.log(`${report.length} loot ids; ${bad.length} flagged`); for (const r of bad) console.log(' ', r.id, JSON.stringify({ failed: r.failed, skinned: r.allSkinned, finite: r.finite, onBody: r.onBody, heightRatio: r.heightRatio }));
  if (errors.length) { console.log('ERRORS', errors.slice(0, 5)); process.exitCode = 1; }
} finally { await browser.close(); await server.close(); }
