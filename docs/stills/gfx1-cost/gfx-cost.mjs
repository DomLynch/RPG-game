// gfx=1 cost read on live /zone1/: stills + median FPS over a 20 s walk + first-playable, N runs per mode, optional 4x CPU throttle.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/domininclynch/Developer/frankendom-web/package.json');
const { chromium } = require('playwright');
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const RUNS = +(process.env.RUNS || 3), WALK_MS = 20000;
const MODES = [['off', 'https://frankendom.com/zone1/'], ['gfx1', 'https://frankendom.com/zone1/?gfx=1']];
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
for (const throttle of [1, 4]) {
  for (let run = 1; run <= RUNS; run++) {
    for (const [mode, url] of MODES) {
      const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
      const t0 = Date.now();
      await page.goto(url + (url.includes('?') ? '&' : '?') + `r=${throttle}-${run}`, { waitUntil: 'commit' });
      let ready = -1;
      while (Date.now() - t0 < 120000) { if (await page.evaluate(() => !!window.__zoneReady).catch(() => false)) { ready = Date.now() - t0; break; } await new Promise((r) => setTimeout(r, 100)); }
      const renderer = await page.evaluate(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; }).catch(() => 'err');
      await new Promise((r) => setTimeout(r, 12000));   // the page's own settle time (Lead: __zoneReady plus ~12 s)
      if (run === 1 && throttle === 1) await page.screenshot({ path: `${OUT}/still-${mode}-375.png` });
      // walk in a circle for WALK_MS while a rAF sampler records frame times
      const fps = await page.evaluate(async (walkMs) => {
        const times = []; let go = true;
        const tick = (t) => { times.push(t); if (go) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
        const j = document.getElementById('joystick'); const r = j.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ev = (type, x, y) => j.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 9, pointerType: 'touch', isPrimary: true }));
        ev('pointerdown', cx, cy); const t0 = performance.now(); let a = 0;
        while (performance.now() - t0 < walkMs) { a += 0.08; ev('pointermove', cx + 42 * Math.cos(a), cy + 42 * Math.sin(a)); await new Promise((res) => setTimeout(res, 100)); }
        ev('pointerup', cx, cy); go = false; return times;
      }, WALK_MS);
      const dts = fps.slice(1).map((t, i) => t - fps[i]);
      const perSec = []; for (let s = 0; s < 20; s++) perSec.push(fps.filter((t) => t >= fps[0] + s * 1000 && t < fps[0] + (s + 1) * 1000).length);
      results.push({ mode, throttle, run, renderer: renderer.slice(0, 60), firstPlayableMs: ready, medianFps: +(1000 / med(dts)).toFixed(1), medianPerSecondFps: med(perSec), p5Fps: +(1000 / [...dts].sort((a, b) => a - b)[Math.floor(dts.length * 0.95)]).toFixed(1), frames: fps.length });
      console.log(JSON.stringify(results.at(-1)));
      await ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
console.log('DONE');
