// The as-data checker (Lead's measuring stick, 2026-10-12): how much content is still named in code. Report-only, not a gate.
//   node scripts/as-data/check.mjs [--root <dir>] [--json]        (npm run check:as-data; no --root = src AND origins, the whole denominator)
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
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const REPO = arg('--repo') ?? join(HERE, '..', '..');   // --repo: the tree whose id lists are read (a test points it at a fixture)
const CATEGORIES = ['opponent', 'weapon', 'skill', 'special', 'finisher'] as const;   // when a literal is several, the first wins
type Category = (typeof CATEGORIES)[number];

const roots = arg('--root') ? [arg('--root')!] : ['src', 'origins'];
const allowFile = arg('--allow') ?? join(HERE, 'allow.json');
type Allow = { file: string; literal: string; reason: string };
// A VERB is a closed list kept in code on purpose (Strategy's verb rulings): named with the function that dispatches on it and the day it goes (sunset null = it stays). Listed apart, never counted; a verb whose declaration is gone is stale.
type Verb = { file: string; name: string; dispatch: string; sunset: string | null };
const allowData = JSON.parse(readFileSync(allowFile, 'utf8')) as { allow: Allow[]; verbs?: Verb[] };
const allow: Allow[] = allowData.allow, verbs: Verb[] = allowData.verbs ?? [];
const read = (f: string) => (existsSync(join(REPO, f)) ? readFileSync(join(REPO, f), 'utf8') : '');
const quoted = (text: string) => [...text.matchAll(/'([A-Za-z][\w-]*)'/g)].map((m) => m[1]!);
const unionOf = (file: string, type: string) => { const m = new RegExp(`export type ${type}\\s*=([^;]*);`).exec(read(file)); return m ? quoted(m[1]!) : []; };
const rowIds = (file: string, key: string) => { try { return ((JSON.parse(read(file)) as Record<string, { id: string }[]>)[key] ?? []).map((r) => r.id); } catch { return []; } };
// A measuring stick must never read a broken tree as progress: a failed import or an empty id list stops the run (exit 2) and names what is missing.
function fail(message: string): never { console.error(`as-data: ${message}`); process.exit(2); }
async function ids(): Promise<Record<Category, string[]>> {
  const imp = async (f: string) => { try { return (await import(pathToFileURL(join(REPO, f)).href)) as Record<string, any>; } catch (e) { fail(`cannot import ${f}: ${(e as Error).message.split('\n')[0]}`); } };
  const roster = await imp('src/roster.ts'), fin = await imp('src/fight/finishers.ts');
  const specials = (() => { try { return (JSON.parse(read('src/fight/special-set-defs.json')) as { sets: { specials: string[] }[] }).sets.flatMap((r) => r.specials); } catch { return []; } })();
  return {
    opponent: Object.keys(roster.ROSTER ?? {}),
    weapon: rowIds('src/fight/weapon-defs.json', 'weapons').concat(unionOf('src/fight/moves.ts', 'WeaponId')),
    skill: rowIds('src/fight/skill-defs.json', 'skills').concat(unionOf('src/fight/moves.ts', 'SkillId')),
    special: specials,
    finisher: (fin.FINISHERS?.rows?.map((r: { id: string }) => r.id) ?? Object.keys(fin.FINISHER_POSE ?? {})),
  };
}

const sets = await ids();
const categoryOf = (id: string): Category | undefined => CATEGORIES.find((c) => sets[c].includes(id));
const all = [...new Set(CATEGORIES.flatMap((c) => sets[c]))].filter((id) => /^[\w-]+$/.test(id)).sort();
for (const c of CATEGORIES) if (!sets[c].length) fail(`the ${c} id list is empty (a broken import or a moved table?): refusing to report, a silent 0 reads as progress`);
const dir = mkdtempSync(join(tmpdir(), 'as-data-'));
function run(template: string) {
  const rule = join(dir, template);
  writeFileSync(rule, readFileSync(join(HERE, template), 'utf8').replaceAll('__IDS__', all.join('|')));
  const r = spawnSync('npx', ['--yes', '-p', AST_GREP, 'ast-grep', 'scan', '-r', rule, '--json=compact', '--globs', '!**/catalogue-data.ts', '--globs', '!src/assets/**', ...roots], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 && !r.stdout) throw Error(`ast-grep failed (${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout || '[]') as { text: string; file: string; range: { start: { line: number } } }[];
}
try {
  const sites = [
    ...run('compare.yml').map((m) => ({ kind: 'compare', category: categoryOf(m.text.slice(1, -1)) ?? 'unknown', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text })),
    ...run('union.yml').map((m) => ({ kind: 'union', category: 'union', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, ' ').slice(0, 80) })),
  ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const entryFor = (s: { file: string; text: string }) => allow.find((a) => a.file === s.file && `'${a.literal}'` === s.text);
  const allowed = sites.filter((s) => s.kind === 'compare' && entryFor(s)).map((s) => ({ ...s, reason: entryFor(s)!.reason }));
  const stale = allow.filter((a) => !allowed.some((s) => s.file === a.file && s.text === `'${a.literal}'`));
  for (let i = sites.length - 1; i >= 0; i--) if (sites[i]!.kind === 'compare' && entryFor(sites[i]!)) sites.splice(i, 1);   // allowed sites are listed apart and never counted
  const verbLine = (v: Verb) => { const at = read(v.file).split('\n').findIndex((l) => new RegExp(`\\bconst ${v.name}\\b`).test(l)); return at < 0 ? 0 : at + 1; };
  const verbSites = verbs.map((v) => ({ ...v, line: verbLine(v) })), staleVerbs = verbSites.filter((v) => !v.line);
  const count = (kind: string, cat?: string) => sites.filter((s) => s.kind === kind && (cat === undefined || s.category === cat)).length;
  const summary = { compares: count('compare'), byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, count('compare', c)])), unions: count('union') };
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...summary, sites, allowed, stale, verbs: verbSites.filter((v) => v.line), staleVerbs }));
  else {
    for (const s of sites) console.log(`${s.file}:${s.line} [${s.kind}/${s.category}] ${s.text}`);
    for (const s of allowed) console.log(`allowed ${s.file}:${s.line} ${s.text}  (${s.reason})`);
    for (const v of verbSites.filter((x) => x.line)) console.log(`verb ${v.file}:${v.line} ${v.name}  (dispatch ${v.dispatch}; sunset ${v.sunset ?? 'none'})`);
    for (const v of staleVerbs) console.log(`STALE verb ${v.file} ${v.name}: no such declaration any more, delete it (${v.dispatch})`);
    for (const a of stale) console.log(`STALE allow entry ${a.file} ${a.literal}: no such site any more, delete it (${a.reason})`);
    console.log(`as-data: compares ${summary.compares} (${CATEGORIES.map((c) => `${c} ${summary.byCategory[c]}`).join(', ')}), closed unions ${summary.unions}`);
  }
  if (stale.length || staleVerbs.length) process.exitCode = 3;   // a rotted allow-list is a list-integrity failure, not a count
} finally { rmSync(dir, { recursive: true, force: true }); }
