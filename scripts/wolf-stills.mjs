// Stills of the Ash Wolf for the PR (visual-pr-stills: the fight camera at 375 wide): ready idle, then the first frames of each distinct opponent clip once the fight starts
// (the bite's tell and the bite itself are the first two non-idle clips). The wolf is held, so its GLB is out of the built bundle: this serves the repo with vite's dev server
// (all of src/assets), a real browser, shared box only (a VPS slot).
//   node scripts/wolf-stills.mjs [--out docs/stills/wolf] [--opponent wolf]
/* global process, console, document */
import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg('out', 'docs/stills/wolf'), OPPONENT = arg('opponent', 'wolf');
const server = await createServer({ cacheDir: `${process.env.TMPDIR ?? '/tmp'}/vite-wolf-stills`, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
try {
  await fs.mkdir(OUT, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/?opponent=${OPPONENT}&debug=1`);
  const enter = page.getByRole('button', { name: 'Enter the arena' }); if (await enter.isVisible().catch(() => false)) await enter.click();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false', null, { timeout: 180000, polling: 100 }).catch(async (e) => { await page.screenshot({ path: `${OUT}/stuck.png` }); console.log('stuck:', await page.evaluate(() => document.querySelector('#art-status')?.textContent + ' | ' + (document.querySelector('#debug')?.textContent ?? '').slice(0, 300)), errors.join(' | ')); throw e; });
  await page.locator('#debug').evaluate((el) => { el.style.display = 'none'; });
  const clip = () => page.evaluate(() => document.querySelector('#debug').dataset.clips.split(' ')[1] ?? '');
  await page.screenshot({ path: `${OUT}/ready.png` }); console.log('ready', await clip());
  await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
  await page.getByRole('button', { name: 'Fight', exact: true }).click();
  const seen = new Set(), shots = [];
  for (let polls = 0; polls < 1500 && shots.length < 3; polls++) {   // ~60 s at 40 ms
    const c = await clip();
    if (/bite|attack|heavy|stab|slash/i.test(c) && !seen.has(c)) { seen.add(c); const name = `fight-${shots.length + 1}`; await page.screenshot({ path: `${OUT}/${name}.png` }); shots.push(`${name}: ${c}`); }
    else await page.waitForTimeout(40);
  }
  console.log(shots.join('\n') || 'no wolf attack clip within 60 s');
  if (errors.length) console.log('page errors:', errors.join(' | '));
  if (!shots.length) process.exitCode = 1;
} finally { await browser.close(); await server.close(); }
