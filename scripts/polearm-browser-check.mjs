// Actual game playback, no pose/simulation overrides. The rig test checks anatomy;
// this receipt checks routing, loaded bytes, gait/attack selection and browser errors.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { builtRig, assertGlbEquivalent } from './glb-equivalence.mjs';
import { harnessClock } from './lib/harness-clock.mjs';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.POLEARM_RECEIPT_DIR || 'artifacts/weapons/polearm-browser';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { origin, physicalPhone: false, views: [], errors: [] };
const hash = b => createHash('sha256').update(b).digest('hex');
try {
  if (process.env.QA_URL) receipt.release = await (await fetch(new URL('/release.json', origin))).json();
  for (const opponent of ['executioner', 'veteran']) {
    const prefix = opponent === 'executioner' ? 'Scythe' : 'Trident';
    for (const mobile of [false, true]) {
      const viewport = mobile ? { width: 852, height: 393 } : { width: 1100, height: 1050 };
      // Receipts render at native DPR on the Mac; on the software-GL runner every extra pixel is wall time (HARNESS_DPR / CI → 1).
      const deviceScaleFactor = Number(process.env.HARNESS_DPR) || (process.env.CI ? 1 : mobile ? 2 : 1.5);
      const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage(); page.on('pageerror', e => receipt.errors.push(String(e)));
      await page.route('**/*sentry.io/**', r => r.abort());
      const asset = page.waitForResponse(r => new RegExp(`/${opponent}(?:-[\\w-]+)?\\.glb(?:\\?|$)`).test(r.url()), { timeout: 90000 });
      await page.goto(`${origin}/?opponent=${opponent}&debug=1`);
      const response = await asset; assert.equal(response.status(), 200);
      const rigSha256 = hash(await response.body());
      // The build packs every rig (meshopt, shared textures): the served bytes must be that build, and the build the tested source.
      const packed = await fs.readFile(await builtRig(opponent));
      await assertGlbEquivalent(await fs.readFile(`src/assets/${opponent}.glb`), packed);
      assert.equal(rigSha256, hash(packed), 'served rig must match the verified build of the tested file');
      await page.getByRole('button', { name: 'Enter the arena' }).click();
      await page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
      await page.locator('#debug').evaluate(el => { el.style.display = 'none'; });
      // Booted for real (asset loads are machine-dependent, not timing-sensitive); from here page time moves only when this gate
      // advances it, so the walk-in, the orbit's settle and the fight frames land on the same ticks on a MacBook, the VPS or a GPU-less
      // runner (release check #9 failed on ubuntu-latest on wall-clock waits, 2026-09-21; the combat gate moved first).
      const { run, until } = await harnessClock(page);
      const frames = [];
      const shot = async label => {
        const state = await page.evaluate(() => ({ clips: document.querySelector('#debug').dataset.clips, art: document.querySelector('#art-status').textContent, overflow: document.documentElement.scrollWidth > innerWidth }));
        assert.equal(state.art, ''); assert.equal(state.overflow, false); assert.match(state.clips, new RegExp(`${prefix}_`));
        const path = `${dir}/${opponent}-${mobile ? 'phone' : 'desktop'}-${label}.png`;
        await page.screenshot({ path }); frames.push({ label, path, ...state });
      };
      await shot('start');
      await page.keyboard.down('w'); await run(900); await page.keyboard.up('w');
      await shot('approach');
      if (!mobile) {
        await page.keyboard.down('w');
        await until(() => Number(document.querySelector('#debug').textContent.match(/gap ([\d.]+)/)?.[1]) < 2.3, 15000);
        await page.keyboard.up('w');
        await page.getByRole('button', { name: 'Camera locked', exact: true }).click();
        const orbit = async dx => {
          await page.mouse.move(250, 450); await page.mouse.down();
          await page.mouse.move(250 + dx, 450, { steps: 20 }); await page.mouse.up();
          await run(400);
        };
        await orbit(628); await shot('start-rear');
        await orbit(-220); await shot('start-side');
      }
      await page.getByRole('button', { name: 'Draw sword', exact: true }).click();
      await until(p => new RegExp(`${p}_(High|Reap|Sweep|Thrust)`).test(document.querySelector('#debug').dataset.clips), 30000, prefix);
      await shot('fight');
      for (let i = 0; i < 3; i++) { await run(120); await shot(`fight-${i}`); }
      receipt.views.push({ opponent, mobile, viewport, deviceScaleFactor, asset: response.url(), rigSha256, frames });
      await context.close();
    }
  }
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
  console.log(JSON.stringify({ passed: true, views: receipt.views.length, release: receipt.release }));
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
