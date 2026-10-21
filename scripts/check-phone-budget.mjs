// The phone-tier asset budget gate (docs/specs/characters/phone-budgets.md; Lead's order 2026-10-21, "wired like check:as-data").
//   node scripts/check-phone-budget.mjs [--gate] [--root <dir>] [--write-allow]        (npm run check:phone-budget)
// Every shipped GLB under a class's `match` (src/fight/phone-budgets.json) is held to that class's ceilings. A file over a ceiling must be listed in
// scripts/phone-budget/allow.json with the value it stands at and the PR that fixes it; the list only shrinks:
//   - a breach that is not listed, or that is worse than its entry, is NEW: red;
//   - an entry whose file now passes (or no longer exists) is STALE: red until it is removed, so nobody keeps a debt they paid.
// Without --gate it only reports. --write-allow rewrites the allow-list from today's breaches (once, then edit `fix` by hand).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glbStats } from './glb-budget-stats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const ROOT = arg('--root') ?? path.join(HERE, '..'), GATE = process.argv.includes('--gate'), WRITE = process.argv.includes('--write-allow');
const budgets = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/fight/phone-budgets.json'), 'utf8'));
const allowPath = path.join(ROOT, 'scripts/phone-budget/allow.json');
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, 'utf8')).entries : [];
const classes = budgets.classes.map((c) => ({ ...c, re: new RegExp(c.match) }));

function* glbs(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) { if (!['node_modules', '.git', 'dist'].includes(e.name)) yield* glbs(rel); } else if (e.name.endsWith('.glb')) yield rel;
  }
}
const METRICS = ['tris', 'skinnedVerts', 'joints', 'draws', 'textureSide', 'gzKb'];
const valueOf = (s, metric) => metric === 'textureSide' ? Math.max(0, ...s.textures.map((t) => Math.max(t.w, t.h))) : s[metric];

const breaches = new Map();   // file -> { class, over: { metric: value } }
let checked = 0;
for (const dir of ['public', 'src/assets']) {
  if (!fs.existsSync(path.join(ROOT, dir))) continue;
  for (const file of glbs(dir)) {
    const cls = classes.find((c) => c.re.test(file)); if (!cls) continue;
    if (cls.id === 'ranked-creature' && !file.endsWith('-phone.glb') && fs.existsSync(path.join(ROOT, file.replace(/\.glb$/, '-phone.glb')))) continue;   // a look with a phone LOD ships its full file for the desktop tier only (a device fetches one tier's file, rank-look.ts PHONE_LOOKS)
    const s = glbStats(path.join(ROOT, file)); if (s.error) continue;
    checked++;
    const over = {};
    for (const m of METRICS) { const v = valueOf(s, m); if (v > cls[m]) over[m] = v; }
    if (cls.png === false && s.textures.some((t) => t.fmt === 'png')) over.png = s.textures.filter((t) => t.fmt === 'png').reduce((n, t) => n + Math.round((t.bytes ?? 0) / 1024), 0);   // KB of PNG
    if (Object.keys(over).length) breaches.set(file, { class: cls.id, over });
  }
}

if (WRITE) {
  const entries = [...breaches].sort(([a], [b]) => a.localeCompare(b)).map(([file, b]) => ({ file, class: b.class, over: b.over, fix: classes.find((c) => c.id === b.class).fix ?? 'TODO name the PR that fixes this file' }));
  fs.mkdirSync(path.dirname(allowPath), { recursive: true });
  fs.writeFileSync(allowPath, JSON.stringify({ note: 'Phone-budget debts (scripts/check-phone-budget.mjs): today\'s value per breached metric and the PR that fixes it. Only shrinks: an entry whose file passes now is stale and must go; a worse value is red.', entries }, null, 1) + '\n');
  console.log(`wrote ${entries.length} entries to ${path.relative(ROOT, allowPath)}`); process.exit(0);
}

const problems = [], listed = new Map(allow.map((e) => [e.file, e]));
for (const [file, b] of breaches) {
  const e = listed.get(file);
  if (!e) { problems.push(`NEW  ${file} [${b.class}] over ${JSON.stringify(b.over)}: fix the asset, or add an allow entry naming the PR that fixes it`); continue; }
  for (const [m, v] of Object.entries(b.over)) { if (e.over[m] === undefined) problems.push(`NEW  ${file} [${b.class}] now also over on ${m} = ${v}`); else if (v > e.over[m]) problems.push(`WORSE ${file} ${m} ${e.over[m]} -> ${v} (the allow entry is the ceiling)`); }
  for (const m of Object.keys(e.over)) if (b.over[m] === undefined) problems.push(`STALE ${file}: ${m} is within budget now, lower the allow entry (${e.fix})`);
}
for (const e of allow) if (!breaches.has(e.file)) problems.push(`STALE ${e.file}: passes the budget now (or is gone), remove its allow entry (${e.fix})`);
for (const e of allow) if (!e.fix || /^TODO/.test(e.fix)) problems.push(`NOFIX ${e.file}: an allow entry must name the PR that fixes it`);

console.log(`phone budget: ${checked} GLBs checked in ${classes.length} classes, ${breaches.size} over budget (${allow.length} allowed), ${problems.length} problem(s)`);
for (const p of problems) console.log('  ' + p);
if (GATE && problems.length) process.exit(1);
