// Review stills of the Region 1 mobs (mob-looks.ts + mob-dress.ts): node scripts/mob-lineup.mjs --out <dir> [--width 375 --height 812] [--spread]
// Writes before.png (roster bodies as they are) and after.png (dressed), plus one still per mob. Never part of the build.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const args = process.argv.slice(2), option = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const out = option('out', 'artifacts/mob-lineup'), width = +option('width', 375), height = +option('height', 812);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const base = `${server.resolvedUrls.local[0]}mob-lineup.html`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
async function shot(name, query, w = width, h = height) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', e => errors.push(String(e))); page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}${query}`); await page.waitForFunction(() => window.__lineup?.ready, null, { timeout: 90000 });
  const info = await page.evaluate(() => window.__lineup); if (info.errors.length) errors.push(...info.errors);
  await page.screenshot({ path: `${out}/${name}.png` }); console.log(`${out}/${name}.png`); await page.context().close();
}
try {
  const ids = ['character:mere-mother', 'character:hrungnir', 'character:peg-powler', 'character:court-thrall', 'character:cinder-scavenger', 'character:mere-brood', 'character:ruin-ghoul'];
  await shot('before-wide', '?raw=1', 1200, 500); await shot('after-wide', '', 1200, 500);
  for (const id of ids) await shot(`after-${id.split(':')[1]}`, `?ids=${id}`);
  if (args.includes('--spread')) for (const kind of ['cinder-scavenger', 'mere-brood', 'ruin-ghoul']) {   // the free visual spread (mob-looks.ts MOB_SPREAD): all eight variants wide, the first four at the phone width
    await shot(`spread-${kind}-wide`, `?ids=character:${kind}&variants=1`, 1200, 420); await shot(`spread-${kind}-375`, `?ids=character:${kind}&variants=1&n=4`, 375, 420);
  }
} finally { await browser.close(); await server.close(); }
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
