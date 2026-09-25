// Scratch (not committed): the landed-cast replay at 375x812@2x, full frame: the hit, then the scorch ~2.2 s later.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const link = readFileSync('scorch-replay.txt', 'utf8').trim(), HIT = 455;
const server = await createServer({ root: '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/b4d35bc8-416e-48b7-ac18-e4afc3911871/scratchpad/wt-scorch', server: { port: 5198, strictPort: true }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:5198/?opponent=witch&debug&replay=' + link);
await page.addStyleTag({ content: '#debug{visibility:hidden!important}' });
const at = async (tick, name) => {
  await page.waitForFunction(t => { const d = document.getElementById('debug'); return Number(d?.dataset.tick ?? -1) >= t && /you:[\s\S]*?(skill_witchfire|ready|guard|hurt|attack)/.test(d.textContent ?? '') && Number(d.dataset.tick) < t + 60; }, tick, { timeout: 120_000, polling: 'raf' });
  await page.screenshot({ path: out + '/' + name + '.png' });
  return page.evaluate(() => Number(document.getElementById('debug').dataset.tick));
};
const shots = { hit: await at(HIT + 2, 'hit'), scorch: await at(HIT + 130, 'scorch-2s') };
console.log(JSON.stringify(shots));
await browser.close(); await server.close();
