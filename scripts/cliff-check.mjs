#!/usr/bin/env node
// Cliff check (COMBAT-001): every level 1–46 for the six wardens whose reaction crosses the cut windups, two bots, n fights per cell.
// Prints the worst adjacent-level win drop per row and the win% at the anchors (6 / 18 / 46). Bar: worst drop <= 25 pts.
//   node scripts/cliff-check.mjs [--n=40] [--opponents=veteran,...] [--bots=blocker,skilled] [--json=out.json]
import console from 'node:console';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { BOTS, fight } from './ladder-sweep.mjs';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const n = Number(arg('n', 40));
const ids = arg('opponents', 'veteran,executioner,dwarf,knight,pitborn,shieldmaiden').split(',');
const bots = arg('bots', 'blocker,skilled').split(',');
const out = {};
for (const id of ids) for (const b of bots) {
  const curve = [];
  for (let level = 1; level <= 46; level++) { let w = 0; for (let k = 1; k <= n; k++) if (fight(BOTS[b], id, level, k * 104729).won) w++; curve.push(Math.round((100 * w) / n)); }
  let worst = 0, at = 0;
  for (let l = 1; l < 46; l++) { const d = curve[l - 1] - curve[l]; if (d > worst) { worst = d; at = l + 1; } }
  out[`${id} ${b}`] = { curve, worst, at };
  console.log(`${`${id} ${b}`.padEnd(22)} worst ${String(worst).padStart(3)} at L${String(at).padEnd(3)} anchors L6 ${curve[5]} L18 ${curve[17]} L46 ${curve[45]}  ${worst > 25 ? 'FAIL' : 'ok'}`);
}
const json = arg('json', ''); if (json) writeFileSync(json, JSON.stringify(out));
