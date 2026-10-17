// The table for `scripts/gpu-run/crowd-fps.sh imp`: the impostor far tier against the full figures, one T4 job, 4x CPU, two passes.
// Usage: node scripts/crowd-imp-table.mjs <dir with imp1-* imp2-*> <sha label> <job id> <out.md>
// Mean frame ms (p95) and the calibration per case; the ADDED cost over the bare page in the same pass, and per figure. Mean frame ms, never median fps (Strategy 2026-10-17).
import fs from 'node:fs'; import path from 'node:path';
const [dir, sha, job, out] = process.argv.slice(2);
const read = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, name, 'receipt.json'), 'utf8')).results[0]; } catch { return null; } };
const cases = [['none', 'bare page', 0], ['i40', '40 impostors', 40], ['f40', '40 full figures', 40], ['i100', '100 impostors', 100]];
let md = `Far tier, **${sha}**, 4x CPU, ONE T4 job (${job}), two passes, players walking. Mean frame ms (p95 ms) [calibration ms] | added over the bare page in the same pass | per figure | drawn. A regression row, not the gate (the gate is the iPhone check by Dom). Target: the far tier's added cost at 40 under 10 ms.\n\n| pass | case | mean (p95) [calib] | added ms | ms per figure | drawn |\n|---|---|---|---|---|---|\n`;
const per = {};
for (const pass of [1, 2]) {
  const base = read(`imp${pass}-none`);
  for (const [key, label, n] of cases) {
    const c = read(`imp${pass}-${key}`);
    if (!c) { md += `| ${pass} | ${label} | missing | - | - | - |\n`; continue; }
    const added = base && key !== 'none' ? +(c.meanMs - base.meanMs).toFixed(2) : null, each = added !== null && n ? +(added / n).toFixed(3) : null, drawn = c.impostors?.drawn ?? c.drawn ?? 0;
    if (each !== null) (per[key] ??= []).push(each);
    md += `| ${pass} | ${label} | ${c.meanMs} (p95 ${c.p95Ms}) [${c.calibMs}] | ${added ?? '-'} | ${each ?? '-'} | ${drawn} |\n`;
  }
}
const mean = (xs) => (xs?.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);
md += `\nMean ms per figure over both passes: 40 impostors ${mean(per.i40) ?? '-'}, 100 impostors ${mean(per.i100) ?? '-'}, 40 full figures ${mean(per.f40) ?? '-'}.\n`;
fs.writeFileSync(out, md); console.log(md);
