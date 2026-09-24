// Scratch: in-pit stills at the real fight camera, 375x812 DPR 3, the Centurion's kit forced to a rung with ?tier=, the player drawn and in guard.
// node pit-still.mjs <repoRoot> <outDir>
import { createServer } from 'vite';
import { chromium } from 'playwright';
const [root, outDir] = process.argv.slice(2);
const server = await createServer({ root, logLevel: 'error', server: { port: 5198, strictPort: true } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const tier of ['Recruit', 'Gladiator']) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', tier, String(e).slice(0, 200)));
  await page.goto(`http://localhost:5198/?tier=${tier}`);
  await page.waitForTimeout(3000);
  if (await page.locator('#welcome').isVisible().catch(() => false)) { await page.fill('#fighter-name', 'Tier'); await page.keyboard.press('Enter'); }
  await page.waitForTimeout(9000);
  const guard = page.locator('#guard-button'), draw = page.locator('#attack-button');
  await draw.dispatchEvent('pointerdown'); await draw.dispatchEvent('pointerup'); await page.waitForTimeout(1500);   // draw the sword
  await page.locator('canvas').first().focus().catch(() => {}); await page.keyboard.down('q');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${outDir}/pit-${tier}.png` });
  const pose = await page.evaluate(() => document.getElementById('guard-button')?.getAttribute('aria-pressed')); console.log(tier, 'guard pressed:', pose); await page.keyboard.up('q');
  await ctx.close();
}
await browser.close(); await server.close();
console.log('done');
