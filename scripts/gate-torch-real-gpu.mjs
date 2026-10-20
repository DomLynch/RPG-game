// Gate sconce frames on live /zone1/?presence=0, headed Chromium on the Mac GPU: heading 270 deg (-pi/2) from 5 m (near) and 13 m (mid) east of the torch pair (-107.3, 5.5) / (-102.8, 1.9). Aborts if a release-checks.mjs appears. Env: URL, OUT.
import fs from 'node:fs'; import { execSync } from 'node:child_process'; import { chromium } from 'playwright';
const URL = process.env.URL || 'https://frankendom.com/zone1/?presence=0', OUT = process.env.OUT || 'artifacts/gate-torch-gpu'; fs.mkdirSync(OUT, { recursive: true });
const busy = () => { try { return execSync('pgrep -f release-checks.mjs || true').toString().trim() !== ''; } catch { return false; } };
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const out = { release: await fetch(new globalThis.URL('/release.json', URL)).then((r) => r.json()).then((j) => j.revision).catch(() => null), views: [] };
await page.goto(URL, { waitUntil: 'load' }); await page.waitForFunction(() => window.__zoneReady, null, { timeout: 240000 }); await page.waitForTimeout(12000);
out.zoneReady = await page.evaluate(() => window.__zoneReady);
out.renderer = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : null; });
for (const [name, x] of [['near', -102], ['mid', -94]]) {
  if (busy()) { out.aborted = 'release-checks.mjs appeared'; break; }
  await page.evaluate(([px, z, h]) => window.originsPreview.place(px, z, h), [x, 3.7, -Math.PI / 2]); await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 }); out.views.push({ name, hero: await page.evaluate(() => ({ ...window.originsPreview.pos })) });
}
fs.writeFileSync(`${OUT}/gate-torch-gpu.json`, JSON.stringify(out, null, 2)); console.log(JSON.stringify(out));
await browser.close();
