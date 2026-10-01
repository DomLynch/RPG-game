// What the gear sheet costs to draw (Fitting rail, Strategy's gate): the arena at idle (sheet closed) against the sheet open on Gear, at 375x812
// touch, counting WebGL draw calls and triangles per rendered frame (the draw functions wrapped before the page loads) and the rAF interval
// p50 / p95, at 1x and 4x CPU throttle (CDP; a phone's CPU stand-in, NOT its GPU: a Mac GPU under ANGLE/Metal is far faster than a phone's).
//   node scripts/gear-sheet-cost.mjs   (this tree's build; run `npm run build` first)  → artifacts/gear-sheet/cost.json + one line per row
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';

const dir = process.env.GEAR_RECEIPT_DIR || 'artifacts/gear-sheet'; await fs.mkdir(dir, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const KIT = { head: 'shieldmaiden.Helmet', chest: 'shieldmaiden.Body', arms: 'shieldmaiden.Arms', hands: 'shieldmaiden.Gloves', legs: 'shieldmaiden.Greaves', feet: 'shieldmaiden.Boots', off: 'shieldmaiden.Shield' };
const profile = { version: 1, id: 'gear-cost-fighter-0001', name: 'Wanderer', career: { victoryMarks: 5 }, loot: { owned: [...Object.values(KIT), 'veteran.Body'], equipped: KIT, pack: ['veteran.Body'] } };
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const load = (await import('node:os')).loadavg()[0].toFixed(1);
const rows = [];
const probe = () => {
  const s = { draws: 0, tris: 0, frames: 0 }; window.__cost = s;
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const [name, trisOf] of [['drawElements', (a) => a[1] / 3], ['drawArrays', (a) => a[2] / 3], ['drawElementsInstanced', (a) => a[1] / 3 * a[4]], ['drawArraysInstanced', (a) => a[2] / 3 * a[3]]]) {
      const real = proto[name]; if (!real) continue;
      proto[name] = function (...a) { s.draws++; s.tris += trisOf(a); return real.apply(this, a); };
    }
  }
};
const sample = (page, ms) => page.evaluate((ms) => new Promise((done) => {
  const s = window.__cost, d0 = s.draws, t0 = s.tris, stamps = []; let end = performance.now() + ms;
  const tick = (t) => { stamps.push(t); if (t < end) requestAnimationFrame(tick); else { const dt = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b), n = dt.length; done({ frames: n, p50: +dt[Math.floor(n * .5)].toFixed(1), p95: +dt[Math.floor(n * .95)].toFixed(1), drawsPerFrame: Math.round((s.draws - d0) / n), trisPerFrame: Math.round((s.tris - t0) / n) }); } };
  requestAnimationFrame(tick);
}), ms);
try {
  for (const rate of [1, 4]) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript((p) => { if (!localStorage.getItem('frankendom.fighter.v1')) localStorage.setItem('frankendom.fighter.v1', JSON.stringify(p)); }, profile);
    await context.addInitScript(probe);
    const page = await context.newPage(); page.setDefaultTimeout(120000); await page.route('**/*sentry.io/**', (r) => r.abort());
    await page.goto(`${origin}/?opponent=goblin`);
    await page.waitForFunction(() => document.querySelector('#art-status')?.textContent === '' && document.querySelector('#attack-button')?.getAttribute('aria-disabled') === 'false');
    if (await page.locator('#welcome').isVisible()) await page.getByRole('button', { name: 'Enter the arena' }).tap();
    await page.waitForFunction(() => document.querySelector('#welcome').hidden);
    const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.waitForTimeout(2500);
    rows.push({ cpuThrottle: rate, state: 'arena idle (sheet closed)', ...await sample(page, 4000) });
    await page.locator('#journal-button').tap(); await page.waitForSelector('#journal[open][data-gear="live"]'); await page.waitForTimeout(2500);
    rows.push({ cpuThrottle: rate, state: 'gear sheet open', ...await sample(page, 4000) });
    await page.context().close();
  }
} finally {
  const out = { load1min: load, engine: 'Chromium headless, Mac GPU via ANGLE/Metal (not a phone GPU), 375x812 @2x', rows };
  await fs.writeFile(`${dir}/cost.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
  await browser.close(); server.httpServer.close();
}
