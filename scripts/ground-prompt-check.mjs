// Release row: the ground-loot pickup prompt (slice 3) never sits on a fight control, and its taps land (Lead 2026-10-15, found in the #2843 stills: the prompt covered ROLL at 375, "Someone got there first." covered STAB at 320).
// A signed-in walker with one drop in reach (the writer stubbed, the page and prompt real), headless Chromium on software GL, at 375 and 320 (one page, resized):
//   - the prompt "Take the ..." (and then each result line, which takes the prompt's slot) intersects no fight button, the move pad or the camera buttons, is inside the viewport, and is the topmost element at its centre (a tap lands on it);
//   - a take: the line replaces the prompt, the item is hidden; a lost race (409 taken): the refuse line, the item hidden AT ONCE and no Take prompt left once the line's lineSec has passed.
//   - a GUEST (no session, no stub; Dom 2026-10-16): the same prompt "Take the ..." on the static row, the take puts it in the session bag, the "Sign in to keep it" line, the item hidden.
//   node scripts/ground-prompt-check.mjs [--dist <built origins preview>] [--out artifacts/ground-prompt]     (no --dist: builds origins/preview)
/* global process, console, document, window */
import { launchBrowser } from './lib/harness-browser-launch.mjs';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { build } from 'vite';
import { chromium } from 'playwright';
import RULES from '../origins/preview/ground-pickup.json' with { type: 'json' };   // the row itself, not ground-pickup.ts: this script's import chain stops at data (the row-placement test keeps it off the Mac list)
import { serveOriginsPreview, stubSignedIn } from './lib/origins-preview-harness.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const PICKUP = RULES.groundPickup[0].fields;
const CEILING_MS = 13 * 60_000;   // the whole check, under the row's own 900 s ceiling (scripts/lib/row-ceilings.json): a hang is a FAIL with a line, never a cancelled job. Zone 1 = the Test Zone look (#3266: fortress dome, camp kit, bigger bodies) made each of the four page loads cost more on software GL: row 57 took 200 s on trunk and 347 s at that head on the VPS (frame time on a real GPU is unchanged: p50 17 ms both), and ran past the old 8-minute ceiling on CI (JJ)
const OUT = path.resolve(arg('out', 'artifacts/ground-prompt')), WIDTHS = [375, 320];
const DIST = arg('dist') ? path.resolve(arg('dist')) : path.join(OUT, 'build');
await fs.mkdir(OUT, { recursive: true });
if (!arg('dist')) await build({ configFile: path.resolve('origins/preview/vite.config.mjs'), logLevel: 'error', build: { outDir: DIST, emptyOutDir: true } });
const STARTED = Date.now();
const { origin, close } = await serveOriginsPreview(DIST);
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [], receipt = { widths: WIDTHS, steps: [] };
// No fixed sleeps (a loaded box turns them into false FAILs): every wait polls its condition up to a ceiling.
const settled = async (page, w) => { await page.setViewportSize({ width: w, height: 812 }); await page.waitForFunction((x) => innerWidth === x, w, { timeout: 15000 }); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
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
// A line holds the prompt's slot for lineSec (3.5 s) and prompt.hidden is recomputed only in the page's frame loop, so on a loaded software-GL box a slow frame can spend the whole line before any frame shows it (the K5y flake: "never took the prompt's slot within 15 s", then "the prompt is not shown"; the retry passed). Waiting longer for a line that has already expired cannot work: wait for a frame to have run, say the line, and give THAT line its lineSec to be drawn; if a stall ate it, say it again (bounded), and fail only when every attempt was eaten. STALL_ONCE_MS is a fault-injection knob for the red-to-green receipt: it blocks the page's main thread for that long right after the first say().
const SAYS = 8, STALL_ONCE_MS = Number(process.env.GROUND_STALL_ONCE_MS || 0); let stalled = false;
const sayAndSee = async (page, step, w, text) => {
  for (let attempt = 1; attempt <= SAYS; attempt++) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));   // a frame has just run: the loop is alive, so the next one is likely to draw the line while it is still held
    await page.evaluate((t) => window.originsPreview.ground.say(t), text);
    if (STALL_ONCE_MS && !stalled) { stalled = true; await page.evaluate((ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms); }, STALL_ONCE_MS); }
    const seen = await page.waitForFunction((t) => { const p = document.getElementById('prompt'); return !p.hidden && p.textContent === t; }, text, { timeout: PICKUP.lineSec * 1000, polling: 50 }).then(() => true, () => false);
    if (seen) { if (attempt > 1) receipt.steps.push({ step, width: w, saidAgain: attempt - 1 }); return; }
  }
  failures.push(`${step} @${w}: the line "${text}" never took the prompt's slot in ${SAYS} tries of ${PICKUP.lineSec} s`);
};
const expectClear = async (page, step, text, tapTarget) => {
  for (const w of WIDTHS) {
    await settled(page, w);
    if (!tapTarget) await sayAndSee(page, step, w, text);
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
// One page load of Zone 1 costs minutes on software GL, and row 57 was four of them (8 to 10 min). Now two: ONE signed-in page serves the taken take, the race take and the walk prompts (the stub's writer forgets between takes and the page's own poll brings the item back), and the guest has its own, being signed out.
const openPage = async (stub) => {
  const page = await (await browser.newContext({ viewport: { width: WIDTHS[0], height: 812 }, isMobile: true, hasTouch: true })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  const writer = stub ? await stubSignedIn(page, { offsets: [[0.3, 1.0]], take: 'taken' }) : null;
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
  return { page, errors, writer };
};
let signed = null;
async function run(take) {
  const guest = take === 'guest', ID = guest ? 'ground:zone1.rusty-sword-1' : 'ground:still-0';   // a guest: no session and no stub, the static row, and the take goes to the session bag
  if (!guest && !signed) signed = await openPage(true);
  else if (!guest) signed.writer.again(take);   // the second signed-in take: the writer forgets the first, the poll shows the item again
  const { page, errors } = guest ? await openPage(false) : signed;
  await settled(page, WIDTHS[0]);
  await page.waitForFunction((id) => window.originsPreview.ground.anchor(id) !== undefined, ID, { timeout: 90000 });
  if (guest) { const a = await page.evaluate((id) => window.originsPreview.ground.anchor(id), ID); await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [a.x, a.z - 1.3]); }   // the row's own point (its place centre plus its offset, wherever World puts it), not the place centre
  await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 30000 }).catch(() => { throw new Error(`${take}: ground prompt: never showed within 30 s`); });   // a named step, not "check crashed: TimeoutError"
  const name = (await measure(page)).text.replace(/^Take the /, '');
  await expectClear(page, `${take}-prompt`, `Take the ${name}`, true);
  await settled(page, WIDTHS[0]);
  const box = await measure(page), lineText = take === 'race' ? PICKUP.outcomes.taken.line : (guest ? PICKUP.labels.guestTaken : PICKUP.labels.taken).replace('{item}', name);
  await page.touchscreen.tap((box.box[0] + box.box[2]) / 2, (box.box[1] + box.box[3]) / 2);
  await page.waitForFunction((t) => { const p = document.getElementById('prompt'); return !p.hidden && p.textContent === t; }, lineText, { timeout: 15000 }).catch(() => failures.push(`${take}: the line "${lineText}" never took the prompt's slot after the tap`));
  if (!(await page.evaluate((id) => window.originsPreview.ground.anchor(id) === undefined, ID))) failures.push(`${take}: the item is still drawn after the tap`);
  await expectClear(page, `${take}-line`, lineText, false);
  await page.waitForFunction(() => document.getElementById('prompt').hidden, null, { timeout: (PICKUP.lineSec + 15) * 1000 }).catch(() => {});
  const after = await measure(page); receipt.steps.push({ step: `${take}-after-line`, shown: after.shown, text: after.text });
  if (after.shown) failures.push(`${take}: a prompt ("${after.text}") is still up once the line's ${PICKUP.lineSec} s are over`);
  if (guest) { if (errors.length) failures.push(...errors); await page.context().close(); }
}
// Talk, Bank and Fight in the Pit share the prompt's slot (#2857): the hero is placed where each shows, and the shown prompt is measured like the ground one.
async function runPrompts() {
  const { page, errors } = signed;   // the shared signed-in page: the race take left the ground item gone, which these prompts do not need
  await settled(page, WIDTHS[0]);
  const spots = await page.evaluate(() => window.originsPreview.promptSpots());
  let prev = '';
  for (const [kind, [x, z]] of Object.entries(spots)) {
    await page.evaluate(([px, pz]) => window.originsPreview.place(px, pz, 0), [x, z]);
    await page.waitForFunction((was) => { const p = document.getElementById('prompt'); return !p.hidden && p.textContent !== was; }, prev, { timeout: 30000 }).catch(() => failures.push(`${kind}: no prompt shown at its spot ${x},${z}`));
    const label = await page.evaluate(() => document.getElementById('prompt').textContent);
    prev = label;
    await expectClear(page, `prompt-${kind}`, label, true);
  }
  if (errors.length) failures.push(...errors);
  await page.context().close();   // the last use of the shared page
}
const ceiling = new Promise((_, reject) => setTimeout(() => reject(new Error(`the check ran past its ${CEILING_MS / 1000} s ceiling`)), CEILING_MS).unref());
try { await Promise.race([(async () => { await run('taken'); await run('race'); await runPrompts(); await run('guest'); })(), ceiling]); }
catch (e) { failures.push(`check crashed: ${String(e).slice(0, 300)}`); }
finally { await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 15000).unref())]); await close(); }
receipt.failures = failures; await fs.writeFile(path.join(OUT, 'receipt.json'), JSON.stringify(receipt, null, 2));
console.log('RESULT', JSON.stringify({ ok: !failures.length, failures, steps: receipt.steps.map((s) => [s.step, s.width, s.shown, s.overlapping?.length ?? 0, s.topmost]) }));
// The static server's port must be closed now: nothing may be left listening that could hold the job.
const port = Number(new URL(origin).port);
const portClosed = await new Promise((r) => { const c = net.connect(port, '127.0.0.1'); c.once('connect', () => { c.destroy(); r(false); }); c.once('error', () => r(true)); });
if (!portClosed) failures.push(`port ${port} is still listening after the check`);
if (!failures.length) console.log(`ground-prompt-check passed in ${Math.round((Date.now() - STARTED) / 1000)}s (exit 0, port ${port} closed)`);
else console.log(`ground-prompt-check FAILED in ${Math.round((Date.now() - STARTED) / 1000)}s: ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);   // exit on the result: nothing left open (the static server, a browser child) may hold the job
