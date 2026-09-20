// Real game routes: exact served GLBs, combat, phone layout, death/rematch and screenshots.
import { ROSTER } from '../src/roster.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { builtRig, assertGlbEquivalent } from './glb-equivalence.mjs';
import { chromium } from 'playwright';
import { preview } from 'vite';
const server = process.env.QA_URL ? null : await preview({ preview: { host: '127.0.0.1', port: 0 } });
const origin = process.env.QA_URL || `http://127.0.0.1:${server.httpServer.address().port}`;
const dir = process.env.CREATURE_RECEIPT_DIR || 'artifacts/character/creatures/game';
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { origin, physicalPhone: false, views: [], errors: [] };
let inspectedPage;
const hash = b => createHash('sha256').update(b).digest('hex');
try {
  if (process.env.QA_URL) receipt.release = await (await fetch(new URL('/release.json', origin))).json();
  for (const opponent of ['minotaur', 'wraith', 'werewolf', 'skeleton'].filter(id => !ROSTER[id].hold)) {   // held recipes are not in the bundle
    const context = await browser.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = inspectedPage = await context.newPage();
    page.on('pageerror', e => receipt.errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && /shader|WebGL|THREE/.test(m.text())) receipt.errors.push(m.text()); });
    await page.route('**/*sentry.io/**', r => r.abort());
    const asset = page.waitForResponse(r => new RegExp(`/${opponent}(?:-[\\w-]+)?\\.glb(?:\\?|$)`).test(r.url()), { timeout: 90000 });
    await page.goto(`${origin}/?opponent=${opponent}&debug=1`);
    const response = await asset; assert.equal(response.status(), 200);
    const rigSha256 = hash(await response.body());
    const packed = await fs.readFile(await builtRig(opponent));
    const equivalence = await assertGlbEquivalent(await fs.readFile(`src/assets/${opponent}.glb`), packed);
    assert.equal(rigSha256, hash(packed), 'Served compressed reconstruction differs from the verified build');
    await page.getByRole('button', { name: 'Enter the arena' }).click();
    const ready = () => page.waitForFunction(() => document.querySelector('#art-status').textContent === '' && document.querySelector('#attack-button').getAttribute('aria-disabled') === 'false', null, { timeout: 90000 });
    await ready(); await page.locator('#debug').evaluate(el => { el.style.display = 'none'; });
    const expected = {
      minotaur: { family: /^\w+:Maul_\w+@WeaponDrawn$/, heavy: 'Heavy:Maul_Heavy@WeaponDrawn' },
      wraith: { family: /^\w+:Reaper_\w+@ReaperEdge$/, heavy: 'Heavy:Reaper_Heavy@ReaperEdge' },   // the reaper's contact node is its blade edge, not the grip
      werewolf: { family: /^\w+:(?:Idle|Walk|Jog|Run|Armed|Attack|Hit|Death|Draw|Roll|Guard|Return|Heavy|Riposte|ArmedWalk|StrafeLeft|StrafeRight|Kick|BlockImpact|Parry|Deflected)@WeaponDrawn$/, heavy: 'Heavy:Heavy@WeaponDrawn' },
      skeleton: { family: /^(?:\w+:Trident_\w+|Roll:Roll|Kick:Kick)@WeaponDrawn$/, heavy: 'Heavy:Trident_High@WeaponDrawn' },
    }[opponent];
    const frames = [];
    const shot = async label => {
      const state = await page.evaluate(() => ({ clips: document.querySelector('#debug').dataset.clips, art: document.querySelector('#art-status').textContent, overflow: document.documentElement.scrollWidth > innerWidth, hp: document.querySelector('#player-health').value }));
      assert.equal(state.art, ''); assert.equal(state.overflow, false); assert.match(state.clips.split(' ')[1], expected.family, 'Opponent must use its own weapon clip family');
      const path = `${dir}/${opponent}-${label}.png`; await page.screenshot({ path }); frames.push({ label, path, ...state });
    };
    await shot('landscape-ready');
    await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
    await page.getByRole('button', { name: 'Draw sword', exact: true }).click();
    await page.waitForFunction(clip => document.querySelector('#debug').dataset.clips.split(' ')[1] === clip, expected.heavy, { timeout: 45000 });
    await shot('heavy-attack');
    await page.waitForFunction(() => Number(document.querySelector('#player-health').value) < Number(document.querySelector('#player-health').max), null, { timeout: 45000 });
    await shot('landscape-fight');
    await page.setViewportSize({ width: 393, height: 852 }); await shot('portrait-fight');
    // Large translucent rigs can advance well below 60 simulation ticks per wall-clock second in headless Chromium.
    await page.getByRole('button', { name: 'Rematch', exact: true }).waitFor({ state: 'visible', timeout: 180000 });
    await shot('death'); await page.getByRole('button', { name: 'Rematch', exact: true }).click(); await ready();
    assert.equal(await page.locator('#player-health').getAttribute('value'), await page.locator('#player-health').getAttribute('max'));
    await shot('rematch');
    receipt.views.push({ opponent, asset: response.url(), rigSha256, equivalence, opponentLanded: true, rematch: true, frames });
    await context.close();
  }
  assert.deepEqual(receipt.errors, []); receipt.passed = true;
  console.log(JSON.stringify({ passed: true, views: receipt.views.length, release: receipt.release }));
} catch (error) {
  receipt.failure = { message: String(error), state: await inspectedPage?.locator('#debug').textContent().catch(() => 'unavailable') };
  await inspectedPage?.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
  console.error(receipt.failure); throw error;
} finally {
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  await browser.close(); if (server) await new Promise(resolve => server.httpServer.close(resolve));
}
