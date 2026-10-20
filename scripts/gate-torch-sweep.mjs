// Gate torch sweep on live /zone1/?presence=0 (Mac real GPU, HEADED=1): the hero stands 8 m east of the torch pair (-107.3, 5.5) / (-102.8, 1.9) and shoots one frame per heading (0, 90, 180, 270 deg), so the framing that shows the lit sconces is found by looking, not guessed. Env: URL, OUT.
import fs from 'node:fs'; import { chromium } from 'playwright';
const URL = process.env.URL || 'https://frankendom.com/zone1/?presence=0', OUT = process.env.OUT || 'artifacts/gate-torch-sweep'; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: process.env.HEADED !== '1', args: process.env.GL === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const out = { views: [] };
await page.goto(URL, { waitUntil: 'load' }); await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 }); await page.waitForTimeout(12000);
out.zoneReady = await page.evaluate(() => window.__zoneReady);
for (const [name, h] of [['h0', 0], ['h90', Math.PI / 2], ['h180', Math.PI], ['h270', -Math.PI / 2]]) {
  await page.evaluate(([x, z, hh]) => window.originsPreview.place(x, z, hh), [-97, 3.7, h]); await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 }); out.views.push({ name, hero: await page.evaluate(() => ({ ...window.originsPreview.pos })) });
}
fs.writeFileSync(`${OUT}/sweep.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
await browser.close();
