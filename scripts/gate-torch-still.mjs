// LIVE stills of the Zone 1 gate torches (#3367) at 375x812: stands the hero east of the two gate torches (gate-torch-1/-2: ring 33.8 m about the camp centre at angles -2.38 / -2.55) and looks west at them, at two distances.
// Camp centre taken as the sword's spot (-102, 30); forward is (sin h, cos h). Env: URL (default the live /zone1/), OUT (artifacts/gate-torch), GL=swiftshader on the VPS. Prints load time, hero position after each place() and the renderer.
import fs from 'node:fs'; import { chromium } from 'playwright';
const URL = process.env.URL || 'https://frankendom.com/zone1/?presence=0', OUT = process.env.OUT || 'artifacts/gate-torch', CX = +(process.env.CX ?? -102), CZ = +(process.env.CZ ?? 30); fs.mkdirSync(OUT, { recursive: true });
const torch = (a) => ({ x: CX + Math.sin(a) * 33.8, z: CZ + Math.cos(a) * 33.8 }), t1 = torch(-2.38), t2 = torch(-2.55), mid = { x: (t1.x + t2.x) / 2, z: (t1.z + t2.z) / 2 };
const browser = await chromium.launch({ headless: true, args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: +(process.env.DSF ?? 2) })).newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const out = { url: URL, torches: [t1, t2], views: [], errors };
try {
  const t0 = Date.now(); await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 }); out.zoneReadyMs = Date.now() - t0;
  await page.waitForTimeout(12000);   // Lead: __zoneReady plus ~12 s
  out.spawn = await page.evaluate(() => ({ ...window.originsPreview.pos })); await page.screenshot({ path: `${OUT}/0-spawn.png`, timeout: 180000 });   // SwiftShader draws the live scene slowly: DSF=1 and a long timeout on the VPS
  out.renderer = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; });
  const H = -Math.PI / 2;   // looking west, at the torches
  for (const [name, back] of [['wide', 14], ['near', 7]]) {
    await page.evaluate(([x, z, h]) => window.originsPreview.place(x, z, h), [mid.x + back, mid.z, H]);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180000 });
    out.views.push({ name, hero: await page.evaluate(() => ({ ...window.originsPreview.pos })) });
  }
} catch (e) { out.fail = String(e).slice(0, 300); }
fs.writeFileSync(`${OUT}/gate-torch.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
await browser.close(); if (out.fail) process.exit(1);
