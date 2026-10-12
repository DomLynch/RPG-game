// Proof 3 harness (many-on-one): engage one creature of a pack and measure the whole fight, not just who joined. Same page, two phases: 6 s walking beside the camp (BASELINE), then the pack fight (FIGHT).
//   node scripts/many-on-one-check.mjs <out dir>   env: LIVE_URL (default the live Zone 2 page), TAGS_TARGET (z2:reach-pack-a-1), MIN_JOINED (4), FIGHT_MS (20000), MAX_FRAME_RATIO (default 3: fight p95 frame may be at most 3x baseline p95)
// Reports joined, peak engaged (vs MAX_ATTACKERS), frame time p50/p95/max in both phases (requestAnimationFrame deltas), wound bursts/marks (originsPreview.wounds()), hero outcome, page errors. FAILS on: engaged > MAX_ATTACKERS,
// fewer than MIN_JOINED, any page error, fight p95 above MAX_FRAME_RATIO x baseline p95, or marks dropping while bursts grow (a wounds-pool problem). Software GL frame times are inflated: the RATIO is the receipt, not the milliseconds.
// Run on the VPS: capture --prio 3 world env HOME=/home/lanes node scripts/many-on-one-check.mjs /tmp/m1
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { MAX_ATTACKERS } from '../src/fight/attackers.ts';

const out = process.argv[2] || 'artifacts/many-on-one', url = process.env.LIVE_URL || 'https://frankendom.com/zone/2/?region=1&zone=2&worldfight';
const want = process.env.TAGS_TARGET || 'z2:reach-pack-a-1', minJoined = Number(process.env.MIN_JOINED || 4), fightMs = Number(process.env.FIGHT_MS || 20000), maxRatio = Number(process.env.MAX_FRAME_RATIO || 3);
const pct = (a, p) => (a.length ? +[...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))].toFixed(1) : null);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { url, target: want, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000 });
  const all = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, name: m.name, x: m.x, z: m.z }))), t = all.find((m) => m.id === want);
  assert.ok(t, `no creature ${want}`);
  receipt.nearTarget = all.filter((m) => Math.hypot(m.x - t.x, m.z - t.z) < 14).length;
  const frames = () => page.evaluate(() => window.__ft.splice(0));
  const wounds = () => page.evaluate(() => window.originsPreview.wounds?.() ?? null);
  const stat = (a) => ({ n: a.length, p50: pct(a, 0.5), p95: pct(a, 0.95), max: pct(a, 1) });
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 22, 0), [t.x, t.z]); await page.waitForTimeout(3000); await frames();   // out of aggro range: the BASELINE is the same scene, nobody fighting
  await page.waitForTimeout(6000); receipt.baseline = stat(await frames());
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [t.x, t.z]); await page.waitForTimeout(2500);
  await page.evaluate((id) => window.originsPreview.tapMob(id), t.id); await frames();
  const joined = new Set(); let peakEngaged = 0, samples = 0, heroDown = false; const w0 = await wounds(), series = [], t0 = Date.now();
  while (Date.now() - t0 < fightMs) {
    const c = await page.evaluate(() => ({ f: window.originsPreview.combat().fighters, hero: window.originsPreview.combat().hero })), f = c.f.filter((x) => x.id !== 'me' && x.phase !== 'dead');
    if (f.length && f.some((x) => typeof x.duel !== 'boolean')) throw new Error('this release has no fighters[].duel (world-combat debug)');
    f.forEach((x) => joined.add(x.id)); const engaged = f.filter((x) => x.duel).length; peakEngaged = Math.max(peakEngaged, engaged); samples++;
    assert.ok(engaged <= MAX_ATTACKERS, `${engaged} creatures in a duel with the hero at one sample (MAX_ATTACKERS ${MAX_ATTACKERS})`);
    if (c.hero?.dead) { heroDown = true; break; }
    if (samples % 6 === 0) series.push(await wounds());
    await page.evaluate(() => window.originsPreview.press('light')); await page.waitForTimeout(250);
  }
  receipt.fight = stat(await frames()); const w1 = await wounds(); receipt.wounds = { start: w0, end: w1 };
  receipt.joined = joined.size; receipt.peakEngaged = peakEngaged; receipt.samples = samples; receipt.heroDown = heroDown;
  await page.screenshot({ path: `${out}/many-on-one.png`, timeout: 120000 });
  fs.writeFileSync(`${out}/receipt.json`, JSON.stringify({ ...receipt, woundsSeries: series }, null, 1));
  assert.ok(joined.size >= minJoined, `only ${joined.size} joined (wanted ${minJoined})`);
  assert.ok(peakEngaged >= 1, 'nobody got into a duel with the hero');
  assert.ok(receipt.baseline.p95 && receipt.fight.p95 <= receipt.baseline.p95 * maxRatio, `fight p95 frame ${receipt.fight.p95} ms is over ${maxRatio}x baseline ${receipt.baseline.p95} ms`);
  if (w0 && w1 && typeof w1.bursts === 'number') assert.ok(w1.marks >= w0.marks || w1.bursts === w0.bursts, `wounds pool: bursts ${w0.bursts}->${w1.bursts} but marks ${w0.marks}->${w1.marks}`);
  assert.deepEqual(receipt.errors, []);
  console.log('many-on-one: PASS', JSON.stringify(receipt));
} catch (error) { console.error('many-on-one: FAIL', String(error.message ?? error), JSON.stringify(receipt)); process.exitCode = 1; }
finally { await browser.close(); }
