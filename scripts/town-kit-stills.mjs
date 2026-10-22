// Characters: the town 3D kit in the real Exchange page, before (?skins=0, the greybox) and after, at 375 wide: stills at three stops of the walk out (the same keys held the same time), and per stop
// the renderer's own triangles and draw calls plus the frame-time p95 over a few seconds. Reads the origins preview served by vite (or a built dist) at <base>.
//   node scripts/town-kit-stills.mjs <base url, e.g. http://localhost:5190/preview/origins/> <out dir> [--stops 5,8,11] [--sample 4]
// Mac note: a real GPU (Apple Metal) draws the high tier; the number is a pair read (same page, same stops), not a phone figure. Run the A/B on the T4 with the gpu-run wrapper for the receipt.
/* global process, console, window, performance, requestAnimationFrame, KeyboardEvent */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const argv = process.argv.slice(2), base = argv[0], out = path.resolve(argv[1] ?? '.'), opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i > 0 ? argv[i + 1] : d; };
if (!base) throw new Error('usage: town-kit-stills.mjs <base url> <out dir> [--stops 5,8,11] [--sample 4]');
const STOPS = opt('stops', '5,8,11').split(',').map(Number), SAMPLE = Number(opt('sample', 4)) * 1000;
fs.mkdirSync(out, { recursive: true });
const browser = await launchBrowser(chromium, { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = [];
try {
  for (const arm of ['greybox', 'kit']) {
    const q = `?region=0${arm === 'greybox' ? '&skins=0' : ''}`;
    for (const stop of STOPS) {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
      page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 160)));
      await page.addInitScript(() => {   // GL-side truth: renderer.info resets per render() call and the last call is the post-chain quad, so count the context's own draws and triangles
        const P = window.WebGL2RenderingContext?.prototype, gl = { calls: 0, tris: 0 }; window.__gl = gl;
        const tri = (mode, n) => (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0), W = (name, f) => { const o = P?.[name]; if (o) P[name] = function (...a) { f(a); return o.apply(this, a); }; };
        W('drawElements', (a) => { gl.calls++; gl.tris += tri(a[0], a[1]); }); W('drawArrays', (a) => { gl.calls++; gl.tris += tri(a[0], a[2]); });
        W('drawElementsInstanced', (a) => { gl.calls++; gl.tris += tri(a[0], a[1]) * a[4]; }); W('drawArraysInstanced', (a) => { gl.calls++; gl.tris += tri(a[0], a[2]) * a[3]; });
      });
      await page.goto(base + q);
      await page.waitForFunction(() => window.originsPreview, null, { timeout: 120000 });
      await page.waitForFunction(() => window.__zoneReady, null, { timeout: 40000 }).catch(() => console.log('no [zone ready] in 40 s, shooting anyway'));   // the dev server's cold modules can hold the gate: the kit is drawn by then
      await page.waitForTimeout(4000);
      await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' })); });
      await page.waitForTimeout(stop * 1000);
      await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' })); });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(async (ms) => {
        const dts = []; let last = performance.now(); const end = last + ms;
        await new Promise((res) => { const f = (t) => { dts.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
        dts.shift(); dts.sort((a, b) => a - b);
        const info = window.originsPreview.renderInfo();
        const g0 = { ...window.__gl }; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const glFrames = []; glFrames.push((window.__gl.tris - g0.tris) / 2, (window.__gl.calls - g0.calls) / 2);   // two frames, averaged
        return { glTrisPerFrame: Math.round(glFrames[0]), glDrawsPerFrame: Math.round(glFrames[1]), triangles: info.triangles, calls: info.calls, programs: info.programs, frames: dts.length, p50: +dts[Math.floor(dts.length * 0.5)].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), renderer: (() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; })() };
      }, SAMPLE);
      await page.screenshot({ path: path.join(out, `${arm}-stop${stop}.png`) });
      report.push({ arm, stop, ...m }); console.log(JSON.stringify({ arm, stop, ...m }));
      await page.close();
    }
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'town-kit-ab.json'), JSON.stringify(report, null, 1));
