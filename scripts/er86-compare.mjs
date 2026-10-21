// Compares two scripts/er86-ab.mjs outputs (old timings, new timings). Prints, per weapon: the mean player win share before and after (over every rung, level and strategy except the perfect parry), the largest single-pairing share change,
// the pairings that move by more than the tolerance (share +/- 0.06), the weapon rank by that mean (ranks that move by more than 2), and the swing whiff rates (player and warden light and thrust) before and after.
//   node scripts/er86-compare.mjs out-old.json out-new.json [--tol 0.06]
/* global process, console */
import fs from 'node:fs';

const [oldPath, newPath] = process.argv.slice(2), tolI = process.argv.indexOf('--tol'), TOL = tolI > 0 ? Number(process.argv[tolI + 1]) : 0.06;
const A = JSON.parse(fs.readFileSync(oldPath)), B = JSON.parse(fs.readFileSync(newPath));
const key = (r) => `${r.weapon}|${r.rung}|${r.level}|${r.strategy}`, share = (r, n) => r.wins / n;
const bMap = new Map(B.fair.map((r) => [key(r), r]));
const per = {};
for (const a of A.fair) {
  if (a.strategy === 'perfect parry') continue;
  const b = bMap.get(key(a)); if (!b) continue;
  const w = (per[a.weapon] ??= { n: 0, old: 0, new: 0, worst: 0, moved: [], oldTaken: 0, newTaken: 0 });
  w.n++; w.old += share(a, A.seeds); w.new += share(b, B.seeds); w.oldTaken += a.taken; w.newTaken += b.taken;
  const d = share(b, B.seeds) - share(a, A.seeds);
  if (Math.abs(d) > Math.abs(w.worst)) w.worst = d;
  if (Math.abs(d) > TOL) w.moved.push(`${a.rung} ${a.level} ${a.strategy} ${a.wins}->${b.wins}/${A.seeds}`);
}
const rank = (field) => Object.entries(per).sort((x, y) => y[1][field] / y[1].n - x[1][field] / x[1].n).map(([w]) => w);
const rOld = rank('old'), rNew = rank('new');
console.log(`tolerance: share +/- ${TOL}, rank +/- 2 (seeds ${A.seeds})`);
console.log('weapon      mean share old -> new   worst pairing   rank old -> new   pairings over tolerance');
for (const [w, v] of Object.entries(per)) {
  const ro = rOld.indexOf(w) + 1, rn = rNew.indexOf(w) + 1, flag = Math.abs(ro - rn) > 2 ? ' RANK' : '';
  console.log(`${w.padEnd(10)}  ${(v.old / v.n).toFixed(3)} -> ${(v.new / v.n).toFixed(3)}       ${v.worst >= 0 ? '+' : ''}${v.worst.toFixed(3)}        ${ro} -> ${rn}${flag}      ${v.moved.length}`);
}
for (const [w, v] of Object.entries(per)) if (v.moved.length) console.log(`  ${w}: ${v.moved.slice(0, 12).join('; ')}${v.moved.length > 12 ? ` ... (+${v.moved.length - 12})` : ''}`);
const sum = (rows, f) => rows.reduce((a, r) => a + r[f], 0), whiffs = {};
for (const [name, R] of [['old', A], ['new', B]]) for (const r of R.whiff) { const k = `${r.weapon}|${r.strategy}`, w = (whiffs[k] ??= { old: null, new: null }); w[name] = r; }
const byWeapon = {};
for (const [name, R] of [['old', A], ['new', B]]) for (const w of new Set(R.whiff.map((r) => r.weapon))) {
  const rows = R.whiff.filter((r) => r.weapon === w), o = (byWeapon[w] ??= {});
  o[name] = { player: sum(rows, 'playerMissed') / Math.max(1, sum(rows, 'playerStarts')), warden: sum(rows, 'wardenMissed') / Math.max(1, sum(rows, 'wardenStarts')), starts: sum(rows, 'playerStarts') };
}
console.log('\nwhiff rate (swings that found nothing / swings started; light and thrust): player old -> new | warden old -> new');
for (const [w, o] of Object.entries(byWeapon)) console.log(`${w.padEnd(10)}  ${(o.old.player * 100).toFixed(1)}% -> ${(o.new.player * 100).toFixed(1)}%   |   ${(o.old.warden * 100).toFixed(1)}% -> ${(o.new.warden * 100).toFixed(1)}%   (player swings ${o.old.starts} -> ${o.new.starts})`);
