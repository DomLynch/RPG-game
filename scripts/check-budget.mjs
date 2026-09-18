import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
// What a phone downloads for one duel is the shell plus the hero and ONE opponent (scene.ts loads exactly those two GLBs), so that is
// what the budget gates: the shell with its worst hero + opponent pair. The whole of dist/ is the host's storage, not the player's
// wait, and gets a looser ceiling so the roster can grow without the gate being raised every fighter (5 → 12 → 16 MB was that pattern).
const PER_FIGHT = 10_000_000, TOTAL = 32_000_000;   // gzip bytes; per fight 2026-09-16: shell 1.3 + hero 3.35 + Veteran 3.71 = 8.4 MB.
// 9 → 10 MB owner-authorized 2026-09-17 (finishers & gore milestone, GAME_SPEC.md); 11 MB needs further owner sign-off.
async function files(path) {
  const out = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...await files(`${path}/${entry.name}`));
    else { const bytes = await readFile(`${path}/${entry.name}`); out.push({ name: entry.name, raw: bytes.length, gzip: gzipSync(bytes).length }); }
  }
  return out;
}
const all = await files('dist'), glb = f => /\.glb$/.test(f.name), sum = (list, k) => list.reduce((n, f) => n + f[k], 0);
const shell = sum(all.filter(f => !glb(f)), 'gzip'), hero = all.find(f => /^warrior-/.test(f.name)), opponents = all.filter(f => glb(f) && f !== hero);
if (!hero || !opponents.length) throw new Error(`dist has no hero + opponent GLBs (${all.filter(glb).map(f => f.name).join(', ') || 'none'})`);
const worst = opponents.reduce((a, b) => (b.gzip > a.gzip ? b : a)), fight = shell + hero.gzip + worst.gzip, total = sum(all, 'gzip');
if (fight >= PER_FIGHT) throw new Error(`A duel exceeds ${PER_FIGHT / 1e6} MB gzip: shell ${shell} + hero ${hero.gzip} + ${worst.name} ${worst.gzip} = ${fight}`);
if (total >= TOTAL) throw new Error(`dist exceeds ${TOTAL / 1e6} MB gzip: ${total}`);
console.log(`Per fight (shell ${shell} + hero ${hero.gzip} + worst opponent ${worst.name} ${worst.gzip}): ${fight} bytes gzip of ${PER_FIGHT}; all of dist: ${sum(all, 'raw')} raw, ${total} gzip of ${TOTAL}. Budget PASS.`);
