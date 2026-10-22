// Prints the paired table of the lights A/B: for each pair k and cell (orient x CPU throttle), the fight and walk p95 / median frame time of arm A (all lit) and arm B (?torchlights=4),
// the point-light counts that prove the arms, and B minus A per pair. A claim needs the sign of B-A to hold across pairs and to beat the A-vs-A spread; this script only prints the numbers.
//   node scripts/lights-ab-pairs.mjs <dir with p<k>A / p<k>B folders>
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const read = (folder, file) => { try { return JSON.parse(fs.readFileSync(path.join(dir, folder, file), 'utf8')); } catch { return null; } };
const pairs = fs.readdirSync(dir).flatMap((f) => /^p(\d+)A$/.exec(f)?.[1] ?? []).map(Number).sort((a, b) => a - b);
const cells = new Set(); for (const k of pairs) for (const f of fs.readdirSync(path.join(dir, `p${k}A`))) if (/^local-.*\.json$/.test(f)) cells.add(f);
const rows = [];
for (const cell of [...cells].sort()) for (const phase of ['fight', 'walk']) for (const k of pairs) {
  const a = read(`p${k}A`, cell), b = read(`p${k}B`, cell); if (!a || !b) continue;
  const fa = a.phases?.[phase]?.frames, fb = b.phases?.[phase]?.frames; if (!fa || !fb) continue;
  rows.push({ cell: cell.replace('.json', ''), phase, pair: k, lightsA: a.pointLights, lightsB: b.pointLights, medA: fa.medianMs, medB: fb.medianMs, p95A: fa.p95Ms, p95B: fb.p95Ms, dP95: +(fb.p95Ms - fa.p95Ms).toFixed(1), dMed: +(fb.medianMs - fa.medianMs).toFixed(1), gl: a.env?.gl?.slice(0, 40) });
}
console.table(rows);
const by = {}; for (const r of rows) (by[`${r.cell} ${r.phase}`] ||= []).push(r.dP95);
for (const [k, v] of Object.entries(by)) console.log(`LIGHTS-AB ${k}: B-A p95 per pair ${JSON.stringify(v)} (negative = fewer lights faster)`);
