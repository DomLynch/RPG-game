// Brief 13 receipt: six ring guards from src/assets/guard.glb pacing, turning, standing, raising and lashing on guard-preview.html at
// the phone tier (852×393, DPR 2, touch), through a real WebGL frame loop. Reports the frame-time p50/p95 over a five-second window
// once every clip has played somewhere, the scene's triangle and draw counts, and a still; fails on a page error, a missing clip, or a
// p95 over the budget. This is the pre-integration number for the model itself — the world lane's in-game placement adds the arena.
//
//   node scripts/guard-browser-check.mjs [--count 6] [--budget-ms 18] [--dir artifacts/character/guard]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const args = process.argv.slice(2), option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const count = Number(option('count', 6)), budget = Number(option('budget-ms', 18)), dir = option('dir', 'artifacts/character/guard');
await fs.mkdir(dir, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
await server.listen();
const url = `${server.resolvedUrls.local[0]}guard-preview.html?count=${count}`;
const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
const receipt = { url, count, budgetMs: budget, errors: [] };
try {
  const context = await browser.newContext({ viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', e => receipt.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') receipt.errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__guard?.ready, null, { timeout: 90000 });
  const clips = await page.evaluate(() => window.__guard.clips);
  assert.deepEqual([...clips].sort(), ['Lash', 'Pace', 'Raise', 'Stand', 'Turn'], `guard.glb carries the five clips: ${clips}`);
  await page.waitForTimeout(3000);   // warm-up: shaders, first poses
  await page.evaluate(() => { window.__guard.frames.length = 0; });
  await page.waitForTimeout(5000);   // the window: five seconds covers every clip in the schedule across six phases
  const sample = await page.evaluate(() => ({ frames: window.__guard.frames, tris: window.__guard.tris, calls: window.__guard.calls, count: window.__guard.count }));
  const sorted = [...sample.frames].sort((a, b) => a - b), q = f => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
  Object.assign(receipt, { frames: sorted.length, p50Ms: +q(.5).toFixed(2), p95Ms: +q(.95).toFixed(2), maxMs: +sorted[sorted.length - 1].toFixed(2), triangles: sample.tris, drawCalls: sample.calls });
  await page.screenshot({ path: `${dir}/six-guards-phone.png` });
  await fs.writeFile(`${dir}/receipt.json`, JSON.stringify(receipt, null, 2));
  console.log(`guard check: ${sample.count} guards, ${sample.tris} tris, ${sample.calls} draws; frame p50 ${receipt.p50Ms} ms, p95 ${receipt.p95Ms} ms, max ${receipt.maxMs} ms over ${sorted.length} frames (budget p95 ≤ ${budget} ms) → ${dir}/`);
  assert.equal(receipt.errors.length, 0, `page errors: ${receipt.errors.join(' | ')}`);
  assert.ok(receipt.p95Ms <= budget, `frame p95 ${receipt.p95Ms} ms over the ${budget} ms budget with ${sample.count} guards`);
} finally {
  await browser.close(); await server.close();
}
