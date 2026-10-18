/* global console */
// Live audit of the 50 designed spell effects on the published sandbox preview (run on the VPS, never the Mac):
//   scp this file + fx-pairs.json ([{fx, spell, level}...], one spell per effect: node sandbox/spell-fx-audit.mjs lists them) to /root/shots, then
//   for i in 0 1 2 3; do (nice node fx-audit.mjs $i 4 > fxall-$i.txt 2>&1 &); done      (4 shards in parallel, ~45 s per effect)
// It loads ?debug=1&spell=<id>, starts a fight, pins the foe 1.0 m away, presses SPELL 1 until a cast starts, then counts the drawable pieces of the PLAYER's effect group ("special actor 0")
// that are visible at once. OK = drawn at some sample, NOTHING = never drawn in the window.
// CAVEAT (2026-10-16): headless swiftshader runs only ~30 game ticks a second, and a magic cast is a 120-tick windup, so the sample window must be at least ~8 s (done below);
// the first run used 2.8 s and read NOTHING for effects that only draw late in the cast. A NOTHING after this window is a real gap; a few effects are dark-ink and subtle by design (blackfurrow).
import { chromium } from '/root/frankendom-worktrees/sandbox/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
const [, , si = '0', sc = '1'] = process.argv;
const pairs = JSON.parse(readFileSync('/root/shots/fx-pairs.json', 'utf8')).filter((_, i) => i % +sc === +si);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const { fx, spell, level } of pairs) {
  const p = await b.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)));
  let line = `${fx.padEnd(13)} L${level} ${spell.padEnd(18)}`;
  try {
    await p.goto(`https://frankendom.com/preview/sandbox/?debug=1&spell=${spell}&staff=trident`, { waitUntil: 'load' }); await p.waitForTimeout(18000);
    await p.getByRole('button', { name: 'Fight', exact: true }).first().click({ force: true }); await p.waitForTimeout(10000);
    const pin = () => p.evaluate(() => { const f = globalThis.__sandboxMatch.practice.duel.fighters; const dx = f[1].body.x - f[0].body.x, dz = f[1].body.z - f[0].body.z, n = Math.hypot(dx, dz) || 1; f[1].body.x = f[0].body.x + (dx / n) * 1.0; f[1].body.z = f[0].body.z + (dz / n) * 1.0; });
    const shown = () => p.evaluate(() => { let sc = globalThis.__view.arena.group; while (sc.parent) sc = sc.parent; let best = 0, built = 0; sc.traverse((o) => { if (o.name === 'special actor 0') { o.traverse((c) => { if (c.isMesh || c.isSprite || c.isPoints || c.isLine) { built++; let v = c, hid = false; while (v && v !== o) { if (!v.visible) hid = true; v = v.parent; } if (!hid) best++; } }); } }); return [best, built]; });
    let started = false;
    for (let t = 0; t < 8 && !started; t++) { await pin(); await p.waitForTimeout(350); await p.locator('#skill-button').click({ force: true, delay: 60 }); await p.waitForTimeout(250); started = await p.evaluate(() => !!globalThis.__sandboxMatch.practice.duel.fighters[0].special); }
    let max = 0, built = 0; for (let i = 0; i < 32; i++) { await p.waitForTimeout(300); const [s, bt] = await shown(); max = Math.max(max, s); built = Math.max(built, bt); }   // ~9.6 s
    line += ` cast=${started} built=${built} drawnAtOnce=${max} ${max > 0 ? 'OK' : 'NOTHING'} ${errs.length ? 'ERR ' + errs[0] : ''}`;
  } catch (e) { line += ` FAILED ${String(e).slice(0, 80)}`; }
  console.log(line); await p.close();
}
await b.close();
