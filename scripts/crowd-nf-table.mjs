// The table for `scripts/gpu-run/crowd-fps.sh nearfar`: what a NEAR remote figure and a FAR one cost apart, one T4 job, 4x CPU, two passes.
// Usage: node scripts/crowd-nf-table.mjs <dir with nf1-* nf2-*> <sha label> <job id> <out.md>
import fs from 'node:fs'; import path from 'node:path';
const [dir, sha, job, out] = process.argv.slice(2);
const read = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, name, 'receipt.json'), 'utf8')).results[0]; } catch { return null; } };
let md = `Near and far figures apart, **${sha}**, 4x CPU, ONE T4 job (${job}), two passes, players walking. Mean frame ms (p95 ms) [calibration ms] | added over the empty zone in the same pass | per figure | drawn (LOD split) | programs added after ready. A regression row, not the gate (the gate is the iPhone check by Dom).\n\n| pass | case | mean (p95) [calib] | added ms | ms per figure | drawn | programs added |\n|---|---|---|---|---|---|---|\n`;
const per = { near: [], far: [] };
for (const pass of [1, 2]) {
  const base = read(`nf${pass}-none`);
  for (const [key, label] of [['none', 'empty zone'], ['near', '40 players 2-7 m ahead'], ['far', '40 players 10-16 m ahead']]) {
    const c = read(`nf${pass}-${key}`);
    if (!c) { md += `| ${pass} | ${label} | missing | - | - | - | - |\n`; continue; }
    const added = base && key !== 'none' ? +(c.meanMs - base.meanMs).toFixed(2) : null, each = added !== null && c.drawn ? +(added / c.drawn).toFixed(3) : null;
    if (each !== null) per[key].push(each);
    md += `| ${pass} | ${label} | ${c.meanMs} (p95 ${c.p95Ms}) [${c.calibMs}] | ${added ?? '-'} | ${each ?? '-'} | ${c.drawn} ${JSON.stringify(c.lods ?? {})} | ${c.programsAdded.length} |\n`;
  }
}
const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);
md += `\nMean ms per figure over both passes: near ${mean(per.near) ?? '-'}, far ${mean(per.far) ?? '-'}.\n`;
fs.writeFileSync(out, md); console.log(md);
