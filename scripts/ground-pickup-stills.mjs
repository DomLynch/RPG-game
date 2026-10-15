// Stills of the ground-loot pickup prompt at a phone (visual-pr-stills; ground loot slice 3): the built origins preview, the walk camera, a signed-in session with the writer's ground_state / ground_take answered by a stub
// (the page, the view and the prompt are the real ones; only the network is faked, so a take and a lost race can be filmed). Chromium on software GL (VPS `capture`).
//   frames per width:  near      one drop inside the pickup radius, the prompt up, then the tap (take answered 'taken': item gone, the line)
//                      several   six drops lying about the walker (the beam-per-item watch item), the prompt for the nearest
//                      race      the same prompt, the tap answered 409 'taken' (the refuse line)
//                      signedout a guest: the static ground-items row drawn, the prompt says to sign in, the tap says so (no writer call)
//   BEFORE=1 films a build WITHOUT the feature (trunk) through the same stub: the same spot, nothing drawn, no prompt.
//   ZONE_DIST=<built origins preview> OUT=<dir> LABEL=<before|after> WIDTHS=375,320 node scripts/ground-pickup-stills.mjs
/* global process, console, window, document */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { centre, serveOriginsPreview, stubSignedIn } from './lib/origins-preview-harness.mjs';

const ZONE = process.env.ZONE_DIST, out = process.env.OUT || 'artifacts/ground-pickup-stills', LABEL = process.env.LABEL || 'after', BEFORE = process.env.BEFORE === '1';
const WIDTHS = (process.env.WIDTHS || '375,320').split(',').map(Number);
// Offsets from the walker, metres: near = one inside the 1.5 m radius; several = six about the walker, the nearest inside the radius (x across, z ahead).
const SIGNED_OUT = 'ground:zone1.rusty-sword-1';
const OFFSETS = { near: [[0.3, 1.0]], several: [[0.3, 1.0], [-2.2, 2.6], [2.4, 3.4], [-0.8, 4.4], [3.4, 5.6], [-3.6, 6.4]], race: [[0.3, 1.0]], signedout: [] };
fs.mkdirSync(out, { recursive: true });
const { origin, close } = await serveOriginsPreview(ZONE);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { errors: [], frames: {} };
const shoot = (page, name) => page.screenshot({ path: path.join(out, name), type: 'jpeg', quality: 80, timeout: 240000 });

async function frame(width, scenario) {
  const page = await (await browser.newContext({ viewport: { width, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(`pageerror ${scenario}@${width}: ${String(e).slice(0, 200)}`));
  if (scenario !== 'signedout') await stubSignedIn(page, { offsets: OFFSETS[scenario], take: scenario === 'race' ? 'race' : 'taken' });
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
  if (scenario === 'signedout') { await page.waitForFunction((id) => window.originsPreview.ground.anchor(id) !== undefined, SIGNED_OUT, { timeout: 90000 }); await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [centre.x, centre.z - 1.3]); await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 30000 }); }
  else if (!BEFORE) await page.waitForFunction(() => window.originsPreview.ground.anchor('ground:still-0') !== undefined, null, { timeout: 90000 });
  await page.waitForTimeout(3000);
  const prompt = await page.evaluate(() => { const p = document.getElementById('prompt'); return { hidden: p.hidden, text: p.textContent }; });
  receipt.frames[`${scenario}-${width}`] = { rowsSeen: OFFSETS[scenario].length, prompt };
  await shoot(page, `${LABEL}-${scenario}-${width}.jpg`);
  if (!BEFORE && scenario !== 'several') {
    // A thumb taps the middle of the prompt: record what is on top there (the fight buttons share the bottom band), then tap that point.
    const hit = await page.evaluate(() => { const r = document.getElementById('prompt').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, e = document.elementFromPoint(x, y); return { x, y, top: e?.id || e?.className || e?.tagName, box: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
    receipt.frames[`${scenario}-${width}`].hit = hit;
    await page.touchscreen.tap(hit.x, hit.y); await page.waitForTimeout(1200);
    receipt.frames[`${scenario}-${width}`].after = await page.evaluate((id) => ({ toast: document.getElementById('world-toast')?.textContent ?? null, drawn: window.originsPreview.ground.anchor(id) !== undefined }), scenario === 'signedout' ? SIGNED_OUT : 'ground:still-0');
    await shoot(page, `${LABEL}-${scenario}-${width}-tap.jpg`);
  }
  await page.context().close();
}
try {
  for (const width of WIDTHS) for (const scenario of (process.env.SCENARIOS ? process.env.SCENARIOS.split(',') : BEFORE ? ['near', 'several'] : ['near', 'several', 'race', 'signedout'])) await frame(width, scenario);
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2)); console.log('stills', JSON.stringify(receipt));
} catch (error) { console.error('stills FAILED', JSON.stringify(receipt), error); process.exitCode = 1; }
finally { await browser.close(); close(); }
