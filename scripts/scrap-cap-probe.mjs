/* global process, console, document, window */
// Probe (Lead 2026-10-16): can a walker take the goblin scrap cap at the cinder-fields scavenger camp (cap 6 m past the camp centre, the camp aggroes at 7 m)?
// The hero is placed on the cap with the real row stubbed (offset -1,6 from the place centre); we record the camp's state, whether the "Take the ..." prompt is shown and clear
// while the camp is engaged, and what a real touch tap on it does (a ground_take request, the line). Prints a REPORT line.
//   node scripts/scrap-cap-probe.mjs --dist <built origins preview> [--out artifacts/scrap-cap]
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveOriginsPreview, stubSignedIn, centreOf } from './lib/origins-preview-harness.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', 'artifacts/scrap-cap')), DIST = path.resolve(arg('dist'));
const CAP = { instance: 'ground:zone1.goblin-scrap-cap-1', item: 'item:starter.goblin-scrap-cap', offsetX: -1, offsetZ: 6 };
await fs.mkdir(OUT, { recursive: true });
const { origin, close } = await serveOriginsPreview(DIST);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { steps: [] }, errors = [];
const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await stubSignedIn(page, { offsets: [], take: 'taken' });
  let taken = false; const takes = [];
  await page.route('**/origins/ground_state', (route) => json(route, { ok: true, result: { now: new Date().toISOString(), items: [{ ...CAP, zone: 'zone1', place: 'cinder-fields', radiusM: 1.5, available: !taken, visible: !taken }] } }));
  await page.route('**/origins/ground_take', async (route) => { taken = true; takes.push(await page.evaluate(() => ({ near: window.originsPreview.region()?.near ?? null, mobs: window.originsPreview.mobs()?.mobs?.filter((m) => m.engaged || m.state !== 'idle').length ?? null }))); json(route, { ok: true, result: { result: 'taken', instance: CAP.instance, item: CAP.item, qty: 1, availableAt: new Date(Date.now() + 3.6e6).toISOString() } }); });
  await page.goto(`${origin}/preview/origins/?region=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.some((m) => m.drawn && m.body), null, { timeout: 150000 });
  const centre = await centreOf(page);
  report.centre = centre; report.capAt = { x: centre.x + CAP.offsetX, z: centre.z + CAP.offsetZ };
  const sample = await page.evaluate(() => window.originsPreview.mobs()); report.mobKeys = Object.keys(sample.mobs[0] ?? {}); report.mobCount = sample.mobs.length;
  const snap = (label) => page.evaluate((l) => {
    const p = document.getElementById('prompt'), o = window.originsPreview, ms = o.mobs()?.mobs ?? [];
    return { label: l, body: document.body.className, prompt: p.hidden ? null : p.textContent, near: o.region()?.near ?? null, pos: [Math.round(o.pos.x * 10) / 10, Math.round(o.pos.z * 10) / 10], mobs: ms.filter((m) => m.drawn).slice(0, 8).map((m) => ({ id: m.id, d: Math.round(Math.hypot(m.x - o.pos.x, m.z - o.pos.z) * 10) / 10, ...Object.fromEntries(Object.entries(m).filter(([k, v]) => ['mode', 'state', 'engaged', 'aggro', 'hp', 'dead', 'fighting'].includes(k) && typeof v !== 'object')) })) };
  }, label);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), [report.capAt.x, report.capAt.z]);
  const placedAt = Date.now();
  if (arg('engage')) { report.engage = await page.evaluate((id) => window.originsPreview.tapMob(id), arg('engage')); report.tapLog = await page.evaluate(() => window.originsPreview.tapLog().slice(-3)); }   // the camp wanders and does not aggro on a placed hero: engage one by the page's own tap (same reach rule)
  for (let k = 0; k < 160 && report.firstPromptS === undefined; k++) { if (await page.evaluate(() => !document.getElementById('prompt').hidden)) report.firstPromptS = Math.round((Date.now() - placedAt) / 100) / 10; else await page.waitForTimeout(250); }   // seconds from placing the hero to the first "Take the ..." (null = none within 40 s)
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(2500); const s = await snap(`bout+${(i + 1) * 2.5}s`); report.steps.push(s); if (s.prompt && i >= 3) { report.promptAfterS = Math.round((Date.now() - placedAt) / 1000); break; } }   // the ground state is polled every 20 s (ground-pickup.json pollSec): the prompt waits for a read, whatever the camp is doing
  report.promptShown = await page.evaluate(() => { const p = document.getElementById('prompt'); if (p.hidden) return null; const r = p.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { text: p.textContent, topmost: top?.id || top?.tagName, box: [r.left, r.top, r.right, r.bottom].map(Math.round) }; });
  await page.screenshot({ path: path.join(OUT, 'cap-bout.jpg'), type: 'jpeg', quality: 72, timeout: 240000 });
  if (report.promptShown) {
    const [l, t, r, b] = report.promptShown.box; await page.touchscreen.tap((l + r) / 2, (t + b) / 2);
    await page.waitForTimeout(4000); report.afterTap = await snap('after-tap'); report.takeRequests = takes;
    await page.screenshot({ path: path.join(OUT, 'cap-after-tap.jpg'), type: 'jpeg', quality: 72, timeout: 240000 });
  }
  report.errors = errors;
} catch (e) { report.crashed = String(e).slice(0, 300); }
finally { console.log('REPORT', JSON.stringify(report)); await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 15000).unref())]); await close(); process.exit(0); }
