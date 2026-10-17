// The within-job table for `scripts/gpu-run/crowd-fps.sh ab <base>`: head (a) and base (b) measured alternately on the same host, 0 / 16 / 40 players walking at 4x CPU.
// Usage: node scripts/crowd-ab-table.mjs <dir with a1 b1 a2 b2> <head label> <base label> <job id> <out.md>
// Reports mean frame ms, p95 and the calibration per case, and the crowd's cost per figure ((mean at N minus mean at 0) / N) per pass and tree: mean frame ms, never median fps (Strategy 2026-10-17).
import fs from 'node:fs'; import path from 'node:path';
const [dir, head, base, job, out] = process.argv.slice(2);
const read = (name) => { try { return JSON.parse(fs.readFileSync(path.join(dir, name, 'receipt.json'), 'utf8')).results; } catch { return null; } };
const at = (rs, n) => rs?.find((c) => c.n === n && c.mode === 'walk');
let md = `4x CPU crowd cost, **${head}** (a) against **${base}** (b), alternating a1 b1 a2 b2 in ONE T4 job (${job}), 0 / 16 / 40 players walking. Mean frame ms (p95 ms) [calibration ms]; a regression row, not the gate (the gate is the iPhone check by Dom).\n\n| pass | tree | 0 players | 16 players | 40 players | ms per figure at 16 | ms per figure at 40 |\n|---|---|---|---|---|---|---|\n`;
const per = { a: [], b: [] }, add40 = { a: [], b: [] }, p95at40 = { a: [], b: [] };   // add40: the added mean ms at 40 players over the empty zone in the same pass; p95at40: the p95 frame ms at 40
for (const pass of [1, 2]) for (const t of ['a', 'b']) {
  const rs = read(`${t}${pass}`), c0 = at(rs, 0), c16 = at(rs, 16), c40 = at(rs, 40);
  const cell = (c) => (c ? `${c.meanMs} (p95 ${c.p95Ms}) [${c.calibMs}]` : 'missing');
  const p16 = c0 && c16 ? +((c16.meanMs - c0.meanMs) / 16).toFixed(2) : null, p40 = c0 && c40 ? +((c40.meanMs - c0.meanMs) / 40).toFixed(2) : null;
  if (p16 !== null) per[t].push(p16); if (p40 !== null) per[t].push(p40);
  if (c0 && c40) { add40[t].push(c40.meanMs - c0.meanMs); p95at40[t].push(c40.p95Ms); }
  md += `| ${pass} | ${t === 'a' ? head : base} | ${cell(c0)} | ${cell(c16)} | ${cell(c40)} | ${p16 ?? '-'} | ${p40 ?? '-'} |\n`;
}
const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null);
md += `\nMean cost per figure (all passes, 16 and 40): ${head} ${mean(per.a) ?? '-'} ms, ${base} ${mean(per.b) ?? '-'} ms; delta ${mean(per.a) !== null && mean(per.b) !== null ? +(mean(per.a) - mean(per.b)).toFixed(2) : '-'} ms per figure (negative = ${head} is cheaper).\n`;
const fmt = (xs) => (xs.length ? mean(xs) : '-');
md += `\n**Added ms at 40 players over the empty zone (mean over both passes; the target is <= 10 ms): ${head} ${fmt(add40.a)} ms (p95 at 40: ${fmt(p95at40.a)}), ${base} ${fmt(add40.b)} ms (p95 at 40: ${fmt(p95at40.b)}); delta ${add40.a.length && add40.b.length ? +(mean(add40.a) - mean(add40.b)).toFixed(2) : '-'} ms (negative = ${head} is cheaper).**\n`;
const progs = (t) => [1, 2].flatMap((p) => (read(`${t}${p}`) ?? []).map((c) => c.programsAdded ?? [])), names = (t) => [...new Set(progs(t).flat())];
md += `\nPrograms added after [zone ready] (all cases, both passes): ${head} ${progs('a').reduce((s, l) => s + l.length, 0)}${names('a').length ? ` (${names('a').join(', ')})` : ''}, ${base} ${progs('b').reduce((s, l) => s + l.length, 0)}${names('b').length ? ` (${names('b').join(', ')})` : ''}.\n`;
const kw = (t) => JSON.stringify((read(`${t}1`) ?? [])[0]?.kitWarm ?? 'not reported');
md += `Remote-kit warm (#2938: its programs link AFTER [zone ready] by design; the harness waits for it before the baseline, so they are not counted above): ${head} ${kw('a')}, ${base} ${kw('b')}.\n`;
fs.writeFileSync(out, md); console.log(md);
