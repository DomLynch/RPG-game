// The phone-tier asset budget gate (docs/specs/characters/phone-budgets.md; Lead's order 2026-10-21, "wired like check:as-data").
//   node scripts/check-phone-budget.mjs [--gate] [--root <dir>] [--write-allow]        (npm run check:phone-budget)
// Every shipped GLB under a class's `match` (src/fight/phone-budgets.json) is held to that class's ceilings. A file over a ceiling must be listed in
// scripts/phone-budget/allow.json, grouped by the PR that fixes it, with the asset's recorded figures; the list only shrinks:
//   - a breach that is not listed is NEW: red;
//   - an allowed asset whose figure GROWS past its recorded one (any metric, over budget or not) is WORSE: red;
//   - an entry whose file now passes a metric it was over on (or no longer exists) is STALE: red until it is lowered or removed;
//   - an entry in a group with no named fix is NOFIX: red.
// Without --gate it only reports (with the debt per fix PR). --write-allow rewrites the allow-list from today's breaches (then edit `fix` by hand).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glbStats } from './glb-budget-stats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const ROOT = arg('--root') ?? path.join(HERE, '..'), GATE = process.argv.includes('--gate'), WRITE = process.argv.includes('--write-allow');
const budgets = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/fight/phone-budgets.json'), 'utf8'));
const allowPath = path.join(ROOT, 'scripts/phone-budget/allow.json');
const groups = fs.existsSync(allowPath) ? (JSON.parse(fs.readFileSync(allowPath, 'utf8')).groups ?? []) : [];
const allow = groups.flatMap((g) => g.entries.map((e) => ({ ...e, fix: g.fix })));
const classes = budgets.classes.map((c) => ({ ...c, re: new RegExp(c.match) }));

function* glbs(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(e.name)) yield* glbs(rel); } else if (e.name.endsWith('.glb')) yield rel;
  }
}
const METRICS = ['tris', 'skinnedVerts', 'joints', 'draws', 'textureSide', 'gzKb'];
const figuresOf = (s) => ({ tris: s.tris, skinnedVerts: s.skinnedVerts, joints: s.joints, draws: s.draws, textureSide: Math.max(0, ...s.textures.map((t) => Math.max(t.w, t.h))), gzKb: s.gzKb, pngKb: s.textures.filter((t) => t.fmt === 'png').reduce((n, t) => n + Math.round((t.bytes ?? 0) / 1024), 0) });

const seen = new Map();   // file -> { class, figures, over }
let checked = 0;
for (const dir of ['public', 'src/assets']) {
  if (!fs.existsSync(path.join(ROOT, dir))) continue;
  for (const file of glbs(dir)) {
    const cls = classes.find((c) => c.re.test(file)); if (!cls) continue;
    if (cls.id === 'ranked-creature' && !file.endsWith('-phone.glb') && fs.existsSync(path.join(ROOT, file.replace(/\.glb$/, '-phone.glb')))) continue;   // a look with a phone LOD ships its full file for the desktop tier only (a device fetches one tier's file, rank-look.ts PHONE_LOOKS)
    const s = glbStats(path.join(ROOT, file)); if (s.error) continue;
    checked++;
    const figures = figuresOf(s), over = {};
    for (const m of METRICS) if (figures[m] > cls[m]) over[m] = figures[m];
    if (cls.png === false && figures.pngKb > 0) over.pngKb = figures.pngKb;
    seen.set(file, { class: cls.id, figures, over });
  }
}
const breaches = new Map([...seen].filter(([, b]) => Object.keys(b.over).length));

if (WRITE) {
  const byFix = new Map();
  for (const [file, b] of [...breaches].sort(([a], [c]) => a.localeCompare(c))) { const fix = classes.find((c) => c.id === b.class).fix ?? 'TODO name the PR that fixes this file'; if (!byFix.has(fix)) byFix.set(fix, []); byFix.get(fix).push({ file, class: b.class, over: b.over, figures: b.figures }); }
  fs.mkdirSync(path.dirname(allowPath), { recursive: true });
  fs.writeFileSync(allowPath, JSON.stringify({ note: 'Phone-budget debts (scripts/check-phone-budget.mjs), grouped by the PR that fixes them. Each entry records the asset\'s figures: red if any grows, red if a metric it was over on is within budget now (lower or remove the entry). Only shrinks.', groups: [...byFix].map(([fix, entries]) => ({ fix, count: entries.length, entries })) }, null, 1) + '\n');
  console.log(`wrote ${breaches.size} entries in ${byFix.size} groups to ${path.relative(ROOT, allowPath)}`); process.exit(0);
}

const problems = [], listed = new Map(allow.map((e) => [e.file, e]));
for (const [file, b] of breaches) {
  const e = listed.get(file);
  if (!e) { problems.push(`NEW  ${file} [${b.class}] over ${JSON.stringify(b.over)}: fix the asset, or add an allow entry in the group of the PR that fixes it`); continue; }
  for (const m of Object.keys(b.over)) if (e.over[m] === undefined) problems.push(`NEW  ${file} [${b.class}] now also over on ${m} = ${b.over[m]}`);
}
for (const e of allow) {
  const b = seen.get(e.file);
  if (!b) { problems.push(`STALE ${e.file}: gone or no longer in a class, remove its allow entry (${e.fix})`); continue; }
  for (const [m, v] of Object.entries(e.figures ?? {})) if ((b.figures[m] ?? 0) > v) problems.push(`WORSE ${e.file} ${m} ${v} -> ${b.figures[m]} (the allow entry's recorded figure is the ceiling)`);
  for (const m of Object.keys(e.over)) if (b.over[m] === undefined) problems.push(`STALE ${e.file}: ${m} is within budget now, lower the allow entry (${e.fix})`);
  if (!e.figures) problems.push(`NOFIGURES ${e.file}: an allow entry must record the asset's figures`);
}
for (const g of groups) if (!g.fix || /^TODO/.test(g.fix)) problems.push(`NOFIX group "${g.fix}": an allow group must name the PR that fixes it`);

console.log(`phone budget: ${checked} GLBs checked in ${classes.length} classes, ${breaches.size} over budget (${allow.length} allowed), ${problems.length} problem(s)`);
for (const g of groups) console.log(`  debt: ${String(g.entries.length).padStart(3)}  ${g.fix}`);
for (const p of problems) console.log('  ' + p);
if (GATE && problems.length) process.exit(1);
