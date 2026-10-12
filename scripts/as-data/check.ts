// The as-data checker (Lead's measuring stick, 2026-10-12): how much content is still named in code. Report-only, not a gate.
//   node scripts/as-data/check.mjs [--root <dir>] [--json]        (npm run check:as-data)
// (a) COMPARES: === / !== / case against a string literal that is an opponent, weapon, skill, special or finisher id.
// (b) UNIONS: a closed TypeScript union of content ids.
// Runs ast-grep through npx at a pinned version (no global install); the rule files beside this script are templates the runner fills with today's id lists.
// Excluded: src/fight/catalogue-data.ts (the data itself) and src/assets. A site is listed as file:line [kind/category] text.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const AST_GREP = '@ast-grep/cli@0.45.3';   // pinned: the rules below were written against its output
const HERE = dirname(fileURLToPath(import.meta.url)), REPO = join(HERE, '..', '..');
const CATEGORIES = ['opponent', 'weapon', 'skill', 'special', 'finisher'] as const;   // when a literal is several, the first wins
type Category = (typeof CATEGORIES)[number];

const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const root = arg('--root') ?? 'src';
const read = (f: string) => (existsSync(join(REPO, f)) ? readFileSync(join(REPO, f), 'utf8') : '');
const quoted = (text: string) => [...text.matchAll(/'([A-Za-z][\w-]*)'/g)].map((m) => m[1]!);
const unionOf = (file: string, type: string) => { const m = new RegExp(`export type ${type}\\s*=([^;]*);`).exec(read(file)); return m ? quoted(m[1]!) : []; };
const rowIds = (file: string, key: string) => { try { return ((JSON.parse(read(file)) as Record<string, { id: string }[]>)[key] ?? []).map((r) => r.id); } catch { return []; } };
async function ids(): Promise<Record<Category, string[]>> {
  const imp = async (f: string) => { try { return (await import(pathToFileURL(join(REPO, f)).href)) as Record<string, any>; } catch { return {}; } };
  const roster = await imp('src/roster.ts'), fin = await imp('src/fight/finishers.ts');
  const specials = /const SPECIAL_SETS = \{([\s\S]*?)\n\} as const/.exec(read('src/fight/moves.ts'));
  return {
    opponent: Object.keys(roster.ROSTER ?? {}),
    weapon: rowIds('src/fight/weapon-defs.json', 'weapons').concat(unionOf('src/fight/moves.ts', 'WeaponId')),
    skill: rowIds('src/fight/skill-defs.json', 'skills').concat(unionOf('src/fight/moves.ts', 'SkillId')),
    special: specials ? [...specials[1]!.matchAll(/\[([^\]]*)\]/g)].flatMap((m) => quoted(m[1]!)) : [],
    finisher: (fin.FINISHERS?.rows?.map((r: { id: string }) => r.id) ?? Object.keys(fin.FINISHER_POSE ?? {})),
  };
}

const sets = await ids();
const categoryOf = (id: string): Category | undefined => CATEGORIES.find((c) => sets[c].includes(id));
const all = [...new Set(CATEGORIES.flatMap((c) => sets[c]))].filter((id) => /^[\w-]+$/.test(id)).sort();
if (!all.length) { console.error('as-data: found no content ids to look for'); process.exit(2); }
const dir = mkdtempSync(join(tmpdir(), 'as-data-'));
function run(template: string) {
  const rule = join(dir, template);
  writeFileSync(rule, readFileSync(join(HERE, template), 'utf8').replaceAll('__IDS__', all.join('|')));
  const r = spawnSync('npx', ['--yes', '-p', AST_GREP, 'ast-grep', 'scan', '-r', rule, '--json=compact', '--globs', '!**/catalogue-data.ts', '--globs', '!src/assets/**', root], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 && !r.stdout) throw Error(`ast-grep failed (${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout || '[]') as { text: string; file: string; range: { start: { line: number } } }[];
}
try {
  const sites = [
    ...run('compare.yml').map((m) => ({ kind: 'compare', category: categoryOf(m.text.slice(1, -1)) ?? 'unknown', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text })),
    ...run('union.yml').map((m) => ({ kind: 'union', category: 'union', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, ' ').slice(0, 80) })),
  ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const count = (kind: string, cat?: string) => sites.filter((s) => s.kind === kind && (cat === undefined || s.category === cat)).length;
  const summary = { compares: count('compare'), byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, count('compare', c)])), unions: count('union') };
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...summary, sites }));
  else {
    for (const s of sites) console.log(`${s.file}:${s.line} [${s.kind}/${s.category}] ${s.text}`);
    console.log(`as-data: compares ${summary.compares} (${CATEGORIES.map((c) => `${c} ${summary.byCategory[c]}`).join(', ')}), closed unions ${summary.unions}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
