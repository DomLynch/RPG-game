// Release row: the ground-loot pickup prompt (slice 3) never sits on a fight control, and its taps land (Lead 2026-10-15, found in the #2843 stills: the prompt covered ROLL at 375, "Someone got there first." covered STAB at 320).
// A signed-in walker with one drop in reach (the writer stubbed, the page and prompt real), headless Chromium on software GL, at 375 and 320 (one page, resized):
//   - the prompt "Take the ..." (and then each result line, which takes the prompt's slot) intersects no fight button, the move pad or the camera buttons, is inside the viewport, and is the topmost element at its centre (a tap lands on it);
//   - a take: the line replaces the prompt, the item is hidden; a lost race (409 taken): the refuse line, the item hidden AT ONCE and no Take prompt left once the line's lineSec has passed.
//   node scripts/ground-prompt-check.mjs [--dist <built origins preview>] [--out artifacts/ground-prompt]     (no --dist: builds origins/preview)
/* global process, console, document, window */
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { chromium } from 'playwright';
import { PICKUP } from '../origins/preview/ground-pickup.ts';
import { serveOriginsPreview, stubSignedIn } from './lib/origins-preview-harness.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'artifacts/ground-prompt')), WIDTHS = [375, 320];
const DIST = arg('dist') ? path.resolve(arg('dist')) : path.join(OUT, 'build');
await fs.mkdir(OUT, { recursive: true });
if (!arg('dist')) await build({ configFile: path.resolve('origins/preview/vite.config.mjs'), logLevel: 'error', build: { outDir: DIST, emptyOutDir: true } });
const { origin, close } = await serveOriginsPreview(DIST);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [], receipt = { widths: WIDTHS, steps: [] };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 75, timeout: 240000 });

// The prompt's box against every fight control a player can see; the topmost element at its centre; whether it is inside the viewport.
const measure = (page) => page.evaluate(() => {
  const p = document.getElementById('prompt'), r = p.getBoundingClientRect();
  const seen = (e) => { const cs = getComputedStyle(e), b = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 && b.width > 0 && b.height > 0; };
  const hit = (b) => !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom);
  const overlapping = [...document.querySelectorAll('#actions button, #joystick, #camera-button, #recenter-button')].filter((e) => seen(e) && hit(e.getBoundingClientRect())).map((e) => e.id || e.textContent.trim());
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { shown: !p.hidden, text: p.textContent, box: [r.left, r.top, r.right, r.bottom].map(Math.round), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overlapping, topmost: top?.id || top?.tagName };
});
const expectClear = async (page, step, text, tapTarget) => {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 812 }); await page.waitForTimeout(500);
    const m = await measure(page); receipt.steps.push({ step, width: w, ...m });
    if (!m.shown) failures.push(`${step} @${w}: the prompt is not shown`);
    else {
      if (m.text !== text) failures.push(`${step} @${w}: the prompt says "${m.text}", wanted "${text}"`);
      if (m.overlapping.length) failures.push(`${step} @${w}: the prompt covers ${m.overlapping.join(', ')}`);
      if (!m.inView) failures.push(`${step} @${w}: the prompt is outside the viewport ${JSON.stringify(m.box)}`);
      if (tapTarget && m.topmost !== 'prompt') failures.push(`${step} @${w}: the topmost element at the prompt's centre is ${m.topmost}, a tap would not land on it`);
    }
    if (tapTarget) await shot(page, `${step}-${w}.jpg`);   // a line is on screen for lineSec only: no slow screenshot between the two widths
  }
};
async function run(take) {
  const page = await (await browser.newContext({ viewport: { width: WIDTHS[0], height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  await stubSignedIn(page, { offsets: [[0.3, 1.0]], take });
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
  await page.waitForFunction(() => window.originsPreview.ground.anchor('ground:still-0') !== undefined, null, { timeout: 90000 });
  await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 30000 });
  const name = (await measure(page)).text.replace(/^Take the /, '');
  await expectClear(page, `${take}-prompt`, `Take the ${name}`, true);
  await page.setViewportSize({ width: WIDTHS[0], height: 812 }); await page.waitForTimeout(300);
  const box = await measure(page); await page.touchscreen.tap((box.box[0] + box.box[2]) / 2, (box.box[1] + box.box[3]) / 2); await page.waitForTimeout(800);
  if (!(await page.evaluate(() => window.originsPreview.ground.anchor('ground:still-0') === undefined))) failures.push(`${take}: the item is still drawn after the tap`);
  await expectClear(page, `${take}-line`, take === 'race' ? PICKUP.outcomes.taken.line : PICKUP.labels.taken.replace('{item}', name), false);
  await page.waitForTimeout(PICKUP.lineSec * 1000 + 600);
  const after = await measure(page); receipt.steps.push({ step: `${take}-after-line`, shown: after.shown, text: after.text });
  if (after.shown) failures.push(`${take}: a prompt ("${after.text}") is still up after the line's ${PICKUP.lineSec} s`);
  if (errors.length) failures.push(...errors);
  await page.context().close();
}
try { await run('taken'); await run('race'); }
catch (e) { failures.push(`check crashed: ${String(e).slice(0, 300)}`); }
finally { await browser.close(); close(); }
receipt.failures = failures; await fs.writeFile(path.join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 2));
console.log('RESULT', JSON.stringify({ ok: !failures.length, failures, steps: receipt.steps.map((s) => [s.step, s.width, s.shown, s.overlapping?.length ?? 0, s.topmost]) }));
if (failures.length) process.exitCode = 1;
