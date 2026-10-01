// What a Pitborn boss special costs a phone (Strategy's gate: on/off, CPU x4, p95 delta). The same fight on ?special=<kind> at 375x812 touch, the real-time rAF
// interval and WebGL draw calls / triangles per frame over the cast (from the wind-up to a second after the strike), with the effect ON and with its module
// stubbed OFF (the route returns a no-op createPitbornSpecial, so the rest of the page and the fight are identical), at 1x and 4x CPU (CDP; a phone's CPU
// stand-in, NOT its GPU: a Mac GPU under ANGLE/Metal is far faster than a phone's). Each row runs REPS times; the line prints the median p50 / p95 and the share of frames over 20 ms (a single dropped frame spikes a rep's p95 on either side, so p95 alone is noisy).
//   node scripts/special-cost.mjs [--special typhon] [--reps 3]   (this tree's build; run `npm run build` first)  → artifacts/special-cost/<kind>.json + one line per row
/* global process, console, document, window, performance, requestAnimationFrame, WebGL2RenderingContext, WebGLRenderingContext */
import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'node:fs/promises';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const KIND = arg('special', 'typhon'), REPS = Number(arg('reps', 3)), DIR = 'artifacts/special-cost';
await fs.mkdir(DIR, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const args = process.env.PIT_GL ? [] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath(), args });
const load = (await import('node:os')).loadavg()[0].toFixed(1);
const STUB = 'export function createPitbornSpecial(){return{render(){},clear(){}}}export const PITBORN_KINDS=[],isPitbornSpecial=()=>false;';
const probe = () => {
  const s = { draws: 0, tris: 0 }; window.__cost = s;
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    for (const [name, trisOf] of [['drawElements', (a) => a[1] / 3], ['drawArrays', (a) => a[2] / 3], ['drawElementsInstanced', (a) => a[1] / 3 * a[4]], ['drawArraysInstanced', (a) => a[2] / 3 * a[3]]]) {
      const real = proto[name]; if (!real) continue;
      proto[name] = function (...a) { s.draws++; s.tris += trisOf(a); return real.apply(this, a); };
    }
  }
};
// The cast window: rAF intervals from the caster's wind-up until one second after its recover starts (capped at 20 s).
const sample = (page) => page.evaluate(() => new Promise((done) => {
  const s = window.__cost, stamps = []; let d0 = 0, t0 = 0, began = false, endAt = Infinity; const cap = performance.now() + 20000;
  const tick = (t) => {
    const stage = globalThis.__special().stages[1]?.stage;
    if (!began && stage === 'windup') { began = true; d0 = s.draws; t0 = s.tris; stamps.length = 0; }
    if (began) stamps.push(t);
    if (began && stage === 'recover' && endAt === Infinity) endAt = t + 1000;
    if (t > endAt || t > cap) {
      const dt = stamps.slice(1).map((v, i) => v - stamps[i]).sort((a, b) => a - b), n = dt.length, at = (q) => dt[Math.min(n - 1, Math.floor(n * q))];
      done({ began, frames: n, slow: dt.filter((v) => v > 20).length, p50: +at(0.5).toFixed(2), p95: +at(0.95).toFixed(2), draws: Math.round((s.draws - d0) / n), tris: Math.round((s.tris - t0) / n) });
    } else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const rows = [];
try {
  for (const rate of [1, 4]) for (const mode of ['on', 'off']) {
    const reps = [];
    for (let r = 0; r < REPS; r++) {
      const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await context.addInitScript(probe);
      const page = await context.newPage(); page.setDefaultTimeout(120000); await page.route('**/*sentry.io/**', (x) => x.abort());
      if (mode === 'off') await page.route('**/special-fx-pitborn*.js', (x) => x.fulfill({ contentType: 'text/javascript', body: STUB }));
      await page.goto(`${origin}/?special=${KIND}&debug`);
      await page.waitForFunction(() => typeof globalThis.__special === 'function' && document.querySelector('#art-status')?.textContent === '');
      if (await page.locator('#welcome').isVisible().catch(() => false)) await page.getByRole('button', { name: 'Enter the arena' }).tap();
      const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await page.locator('#attack-button').tap().catch(() => {});
      reps.push(await sample(page));
      await context.close();
    }
    const row = { kind: KIND, mode, cpu: rate, reps, p50: median(reps.map((x) => x.p50)), p95: median(reps.map((x) => x.p95)), slow: +(100 * reps.reduce((a, x) => a + x.slow, 0) / reps.reduce((a, x) => a + x.frames, 0)).toFixed(2), draws: median(reps.map((x) => x.draws)), tris: median(reps.map((x) => x.tris)) };
    rows.push(row);
    console.log(`${KIND} ${mode.padEnd(3)} CPU x${rate}: p50 ${row.p50} ms, p95 ${row.p95} ms, ${row.slow} % of frames over 20 ms, ${row.draws} draws, ${row.tris} tris per frame (${reps.map((x) => `${x.p95}`).join('/')} p95 per rep, ${reps[0].frames} frames)`);
  }
  for (const rate of [1, 4]) {
    const on = rows.find((x) => x.cpu === rate && x.mode === 'on'), off = rows.find((x) => x.cpu === rate && x.mode === 'off');
    console.log(`${KIND} CPU x${rate}: p95 delta ${(on.p95 - off.p95).toFixed(2)} ms, p50 delta ${(on.p50 - off.p50).toFixed(2)} ms, slow-frame share ${on.slow} % vs ${off.slow} %, +${on.draws - off.draws} draws, +${on.tris - off.tris} tris`);
  }
  await fs.writeFile(`${DIR}/${KIND}.json`, JSON.stringify({ load, rows }, null, 1));
  console.log(`load average at start ${load}; wrote ${DIR}/${KIND}.json`);
} finally { await browser.close(); server.httpServer.close(); }
