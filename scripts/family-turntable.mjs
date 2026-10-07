// Review stills for a static family body (docs/specs/origins/body-families.md): four azimuths at 375 wide and the numbers the QA caps read.
//   node scripts/family-turntable.mjs --glb src/assets/source/creatures/giant-hrungnir.glb --name giant --out <dir> [--h 1.8]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const glb = opt('glb'), name = opt('name', 'body'), out = opt('out', 'artifacts/family-turntable'), h = opt('h', '1.8'), W = +opt('width', 375), Hh = +opt('height', 560);
await fs.mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen();
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const az of [0, 90, 180, 270]) {
    const page = await (await browser.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: 2 })).newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${server.resolvedUrls.local[0]}family-turntable.html?glb=/${glb}&az=${az}&h=${h}`);
    await page.waitForFunction(() => window.__turn?.ready, null, { timeout: 120000 });
    const info = await page.evaluate(() => window.__turn); if (az === 0) console.log(name, JSON.stringify(info));
    await page.screenshot({ path: `${out}/${name}-${String(az).padStart(3, '0')}.png` }); await page.context().close();
  }
} finally { await browser.close(); await server.close(); }
if (errors.length) { console.log('ERRORS\n' + errors.join('\n')); process.exitCode = 1; }
