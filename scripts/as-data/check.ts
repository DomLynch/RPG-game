// The as-data checker (Lead's measuring stick, 2026-10-12): how much content is still named in code. Report-only, not a gate.
//   node scripts/as-data/check.mjs [--root <dir>] [--json]        (npm run check:as-data; no --root = src AND origins, the whole denominator)
// (a) COMPARES: === / !== / case against a string literal that is an opponent, weapon, skill, special or finisher id.
// (b) UNIONS: a closed TypeScript union of content ids.
// (c) MAPS: an object-literal pair keyed by a content id whose value is a string or an array of strings (a label, colour, blurb or part list kept in code); one site per pair,
//     held to a ratchet like rule (e) (map-baseline.json, per file and id key).
// Runs ast-grep through npx at a pinned version (no global install); the rule files beside this script are templates the runner fills with today's id lists.
// Excluded: src/fight/catalogue-data.ts (the data itself) and src/assets. A site is listed as file:line [kind/category] text.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadAllow, type Allow, type TunableAllow, type Verb } from './load-allow.ts';

export const AST_GREP = '@ast-grep/cli@0.45.3';   // pinned: the rules below were written against its output
const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const REPO = arg('--repo') ?? join(HERE, '..', '..');   // --repo: the tree whose id lists are read (a test points it at a fixture)
const CATEGORIES = ['opponent', 'weapon', 'skill', 'special', 'finisher'] as const;   // when a literal is several, the first wins
type Category = (typeof CATEGORIES)[number];

const roots = arg('--root') ? [arg('--root')!] : ['src', 'origins'];
const allowFile = arg('--allow') ?? join(HERE, 'allow');   // a directory of per-root files (allow/<root>.json, one lane's rows PRs touch only its own root) or one file
const allowData = loadAllow(allowFile);
// Rule (e)'s ratchet (clamp.yml): { file: { literal: count } } for the inline Math.max/min numbers that were there when the rule landed. More of a literal in a file than this is NEW (red under
// --gate); fewer means the baseline is stale and must come down in the same PR (exit 3, like a stale allow entry), so it only ever shrinks. --write-clamp-baseline rewrites it, and refuses
// to while anything is new: it lowers the backlog, it never blesses a new site.
// Rule (c) has the same ratchet (map-baseline.json, { file: { id key: count } }, --write-map-baseline): the string-array maps (CLASS_SPECIALS and the per-opponent part lists) were
// invisible until the rule widened on 2026-10-15, so they landed as a known backlog, triaged by owner into rows; a new map is red under --gate.
const baseFile = (name: string) => arg(`--${name}-baseline`) ?? join(REPO, 'scripts', 'as-data', `${name}-baseline.json`);   // the tree under check's own baseline (a --repo fixture has none: nothing is baselined there)
type Tally = Record<string, Record<string, number>>;
const readBase = (f: string): Tally => (existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Tally) : {});
const tunableAllow: TunableAllow[] = allowData.tunables ?? [];
const today = arg('--today') ?? new Date().toISOString().slice(0, 10);
const dayNo = (d: string) => Math.floor(Date.parse(`${d}T00:00:00Z`) / 86_400_000);
for (const a of tunableAllow) {
  const bad = (m: string) => { console.error(`as-data: allow tunables entry ${a.file} ${a.name} ${m}`); process.exit(2); };
  if (a.kind !== 'exempt' && a.kind !== 'debt') bad('needs a kind: "exempt" (stays in code by design) or "debt" (owed as a row)');
  if (!a.reason?.trim() || a.reason.trim().length < 12) bad('needs a real reason (12+ characters)');
  if (a.kind === 'debt' && (!a.owner?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(a.sunset ?? '') || Number.isNaN(Date.parse(a.sunset!)))) bad('is debt: it needs an owner and a sunset date (YYYY-MM-DD)');
}
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
function run(template: string, extraGlobs: string[] = []) {
  const rule = join(dir, template);
  writeFileSync(rule, readFileSync(join(HERE, template), 'utf8').replaceAll('__IDS__', all.join('|')));
  const r = spawnSync('npx', ['--yes', '-p', AST_GREP, 'ast-grep', 'scan', '-r', rule, '--json=compact', '--globs', '!**/catalogue-data.ts', '--globs', '!src/assets/**', ...extraGlobs.flatMap((g) => ['--globs', g]), ...roots], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 && !r.stdout) throw Error(`ast-grep failed (${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout || '[]') as { text: string; file: string; range: { start: { line: number } } }[];
}
try {
  const sites = [
    ...run('compare.yml').map((m) => ({ kind: 'compare', category: categoryOf(m.text.slice(1, -1)) ?? 'unknown', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text })),
    ...run('tunable.yml').map((m) => ({ kind: 'tunable', category: 'tunable', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text })),
    ...run('map.yml').map((m) => ({ kind: 'map', category: categoryOf(/^['"]?([\w-]+)/.exec(m.text)![1]!) ?? 'unknown', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, ' ').slice(0, 80) })),
    ...run('union.yml').map((m) => ({ kind: 'union', category: 'union', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, ' ').slice(0, 80) })),
    ...run('rows.yml', ['!**/*.test.ts', '!**/fixtures.ts', '!src/**']).map((m) => ({ kind: 'row', category: 'content-row', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, ' ').slice(0, 80) })),
    ...run('consts.yml').map((m) => ({ kind: 'row', category: 'content-const', file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, ' ').slice(0, 80) })),
  ].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const isTunable = (s: { kind: string; category: string }) => s.kind === 'tunable' || s.category === 'content-const';   // the numeric-const rule and the named-constant rule share one allow-list
  const tunableEntry = (s: { file: string; text: string }) => tunableAllow.find((a) => a.file === s.file && new RegExp(`^${a.name}\\b`).test(s.text));
  const allowedTunables = sites.filter((s) => isTunable(s) && tunableEntry(s)).filter((s, i, all) => all.findIndex((o) => o.file === s.file && o.line === s.line && o.text === s.text) === i).map((s) => ({ ...s, reason: tunableEntry(s)!.reason }));   // one const that both rules see is listed once
  const inRoots = (f: string) => roots.some((r) => f === r || f.startsWith(`${r}/`));   // a --root run only judges the entries under its roots
  const staleTunables = tunableAllow.filter((a) => inRoots(a.file) && !allowedTunables.some((s) => s.file === a.file && new RegExp(`^${a.name}\\b`).test(s.text)));
  for (let i = sites.length - 1; i >= 0; i--) if (isTunable(sites[i]!) && tunableEntry(sites[i]!)) sites.splice(i, 1);
  const entryFor = (s: { file: string; text: string }) => allow.find((a) => a.file === s.file && `'${a.literal}'` === s.text);
  const allowed = sites.filter((s) => s.kind === 'compare' && entryFor(s)).map((s) => ({ ...s, reason: entryFor(s)!.reason }));
  const stale = allow.filter((a) => !allowed.some((s) => s.file === a.file && s.text === `'${a.literal}'`));
  for (let i = sites.length - 1; i >= 0; i--) if (sites[i]!.kind === 'compare' && entryFor(sites[i]!)) sites.splice(i, 1);   // allowed sites are listed apart and never counted
  const debts = tunableAllow.filter((a) => a.kind === 'debt' && inRoots(a.file));
  const overdue = debts.filter((a) => dayNo(a.sunset!) < dayNo(today)), soon = debts.filter((a) => dayNo(a.sunset!) >= dayNo(today) && dayNo(a.sunset!) - dayNo(today) <= 14);
  const verbLine = (v: Verb) => { const at = read(v.file).split('\n').findIndex((l) => new RegExp(`\\bconst ${v.name}\\b`).test(l)); return at < 0 ? 0 : at + 1; };
  const verbSites = verbs.map((v) => ({ ...v, line: verbLine(v) })), staleVerbs = verbSites.filter((v) => !v.line);
  type Site = { file: string; line: number; text: string };
  const underRoot = (f: string) => roots.some((r) => { const R = resolve(REPO, r), F = resolve(REPO, f); return F === R || F.startsWith(`${R}/`); });   // baseline keys are repo-relative; a --root may be absolute
  // One ratchet per rule: per file and literal, the occurrences past the baseline's count are new (a second 0.5 where one was is new); a baseline above the tree is stale.
  function ratchet(name: string, found: Site[], key: (s: Site) => string) {
    const file = baseFile(name), base = readBase(file), tally: Tally = {};
    for (const c of found) (tally[c.file] ??= {})[key(c)] = (tally[c.file]![key(c)] ?? 0) + 1;
    let fresh = found.filter((c) => { const seen = found.filter((o) => o.file === c.file && key(o) === key(c)); return seen.indexOf(c) >= (base[c.file]?.[key(c)] ?? 0); });
    let lowered = Object.entries(base).filter(([f]) => underRoot(f)).flatMap(([f, lits]) => Object.entries(lits).filter(([lit, n]) => (tally[f]?.[lit] ?? 0) < n).map(([lit, n]) => ({ file: f, literal: lit, baseline: n, now: tally[f]?.[lit] ?? 0 })));
    if (process.argv.includes(`--write-${name}-baseline`)) {
      if (fresh.length && existsSync(file)) fail(`not writing ${relative(REPO, file)}: ${fresh.length} ${name} site(s) are new (${fresh.slice(0, 3).map((c) => `${c.file}:${c.line} ${key(c)}`).join(', ')}); the baseline only shrinks`);
      writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(tally).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`);
      console.log(`as-data: wrote ${relative(REPO, file)} (${found.length} ${name} sites in ${Object.keys(tally).length} files)`);
      lowered = []; fresh = [];   // the file now matches the tree
    }
    return { fresh, lowered };
  }
  const bySite = (a: Site, b: Site) => a.file.localeCompare(b.file) || a.line - b.line;
  const clamps = run('clamp.yml').map((m) => ({ file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text: m.text.replace(/\s+/g, '') })).sort(bySite);
  const { fresh: newClamps, lowered } = ratchet('clamp', clamps, (c) => c.text);
  const maps = sites.filter((s) => s.kind === 'map');
  const mapKey = (s: Site) => /^['"]?([\w-]+)/.exec(s.text)![1]!;
  const { fresh: newMaps, lowered: loweredMaps } = ratchet('map', maps, mapKey);
  const count = (kind: string, cat?: string) => sites.filter((s) => s.kind === kind && (cat === undefined || s.category === cat)).length;
  const summary = { compares: count('compare'), byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, count('compare', c)])), unions: count('union'), rows: count('row'), tunables: count('tunable'), maps: count('map'), newMaps: newMaps.length, clamps: clamps.length, newClamps: newClamps.length };
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...summary, sites, allowed, stale, verbs: verbSites.filter((v) => v.line), staleVerbs, allowedTunables, staleTunables, overdue, soon, clampSites: clamps, newClampSites: newClamps, loweredClamps: lowered, newMapSites: newMaps, loweredMaps }));
  else {
    for (const s of sites) console.log(`${s.file}:${s.line} [${s.kind}/${s.category}] ${s.text}${s.kind === 'map' && newMaps.includes(s) ? '  NEW: this text belongs in the id\'s data row' : ''}`);
    for (const s of allowedTunables) console.log(`allowed-tunable ${s.file}:${s.line} ${s.text}  (${s.reason})`);
    for (const a of overdue) console.log(`OVERDUE debt ${a.file} ${a.name}: sunset ${a.sunset} (${a.owner}) has passed, move the number to a row or move the date with a reason`);
    for (const a of soon) console.log(`sunset soon ${a.file} ${a.name}: ${a.sunset} (${a.owner})`);
    for (const a of staleTunables) console.log(`STALE tunable entry ${a.file} ${a.name}: no such site any more, delete it (${a.reason})`);
    for (const s of allowed) console.log(`allowed ${s.file}:${s.line} ${s.text}  (${s.reason})`);
    for (const v of verbSites.filter((x) => x.line)) console.log(`verb ${v.file}:${v.line} ${v.name}  (dispatch ${v.dispatch}; sunset ${v.sunset ?? 'none'})`);
    for (const v of staleVerbs) console.log(`STALE verb ${v.file} ${v.name}: no such declaration any more, delete it (${v.dispatch})`);
    for (const a of stale) console.log(`STALE allow entry ${a.file} ${a.literal}: no such site any more, delete it (${a.reason})`);
    for (const c of newClamps) console.log(`NEW inline clamp ${c.file}:${c.line} ${c.text}: a number in Math.max/min is a tuning in code; make it a row (or a named exempt) instead`);
    for (const l of lowered) console.log(`STALE clamp baseline ${l.file} ${l.literal}: ${l.baseline} -> ${l.now}; lower it in the same PR (node scripts/as-data/check.ts --write-clamp-baseline)`);
    for (const l of loweredMaps) console.log(`STALE map baseline ${l.file} ${l.literal}: ${l.baseline} -> ${l.now}; lower it in the same PR (node scripts/as-data/check.ts --write-map-baseline)`);
    console.log(`as-data: compares ${summary.compares} (${CATEGORIES.map((c) => `${c} ${summary.byCategory[c]}`).join(', ')}), closed unions ${summary.unions}, content rows in code ${summary.rows}, tunables ${summary.tunables}, label maps ${summary.maps} (new ${summary.newMaps}; the rest are the known backlog in map-baseline.json), inline clamps ${summary.clamps} (new ${summary.newClamps}; the rest are the known backlog in clamp-baseline.json)`);
  }
  if (stale.length || staleVerbs.length || staleTunables.length || lowered.length || loweredMaps.length) process.exitCode = 3;   // a rotted allow-list or a clamp baseline above the tree is a list-integrity failure, not a count
  else if (process.argv.includes('--gate') && (summary.compares || summary.unions || summary.rows || summary.tunables || overdue.length || newClamps.length || newMaps.length)) process.exitCode = 1;   // --gate (CI): any new compare, closed union, content row, tunable, label map or inline clamp literal in code, or a debt past its sunset, is red
} finally { rmSync(dir, { recursive: true, force: true }); }
