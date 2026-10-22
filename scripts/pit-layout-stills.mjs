// Stills and camera numbers for Dom's two Pit layouts (?pitlayout=bowl|spiral): at 375 wide and on desktop, the hero stood at set places of each layout (the yard, the rim, a ramp, each level), and the camera's height against the ground under it,
// so "does the camera clip on a slope" has a number. Writes <out>/<layout>-<name>-<375|desktop>.png and a receipt with the renderer and the camera readings.
//   BASE=http://localhost:5199 CHROME=<Chrome app> [QS=?zone=0] node scripts/pit-layout-stills.mjs <out dir> [bowl|spiral]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { launchBrowser } from './lib/harness-browser-launch.mjs';

const [out, only] = process.argv.slice(2), base = process.env.BASE ?? 'http://localhost:5199', qs = process.env.QS ?? '';
if (!out) throw new Error('usage: pit-layout-stills.mjs <out dir> [bowl|spiral]');
fs.mkdirSync(out, { recursive: true });
const dir = (a, r) => [Math.sin(a) * r, Math.cos(a) * r];   // a point at radius r, angle a from +z toward +x
const facing = (a) => a + Math.PI;                          // heading that looks at the centre from angle a
// Each shot: where he stands (x, z, heading), then whether he walks (hold W for `walkMs`) before the still. Heights come from the layout itself.
const SHOTS = {
  bowl: [
    { name: 'yard-start', at: [0, 47, Math.PI] }, { name: 'mouth', at: [0, 34, Math.PI], walkMs: 1500 },
    { name: 'terrace-lookdown', at: [...dir(0.1, 28), facing(0.1)] }, { name: 'terrace-ramp-top', at: [...dir(0.9, 25.5), facing(0.9)], walkMs: 2500 },
    { name: 'middle-ring', at: [...dir(2.4, 18), facing(2.4)] }, { name: 'champion-ramp', at: [...dir(Math.PI / 2, 14.5), facing(Math.PI / 2)], walkMs: 2500 }, { name: 'floor', at: [0, 4, 0] },
    { name: 'duel-ramp', at: [13.5, 47, Math.PI / 2], walkMs: 2500 }, { name: 'duel-floor', at: [26, 47, -Math.PI / 2] },
  ],
  spiral: [
    { name: 'yard-start', at: [0, 36, Math.PI] }, { name: 'landing-a', at: [...dir(0.35, 17), 0.35 + Math.PI / 2], walkMs: 1500 },
    { name: 'ramp-1-mid', at: [...dir(1.4, 17), 1.4 + Math.PI / 2], walkMs: 2500 }, { name: 'landing-b', at: [...dir(3.0, 17), 3.0 + Math.PI / 2] },
    { name: 'ramp-2-mid', at: [...dir(4.0, 17), 4.0 + Math.PI / 2], walkMs: 2500 }, { name: 'landing-c', at: [...dir(5.0, 17), 5.0 + Math.PI / 2] }, { name: 'floor', at: [0, 3, 0] },
    { name: 'duel-ramp', at: [13.5, 36, Math.PI / 2], walkMs: 2500 }, { name: 'duel-floor', at: [26, 36, -Math.PI / 2] },
  ],
};
const browser = await launchBrowser(chromium, { executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const receipt = { renderer: null, shots: [], errors: [] };
try {
  for (const layout of only ? [only] : ['bowl', 'spiral']) {
    for (const [shape, viewport] of [['375', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 800 }]]) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: shape === '375' ? 2 : 1, isMobile: shape === '375', hasTouch: shape === '375' }), page = await ctx.newPage();
      page.on('pageerror', (e) => receipt.errors.push(`${layout} ${shape}: ${String(e).slice(0, 200)}`));
      await page.goto(`${base}/preview/origins/${qs}${qs ? '&' : '?'}pitlayout=${layout}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.originsPreview, null, { timeout: 300000 });
      await page.waitForTimeout(12000);
      receipt.renderer ??= await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
      for (const s of SHOTS[layout]) {
        await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), s.at); await page.waitForTimeout(2500);
        if (s.walkMs) { await page.keyboard.down('w'); await page.waitForTimeout(s.walkMs); await page.keyboard.up('w'); await page.waitForTimeout(400); }
        const cam = await page.evaluate(() => window.originsPreview.camPos()), pos = await page.evaluate(() => ({ ...window.originsPreview.pos }));
        const file = `${layout}-${s.name}-${shape}.png`; await page.screenshot({ path: path.join(out, file) });
        receipt.shots.push({ layout, shape, name: s.name, file, hero: { x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), y: +cam.hero.toFixed(2) }, camera: { y: +cam.y.toFixed(2), clearanceM: +(cam.y - cam.under).toFixed(2) } });
      }
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(out, `receipt-pit-layouts${only ? `-${only}` : ''}.json`), JSON.stringify(receipt, null, 2));
  console.log('pit-layout-stills ok', receipt.shots.length, 'shots, errors:', receipt.errors.length);
} finally { await browser.close(); }
