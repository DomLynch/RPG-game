// The within-job table for `scripts/gpu-run/crowd-fps.sh ab <base>`: head (a) and base (b) measured alternately on the same host, 0 / 16 / 40 players walking at 4x CPU.
// Usage: node scripts/crowd-ab-table.mjs <dir with a1 b1 a2 b2> <head label> <base label> <job id> <out.md>
// Reports mean frame ms, p95 and the calibration per case, and the crowd's cost per figure ((mean at N minus mean at 0) / N) per pass and tree: mean frame ms, never median fps (Strategy 2026-10-17).
import fs from 'node:fs'; import path from 'node:path';
const [dir, head, base, job, out] = process.argv.slice(2);
const read = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, name, 'receipt.json'), 'utf8')).results; } catch { return null; } };
const at = (rs, n) => rs?.find((c) => c.n === n && c.mode === 'walk');
let md = `4x CPU crowd cost, **${head}** (a) against **${base}** (b), alternating a1 b1 a2 b2 in ONE T4 job (${job}), 0 / 16 / 40 players walking. Mean frame ms (p95 ms) [calibration ms]; a regression row, not the gate (the gate is the iPhone check by Dom).\n\n| pass | tree | 0 players | 16 players | 40 players | ms per figure at 16 | ms per figure at 40 |\n|---|---|---|---|---|---|---|\n`;
const per = { a: [], b: [] };
for (const pass of [1, 2]) for (const t of ['a', 'b']) {
  const rs = read(`${t}${pass}`), c0 = at(rs, 0), c16 = at(rs, 16), c40 = at(rs, 40);
  const cell = (c) => (c ? `${c.meanMs} (p95 ${c.p95Ms}) [${c.calibMs}]` : 'missing');
  const p16 = c0 && c16 ? +((c16.meanMs - c0.meanMs) / 16).toFixed(2) : null, p40 = c0 && c40 ? +((c40.meanMs - c0.meanMs) / 40).toFixed(2) : null;
  if (p16 !== null) per[t].push(p16); if (p40 !== null) per[t].push(p40);
  md += `| ${pass} | ${t === 'a' ? head : base} | ${cell(c0)} | ${cell(c16)} | ${cell(c40)} | ${p16 ?? '-'} | ${p40 ?? '-'} |\n`;
}
const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null);
md += `\nMean cost per figure (all passes, 16 and 40): ${head} ${mean(per.a) ?? '-'} ms, ${base} ${mean(per.b) ?? '-'} ms; delta ${mean(per.a) !== null && mean(per.b) !== null ? +(mean(per.a) - mean(per.b)).toFixed(2) : '-'} ms per figure (negative = ${head} is cheaper).\n`;
fs.writeFileSync(out, md); console.log(md);
