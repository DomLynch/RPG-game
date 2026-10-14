// LIVE check (Proof 2 / Proof 3, many-on-one): engage one creature of a camp on the live site and sample who is in the fight for 14 s.
//   node scripts/live-pack-check.mjs <out dir>      env: LIVE_URL (default the Zone 2 page), TAGS_TARGET (default z2:reach-pack-a-1), MIN_JOINED (default 4)
// Reports `joined` (everyone who entered the world fight, wolves and the others counted separately) and `peak engaged` (creatures in a duel with the hero at one sample), and FAILS if
// peak engaged > MAX_ATTACKERS (src/fight/attackers.ts) or fewer than MIN_JOINED joined: "6 joined" must never mean 6 attacking at once. The page needs `fighters[].duel` (world-combat debug).
// Software GL is fine (it reads the engine's state, not frames). Run on the VPS: capture --prio 3 <lane> env HOME=/home/lanes node scripts/live-pack-check.mjs /tmp/pack-live
import { MAX_ATTACKERS } from '../src/fight/attackers.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

const out = process.argv[2] || 'artifacts/live-pack', url = process.env.LIVE_URL || 'https://frankendom.com/zone/2/?region=1&zone=2&worldfight';
const want = process.env.TAGS_TARGET || 'z2:reach-pack-a-1', minJoined = Number(process.env.MIN_JOINED || 4);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { url, target: want, errors: [] };
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.originsPreview?.mobs()?.mobs?.length > 0, null, { timeout: 240000 });
  const all = await page.evaluate(() => window.originsPreview.mobs().mobs.map((m) => ({ id: m.id, body: m.body, name: m.name, x: m.x, z: m.z }))), t = all.find((m) => m.id === want);
  assert.ok(t, `no creature ${want}`);
  receipt.nearTarget = all.filter((m) => Math.hypot(m.x - t.x, m.z - t.z) < 14).map((m) => `${m.id}:${m.name}`);
  await page.evaluate(([x, z]) => window.originsPreview.place(x, z - 2.5, 0), [t.x, t.z]); await page.waitForTimeout(2500);
  await page.evaluate((id) => window.originsPreview.tapMob(id), t.id);
  const joined = new Set(); let peakEngaged = 0, samples = 0; const t0 = Date.now();
  while (Date.now() - t0 < 14000) {
    const f = (await page.evaluate(() => window.originsPreview.combat().fighters)).filter((x) => x.id !== 'me' && x.phase !== 'dead');
    if (f.length && f.some((x) => typeof x.duel !== 'boolean')) throw new Error('this release has no fighters[].duel (world-combat debug): the receipt needs a release that carries it');
    f.forEach((x) => joined.add(x.id)); const engaged = f.filter((x) => x.duel).length; peakEngaged = Math.max(peakEngaged, engaged); samples++;
    assert.ok(engaged <= MAX_ATTACKERS, `${engaged} creatures in a duel with the hero at one sample (MAX_ATTACKERS ${MAX_ATTACKERS})`);
    await page.waitForTimeout(300);
  }
  const names = new Map(all.map((m) => [m.id, m]));
  receipt.joined = joined.size; receipt.peakEngaged = peakEngaged; receipt.samples = samples;
  receipt.byBody = Object.fromEntries([...joined].reduce((m, id) => m.set(names.get(id)?.name ?? id, (m.get(names.get(id)?.name ?? id) ?? 0) + 1), new Map()));
  assert.ok(joined.size >= minJoined, `only ${joined.size} joined (wanted ${minJoined})`);
  assert.ok(peakEngaged >= 1, 'nobody got into a duel with the hero');
  await page.screenshot({ path: `${out}/pack.png`, timeout: 120000 });
  assert.deepEqual(receipt.errors, []);
  console.log('live-pack: PASS', JSON.stringify(receipt));
} catch (error) { console.error('live-pack: FAIL', String(error.message ?? error), JSON.stringify(receipt)); process.exitCode = 1; }
finally { await browser.close(); }
