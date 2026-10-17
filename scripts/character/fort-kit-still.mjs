// The goblin fort kit at 375 wide (scripts/character/fort-kit-still.html on a vite dev server). Usage: node scripts/character/fort-kit-still.mjs <out dir>   (software GL: the program count is the point, not the speed)
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const out = path.resolve(process.argv[2] ?? 'artifacts/fort-kit');
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/scripts/character/fort-kit-still.html`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 560 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.ready === true, null, { timeout: 240000 });
  await page.screenshot({ path: path.join(out, 'fort-kit-front.png') });
  await page.evaluate(() => window.view('quarter'));
  await page.screenshot({ path: path.join(out, 'fort-kit-quarter.png') });
  const result = await page.evaluate(() => window.result);
  fs.writeFileSync(path.join(out, 'nodes.json'), JSON.stringify(result, null, 2));
  console.log('programs: zone1 kit alone', result.programsZone1, '-> with the fort kit', result.programsAfterFort);
  for (const i of result.info) console.log(i.name.padEnd(18), i.size.join(' x '), `${i.tris} tris`);
  console.log('errors:', errors.length, errors.slice(0, 3));
} finally { await browser.close(); await server.close(); }
