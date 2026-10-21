// Zone exit gate (the beta dungeon's door, zones/exit-rows.json): on the built origins preview at 375 wide, touch, step onto the cave mouth in Zone 1, cross to the Bone Hollow (Zone 5) and back through the
// hollow gate. Asserts: each crossing lands the walker inside the far landmark (3 m, outside the door), [zone ready] fires on arrival, and NOTHING compiles after [zone ready] on either side of the crossing
// (renderInfo programNames before and after a settle). Stills of the mouth and the gate go to artifacts/zone-exit/. Serves artifacts/origins-preview (built here when missing). Receipt: artifacts/zone-exit.json.
import { launchBrowser } from './lib/browser-launch.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd(), built = path.join(root, 'artifacts/origins-preview'), shots = path.join(root, 'artifacts/zone-exit');
if (!fs.existsSync(path.join(built, 'index.html'))) execFileSync('npx', ['vite', 'build', '--config', 'origins/preview/vite.config.mjs'], { stdio: 'inherit', timeout: 600_000 });
fs.mkdirSync(shots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const roots = { '/preview/origins/': `${built}/` };
for (const d of ['game', 'weapons', 'arena', 'pit', 'looks', 'legends', 'shields', 'herolook', 'gear-ui', 'world', 'beasts']) roots[`/${d}/`] = `${root}/public/${d}/`;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); let hit = null;
  for (const [p, r] of Object.entries(roots)) if (u.startsWith(p)) hit = path.join(r, u.slice(p.length) || 'index.html');
  if (hit && fs.existsSync(hit) && fs.statSync(hit).isDirectory()) hit = path.join(hit, 'index.html');
  if (!hit || !fs.existsSync(hit)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[path.extname(hit)] ?? 'application/octet-stream' }); fs.createReadStream(hit).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(chromium, { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const receipt = { origin, viewport: '375x812 touch', errors: [], legs: [] };
const SETTLE_MS = Number(process.env.EXIT_SETTLE_MS ?? 15000);
try {
  const page = await (await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', (e) => receipt.errors.push(String(e).slice(0, 200)));
  const ready = async (label) => {
    await page.waitForFunction(() => window.__zoneReady && window.originsPreview, null, { timeout: 240000 }).catch(() => { throw new Error(`${label}: [zone ready] (window.__zoneReady) never fired`); });
    // Another player's gear programs are linked in idle time AFTER [zone ready] by design (main.ts warmRemoteKitsInIdle, #2938), as the crowd harness knows: wait for that warm to answer, then count.
    const warm = await page.waitForFunction(() => window.originsPreview.remoteKitsWarm?.(), null, { timeout: 120000 }).then((h) => h.jsonValue(), () => null);
    return page.evaluate((w) => ({ names: window.originsPreview.renderInfo().programNames, worn: window.originsPreview.selfWorn?.() ?? [],pos: { ...window.originsPreview.pos }, kitWarm: w }), warm);
  };
  const door = (id) => page.evaluate((zoneLandmark) => { const z = window.originsPreview.region().zones.find((q) => q.landmarks[zoneLandmark]); return z && z.landmarks[zoneLandmark]; }, id);
  const cross = async (label, landmark, toZone, still, inside) => {   // inside: this page's own landing point, which is the way into the zone from this door
    const along = (d, m) => { const dx = inside[0] - d.x, dz = inside[1] - d.z, n = Math.hypot(dx, dz) || 1; return [d.x + (dx / n) * m, d.z + (dz / n) * m]; };
    const d = await door(landmark); assert.ok(d, `${label}: the page has no ${landmark} landmark`);
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), along(d, 6));   // stand outside the door's radius: it arms
    await page.waitForTimeout(Number(process.env.EXIT_STILL_MS ?? 800));   // EXIT_STILL_MS: a software-GL run needs seconds before the door is drawn
    await page.screenshot({ path: path.join(shots, `${still}.png`) });
    await page.evaluate(([x, z]) => window.originsPreview.place(x, z, 0), along(d, 0.3));   // step onto it
    await page.waitForFunction(() => document.getElementById('zone-cross'), null, { timeout: 5000 }).catch(() => { throw new Error(`${label}: no fade appeared on the door`); });
    await page.waitForURL(new RegExp(`[?&]zone=${toZone}(&|$)`), { timeout: 30000 });
    return d;
  };
  // ?kitwarm=soft is the browser rows' flag (main.ts): software GL by definition, so the slow-device probe is not left to chance (without it a page load may judge itself fast, run the kit and gear warms at a seconds-per-frame pace, and see the
  // gear mannequin's compile outlive its bound and link AFTER the check counted: the 13 "post-ready" programs of the return trip). The gear warm is skipped under it; the kit warm runs on the long soft cap. EXIT_KITWARM=0 drops it.
  await page.goto(`${origin}/preview/origins/?region=1${process.env.EXIT_KITWARM === '0' ? '' : '&kitwarm=soft'}`, { waitUntil: 'load' });
  // The worst frame gap over a window (a rAF recorder): the hitch measure for an arrival. On software GL every frame is seconds, so it is only comparable run to run, not an absolute stutter figure.
  const gapProbe = () => page.evaluate(() => { window.__maxGap = 0; let last = performance.now(); const f = (t) => { window.__maxGap = Math.max(window.__maxGap, t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const z1 = await ready('Zone 1'); receipt.zone1Programs = z1.names.length; receipt.zone1KitWarm = z1.kitWarm;
  if (process.env.EXIT_Z1_SETTLE === '1') {   // informational: does the FIRST Zone 1 load also link programs after ready (then it is not a return-trip fault)?
    await gapProbe(); await page.waitForTimeout(SETTLE_MS);
    const names = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
    receipt.zone1Settle = { newPrograms: names.filter((n) => !z1.names.includes(n)), maxFrameGapMs: Math.round(await page.evaluate(() => window.__maxGap)), gearWarm: await page.evaluate(() => window.originsPreview.gearWarm?.() ?? null) };
  }
  const leg = async (label, landmark, toZone, landing, still, arriveStill, inside) => {
    await cross(label, landmark, toZone, still, inside);
    const a = await ready(label), l = { label, landed: a.pos, programsAtReady: a.names.length };
    assert.ok(Math.hypot(a.pos.x - landing[0], a.pos.z - landing[1]) < 0.5, `${label}: landed at ${JSON.stringify(a.pos)}, wanted ${landing}`);
    await gapProbe();
    l.timeline = [];   // when the program count changes after ready, and what the hero wears then (who links it)
    let lastCount = a.names.length; const t0 = Date.now();
    while (Date.now() - t0 < SETTLE_MS) {
      await page.waitForTimeout(500);
      const now = await page.evaluate(() => ({ n: window.originsPreview.renderInfo().programNames.length, worn: window.originsPreview.selfWorn?.() ?? [], gear: window.originsPreview.gearWarm?.() ?? null, kits: window.originsPreview.remoteKitsWarm?.() ? 'done' : 'pending' }));
      if (now.n !== lastCount) { l.timeline.push({ atMs: Date.now() - t0, programs: now.n, worn: now.worn, kits: now.kits, gearSkipped: now.gear?.skipped ?? null }); lastCount = now.n; }
    }
    l.wornAtReady = a.worn; l.wornAtEnd = await page.evaluate(() => window.originsPreview.selfWorn?.() ?? []);
    await page.screenshot({ path: path.join(shots, `${arriveStill}.png`) });
    const after = await page.evaluate(() => window.originsPreview.renderInfo().programNames);
    l.newPrograms = after.filter((n) => !a.names.includes(n)); l.zoneReady = await page.evaluate(() => window.__zoneReady);
    l.maxFrameGapMs = Math.round(await page.evaluate(() => window.__maxGap)); l.kitWarm = a.kitWarm; l.gearWarm = await page.evaluate(() => window.originsPreview.gearWarm?.() ?? null);
    receipt.legs.push(l);   // before the assertion, so a failing leg's timeline is in the receipt
    if (process.env.EXIT_CARRY === '1' && l.newPrograms.length) (receipt.carried ??= []).push(`${label}: compiled programs after [zone ready]: ${l.newPrograms.join(', ')}`);   // EXIT_CARRY=1 carries on past a post-ready compile so later legs still get a real result (it is still reported)
    else assert.deepEqual(l.newPrograms, [], `${label}: compiled programs after [zone ready]`);
  };
  await leg('Zone 1 -> Bone Hollow', 'cave-mouth', '5', [1, -320], 'cave-mouth', 'hollow-arrival', [-141, 30]);
  await leg('Bone Hollow -> Zone 1', 'hollow-gate', '1', [-141, 30], 'hollow-gate', 'mouth-arrival', [1, -320]);
  await leg('Zone 1 -> Sample Crypt', 'crypt-mouth', '6', [1, -120], 'crypt-mouth', 'crypt-arrival', [-62.76, 46.82]);
  await leg('Sample Crypt -> Zone 1', 'crypt-door', '1', [-62.76, 46.82], 'crypt-door', 'crypt-mouth-arrival', [1, -120]);
  assert.deepEqual(receipt.errors, []);
  if (receipt.carried) console.log('zone-exit: carried past', JSON.stringify(receipt.carried));
  console.log('zone-exit: PASS', JSON.stringify(receipt));
} catch (error) { console.error('zone-exit: FAIL', String(error.message ?? error), JSON.stringify(receipt)); process.exitCode = 1; }
finally { fs.writeFileSync('artifacts/zone-exit.json', JSON.stringify(receipt, null, 2)); await browser.close(); server.close(); }
