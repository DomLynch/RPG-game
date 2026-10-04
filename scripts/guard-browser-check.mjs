// Brief 13 receipt: six ring guards from src/assets/guard.glb pacing, turning, standing, raising and lashing on guard-preview.html at
// the phone tier (852×393, DPR 2, touch), through a real WebGL frame loop. Reports the frame-time p50/p95 over a five-second window
// once every clip has played somewhere, the scene's triangle and draw counts, and a still; fails on a page error, a missing clip, or a
// p95 over the budget. This is the pre-integration number for the model itself — the world lane's in-game placement adds the arena.
//
// WHAT THIS CHECK CAN AND CANNOT SEE (2026-09-22, after the world lane took it apart):
//   * It asserts on CPU FRAME COST — the main-thread work from the top of the frame to after the draw call returns — under ×4 CDP CPU
//     throttling, against a 16.7 ms budget (a 60 fps frame). That number means something: it is the scene's own cost.
//   * It does NOT measure GPU cost, and it CANNOT measure frame cost from rAF deltas. At 60 Hz vsync those deltas are the CADENCE: they
//     sit at 16.6–16.7 ms p50 whether the scene is six guards or an empty page, so a p95 of 17.6 is jitter around vsync and proves
//     nothing either way. They are reported as context and assert nothing.
//   * The "phone tier" here is a viewport and a touch flag on a Mac, not an iPhone's GPU. A real verdict on phone frame cost needs GPU
//     timer queries or a device; the world lane's `?perf=1` overlay on Dom's own iPhone is the instrument of record for that.
// The budget was 18 ms until today, chosen by taking "a bit over 60 fps" rather than deriving it — which let a p95 of 17.6 read as a
// pass. The derivation is now right, and it is applied to a number that can actually fail for a real reason.
//
//   node scripts/guard-browser-check.mjs [--count 6] [--budget-ms 18] [--dir artifacts/character/guard]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const args = process.argv.slice(2), option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const count = Number(option('count', 6)), budget = Number(option('budget-ms', 16.7)), dir = option('dir', 'artifacts/character/guard');
const throttle = Number(option('cpu-throttle', 4));   // CDP: the harness runs on a Mac, so slow the CPU down before believing any CPU number
await fs.mkdir(dir, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
await server.listen();
const url = `${server.resolvedUrls.local[0]}guard-preview.html?count=${count}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url, count, budgetMs: budget, errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  page.on('pageerror', e => receipt.errors.push(String(e)));
  page.on('console', m => { const where = m.location()?.url ?? ''; if (m.type() === 'error' && !/favicon\.ico/.test(`${m.text()} ${where}`)) receipt.errors.push(`${m.text()} ${where}`.trim()); });   // the URL, so a real 404 is never mistaken for the favicon's
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) receipt.errors.push(`${r.status()} ${r.url()}`); });   // the page's own 404s; the favicon is the preview server's, not the guard's
  await page.goto(url);
  await page.waitForFunction(() => window.__guard?.ready, null, { timeout: 90000 });
  const clips = await page.evaluate(() => window.__guard.clips);
  assert.deepEqual([...clips].sort(), ['Lash', 'Pace', 'Raise', 'Stand', 'Turn'], `guard.glb carries the five clips: ${clips}`);
  await page.waitForTimeout(3000);   // warm-up: shaders, first poses
  await page.evaluate(() => { window.__guard.frames.length = 0; });
  await page.waitForTimeout(5000);   // the window: five seconds covers every clip in the schedule across six phases
  const sample = await page.evaluate(() => ({ frames: window.__guard.frames, cpu: window.__guard.cpu, tris: window.__guard.tris, calls: window.__guard.calls, count: window.__guard.count }));
  const pct = values => { const sorted = [...values].sort((a, b) => a - b), q = f => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
    return { count: sorted.length, p50: +q(.5).toFixed(2), p95: +q(.95).toFixed(2), max: +sorted[sorted.length - 1].toFixed(2) }; };
  const cpu = pct(sample.cpu), delta = pct(sample.frames);
  Object.assign(receipt, { cpuThrottle: throttle, cpu, rafDelta: delta, frames: cpu.count, triangles: sample.tris, drawCalls: sample.calls,
    cannotSee: 'no GPU cost, and at 60 Hz vsync rAF deltas measure the cadence rather than the frame cost — they sit at ~16.7 ms for an empty page too' });
  await page.screenshot({ path: `${dir}/six-guards-phone.png` });
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(`guard check: ${sample.count} guards, ${sample.tris} tris, ${sample.calls} draws over ${cpu.count} frames`);
  console.log(`  CPU frame cost at ×${throttle} throttling: p50 ${cpu.p50} ms, p95 ${cpu.p95} ms, max ${cpu.max} ms (budget p95 ≤ ${budget} ms) — this is what is asserted`);
  console.log(`  rAF deltas, context only: p50 ${delta.p50} ms, p95 ${delta.p95} ms. NOT a frame cost: ${receipt.cannotSee}.`);
  console.log(`  → ${dir}/`);
  assert.equal(receipt.errors.length, 0, `page errors: ${receipt.errors.join(' | ')}`);
  assert.ok(cpu.p95 <= budget, `CPU frame cost p95 ${cpu.p95} ms over the ${budget} ms budget with ${sample.count} guards at ×${throttle} throttling`);
} finally {
  await browser.close(); await server.close();
}
