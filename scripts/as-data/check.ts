// The as-data checker (Lead's measuring stick, 2026-10-12): how much content is still named in code. Report-only, not a gate.
//   node scripts/as-data/check.mjs [--root <dir>] [--json]        (npm run check:as-data; no --root = src AND origins, the whole denominator)
// (a) COMPARES: === / !== / case against a string literal that is an opponent, weapon, skill, special or finisher id.
// (b) UNIONS: a closed TypeScript union of content ids.
// (c) MAPS: an object-literal pair keyed by a content id whose value is a string or an array of strings (a label, colour, blurb or part list kept in code); one site per pair,
//     held to a ratchet like rule (e) (map-baseline.json, per file and id key).
// Runs ast-grep through npx at a pinned version (no global install); the rule files beside this script are templates the runner fills with today's id lists.
// (f) CONST EXPRESSIONS, (g) OBJECT CONSTS and (h) INLINE NUMBERS (hard-coding audit 2026-10-17, gaps 1, 3, 2): an UPPER const whose value is arithmetic with a number, an UPPER const object with any number past 0/1 that (d) does not
//     already list, and a number past 0/1 in game logic (scoped to inline-number-scope.json), each held to its own ratchet (const-expr-, const-object-, inline-number-baseline.json) started at today's count.
// (i) ID TABLES (audit gap 4): an array of 3+ object literals that each carry an `id`, kept in TypeScript outside the *-rows.ts readers (id-table.yml), a ratchet at today's count (id-table-baseline.json).
// (j) BRANCHES ON OTHER CONTENT IDS (audit gap 5): a compare / case against an id a data row declares that rule (a) does not know (branch-id.yml; the id list is read from the rows, minus the engine's own vocabularies, branch-id-vocab.json),
//     a ratchet at today's count (branch-id-baseline.json).
// Excluded: src/fight/catalogue-data.ts (the data itself) and src/assets. A site is listed as file:line [kind/category] text.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
// Rule (j) branch-id's id list: every `id` a data row (src + origins JSON, manifests and baselines aside) declares, minus rule (a)'s five categories, the engine's closed vocabularies (read from their
// sources, listed in branch-id-vocab.json) and the generic words there. `--branch-ids <file>` (a JSON array) replaces it: a test's fixture does not depend on the repo's rows.
function branchIds(): string[] {
  const given = arg('--branch-ids');
  if (given) return (JSON.parse(readFileSync(given, 'utf8')) as string[]).filter((id) => /^[\w-]+$/.test(id)).sort();
  const vocab = JSON.parse(readFileSync(join(HERE, 'branch-id-vocab.json'), 'utf8')) as { generic: string[]; engineEvents: string[]; engineTypes: { file: string; types: string[] }[] };
  const skip = new Set<string>([...all, ...vocab.generic, ...vocab.engineEvents,...vocab.engineTypes.flatMap((e) => e.types.flatMap((t) => unionOf(e.file, t)))]);
  const found = new Set<string>();
  const walk = (v: unknown) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'id' && typeof x === 'string' && x.length > 2 && /^[\w-]+$/.test(x) && !skip.has(x)) found.add(x); else walk(x); } };
  const files = (d: string): string[] => readdirSync(join(REPO, d), { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name.startsWith('.') ? [] : e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith('.json') && !/manifest|baseline/.test(e.name) ? [join(d, e.name)] : []));
  for (const root of ['src', 'origins']) if (existsSync(join(REPO, root))) for (const f of files(root)) { try { walk(JSON.parse(readFileSync(join(REPO, f), 'utf8'))); } catch { /* not a rows file */ } }
  return [...found].sort();
}
const branchIdList = branchIds();
const dir = mkdtempSync(join(tmpdir(), 'as-data-'));
function run(template: string, extraGlobs: string[] = []) {
  const rule = join(dir, template);
  writeFileSync(rule, readFileSync(join(HERE, template), 'utf8').replaceAll('__BRANCH_IDS__', branchIdList.join('|')).replaceAll('__IDS__', all.join('|')));
  const r = spawnSync('npx', ['--yes', '-p', AST_GREP, 'ast-grep', 'scan', '-r', rule, '--json=compact', '--globs', '!**/catalogue-data.ts', '--globs', '!src/assets/**', ...extraGlobs.flatMap((g) => ['--globs', g]), ...roots], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0 && !r.stdout) throw Error(`ast-grep failed (${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout || '[]') as { text: string; file: string; range: { start: { line: number; column: number }; end: { line: number; column: number } } }[];
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
  // Rules (f) const-expr, (g) const-object and (h) inline-number (hard-coding audit 2026-10-17, gaps 1, 3 and 2): each a ratchet like (e), started at today's count so it only goes down. (f) and (g) key on the const
  // name; (h) scans only inline-number-scope.json (the sim, the world sim, origins/server, presence and world) and keys on the literal.
  const siteOf = (m: { text: string; file: string; range: { start: { line: number } } }, text: string): Site => ({ file: relative(REPO, resolve(REPO, m.file)), line: m.range.start.line + 1, text });
  const constName = (s: Site) => /^[A-Z][A-Z0-9_]*/.exec(s.text)![0];
  // The one named exemption (Lead ruling 2026-10-18; Strategy's rule: every excluded class prints by name and count every run): a math constant with integer multipliers only (`Math.PI * 2`, `Math.PI / 2`,
  // `2 * Math.PI`) is geometry, not a tunable. A value with any other operand (`Math.PI * 2 * WIDTH_PX`) is still counted.
  const MATH_CONST_CLASS = 'math constant × integer (const)', MATH_CONST_VALUE = /^(\d+\s*[*/]\s*)?Math\.[A-Z0-9_]+(\s*[*/]\s*\d+)*$/;
  const constExprAll = run('const-expr.yml'), isMathConst = (m: { text: string }): boolean => MATH_CONST_VALUE.test(m.text.slice(m.text.indexOf('=') + 1).trim());
  const constExprExcluded = [{ class: MATH_CONST_CLASS, sites: constExprAll.filter(isMathConst).map((m) => siteOf(m, m.text.replace(/\s+/g, ' ').slice(0, 80))).sort(bySite) }].map((c) => ({ ...c, count: c.sites.length }));
  const constExprs = constExprAll.filter((m) => !isMathConst(m)).map((m) => siteOf(m, m.text.replace(/\s+/g, ' ').slice(0, 80))).sort(bySite);
  const { fresh: newConstExprs, lowered: loweredConstExprs } = ratchet('const-expr', constExprs, constName);
  const constObjects = run('const-object.yml').map((m) => siteOf(m, m.text.replace(/\s+/g, ' ').slice(0, 80))).sort(bySite);
  const { fresh: newConstObjects, lowered: loweredConstObjects } = ratchet('const-object', constObjects, constName);
  const scope = JSON.parse(readFileSync(arg('--inline-scope') ?? join(HERE, 'inline-number-scope.json'), 'utf8')) as { files: string[]; dirs: string[]; presentation?: { files: string[] } };
  // Strategy 2026-10-17 (rulings via Lead): a category may be left out of the count only if it is NOT gameplay, and every run names each category with its count. These are the only ones, each in its real context:
  // MATH (2 as a midpoint (a+b)/2, in Math.PI * 2, or as the * 2 - 1 remap of a unit draw (random/roll/draw/seedUnit/hash/k/t); x * 2 and 0.5 COUNT), TIME UNITS (1000, 3600, 86400, 60_000, 1_000_000 beside * or /; % COUNTS: a cadence is tuning), BITS (a literal beside
  // & | ^ << >>), HEX (a bit mask / hash salt beside a bit op or Math.imul, or a 6-digit colour in a view file) and -1 (compared with ===/!==/<... or beside indexOf/findIndex). A percent (100), a frame count (60),
  // a compare, a + / - or a % is never excluded: that is where a tuning hides.
  const arith = /^[*/](?![*/=])/, arithBefore = /(?<![*/])[*/]$/, bitsBefore = /(?<![&|])(?:[&|^]|<<|>>>?)$/, bitsAfter = /^(?:<<|>>>?|[&^]|\|)(?![&|=])/;
  const TIME_LITERALS = new Set(['1000', '3600', '86400', '86_400', '60_000', '1_000_000', '1000000']);
  // The percent/permille scale class (Strategy 2026-10-18, tightened by Lead): the scale is an operand of * or / IN CODE (not inside a string or template literal, not inside a console/log call) and the OTHER operand is a
  // roll expression: an identifier, member chain or call named like roll / draw / chance / rng / random (`draw() * 100`, `e.chancePct / 100`), or a parenthesised group holding one (`(100 - e.chance) / 100`). A roll word merely on the same line is not enough.
  const PERCENT_SCALE = new Set(['100', '10_000', '10000']);
  const ROLL_NAME = '\\w*(?:roll|draw|chance|rng|random)\\w*', ROLL_OPERAND = `(?:[\\w$]+\\.)*${ROLL_NAME}(?:\\([^()]*\\))?`, ROLL_GROUP = `\\([^()]*${ROLL_NAME}[^()]*\\)`;
  const rollBefore = new RegExp(`(?:${ROLL_OPERAND}|${ROLL_GROUP})\\s*[*/]$`, 'i'), rollAfter = new RegExp(`^[*/]\\s*(?:${ROLL_OPERAND}|${ROLL_GROUP})`, 'i');
  const insideStringOrLog = (before: string): boolean => {   // a quote left open before the literal (' " or `, with escapes) puts it in a string or template; a console/log call puts it in a message
    let open: string | null = null;
    for (let i = 0; i < before.length; i++) { const c = before[i]!; if (open) { if (c === '\\') i++; else if (c === open) open = null; } else if (c === '\'' || c === '"' || c === '`') open = c; }
    return open !== null || /\b(?:console\.\w+|logger?\.\w+|log\w*)\s*\(/.test(before);
  };
  const presentationFiles = new Set(scope.presentation?.files ?? []);
  const sourceLines = new Map<string, string[]>();
  const excludedCategory = (m: { text: string; file: string; range: { start: { line: number; column: number }; end: { line: number; column: number } } }): string | null => {
    const text = m.text.replace(/\s+/g, '');
    const path = resolve(REPO, m.file), line = (sourceLines.get(path) ?? sourceLines.set(path, readFileSync(path, 'utf8').split('\n')).get(path)!)[m.range.start.line] ?? '';
    const before = line.slice(0, m.range.start.column).trimEnd(), after = line.slice(m.range.end.column).trimStart();
    const bitOp = bitsBefore.test(before) || bitsAfter.test(after);
    if (/^0[xXbBoO]/.test(text)) {
      if (bitOp || /Math\.imul|>>>/.test(line)) return 'hex/binary: bit mask or hash salt';
      if (/^0[xX][0-9a-fA-F]{6}$/.test(text) && presentationFiles.has(relative(REPO, path))) return 'hex: colour in a view file';
      return null;
    }
    if (text === '-1') return /(?:===|!==|==|!=|<=|>=|<|>)$/.test(before) || /\b(?:indexOf|lastIndexOf|findIndex|findLastIndex)\b/.test(line) ? '-1 sentinel (compared, or beside indexOf/findIndex)' : null;
    if (bitOp) return 'bits (beside & | ^ << >>)';
    const beside = arithBefore.test(before) || arith.test(after);
    if (text === '2') {
      if (/\([^()]*\+[^()]*\)\s*\/$/.test(before)) return 'math: 2 as a midpoint (a+b)/2';
      if (/Math\.PI\s*\*$/.test(before) || (/^\*\s*Math\.PI/.test(after))) return 'math: Math.PI * 2';
      if (/\*$/.test(before) && /^-\s*1\b/.test(after) && /\b(?:Math\.random\(\)|(?:random|rand|rng|roll|draw|seedUnit|hash|unit|k|t|u)(?:\([^()]*\))?)\s*\*$/.test(before)) return 'math: the * 2 - 1 remap of a unit draw';   // level * 2 - 1 is a count, not a draw: it stays counted
      return null;
    }
    if (beside && TIME_LITERALS.has(text)) return 'time-unit conversion (1000, 3600, 86400, 60_000, 1_000_000 beside * or /)';
    // The one named scale class (Strategy 2026-10-18): 100 or 10_000 as the UNIT of a roll (`draw() * 100 < chance`, a percent chance read against a draw): see PERCENT_SCALE above. A compare (`< 100`), a + / - (`100 - tax`),
    // any other number (a 250 beside a roll), a percent in a log string or a template, and plain price, tax or share maths (no roll operand) stay counted: that is where a tuning hides.
    if (beside && PERCENT_SCALE.has(text) && !insideStringOrLog(before) && (rollBefore.test(before) || rollAfter.test(after))) return 'percent/permille scale on a roll (100, 10_000 as an operand of * or / beside a roll/draw/chance expression)';
    return null;
  };
  const excludedInline: Record<string, number> = {};
  const inlines = run('inline-number.yml', [...scope.files, ...scope.dirs]).flatMap((m) => { const cat = excludedCategory(m); if (cat) { excludedInline[cat] = (excludedInline[cat] ?? 0) + 1; return []; } return [siteOf(m, m.text.replace(/\s+/g, ''))]; }).sort(bySite);
  // GAMEPLAY (the gate, target 0 new) and NON-GAMEPLAY (tracked, not blocking): gameplay is the DEFAULT; presentation is the explicit file list in the scope file.
  const isPresentation = (f: string) => presentationFiles.has(f);
  const { fresh: newInlines, lowered: loweredInlines } = ratchet('inline-number', inlines, (s) => s.text);
  const gameplayInlines = inlines.filter((s) => !isPresentation(s.file)), presentationInlines = inlines.filter((s) => isPresentation(s.file));
  const newGameplayInlines = newInlines.filter((s) => !isPresentation(s.file)), newPresentationInlines = newInlines.filter((s) => isPresentation(s.file));
  // Rule (i) id-table (audit gap 4): an array of 3+ id-bearing object literals outside the *-rows.ts readers; keyed on the first row's id, one ratchet (id-table-baseline.json), started at today's count.
  const idAllow = allowData.idTables ?? [];
  for (const a of idAllow) if (!a.reason?.trim() || a.reason.trim().length < 12) fail(`allow idTables entry ${a.file} ${a.id} needs a real reason (12+ characters)`);
  const allIdTables = run('id-table.yml').map((m) => siteOf(m, /\bid['"]?\s*:\s*['"`]([^'"`]+)['"`]/.exec(m.text)?.[1] ?? m.text.replace(/\s+/g, ' ').slice(0, 40))).sort(bySite);
  const idExempt = (s: Site) => idAllow.find((a) => a.file === s.file && a.id === s.text);
  const idTables = allIdTables.filter((s) => !idExempt(s)), allowedIdTables = allIdTables.filter((s) => idExempt(s)).map((s) => ({ ...s, reason: idExempt(s)!.reason }));   // an exempt table is listed apart, never counted
  const staleIdAllow = idAllow.filter((a) => underRoot(a.file) && !allowedIdTables.some((s) => s.file === a.file && s.text === a.id));
  const { fresh: newIdTables, lowered: loweredIdTables } = ratchet('id-table', idTables, (s) => s.text);
  // Rule (j) branch-id (audit gap 5): a compare against a row id rule (a) does not know, a per-file, per-literal ratchet (branch-id-baseline.json).
  const branchAllow = allowData.branchIds ?? [];
  for (const a of branchAllow) if (!a.reason?.trim() || a.reason.trim().length < 12) fail(`allow branchIds entry ${a.file} ${a.literal} needs a real reason (12+ characters)`);
  const allBranchIds = run('branch-id.yml').map((m) => siteOf(m, m.text)).sort(bySite);
  const branchExempt = (s: Site) => branchAllow.find((a) => a.file === s.file && `'${a.literal}'` === s.text);
  const branchIdSites = allBranchIds.filter((s) => !branchExempt(s)), allowedBranchIds = allBranchIds.filter((s) => branchExempt(s)).map((s) => ({ ...s, reason: branchExempt(s)!.reason }));   // a named category branch or verb is listed apart, never counted
  const staleBranchAllow = branchAllow.filter((a) => underRoot(a.file) && !allowedBranchIds.some((s) => s.file === a.file && s.text === `'${a.literal}'`));
  const { fresh: newBranchIds, lowered: loweredBranchIds } = ratchet('branch-id', branchIdSites, (s) => s.text);
  const count = (kind: string, cat?: string) => sites.filter((s) => s.kind === kind && (cat === undefined || s.category === cat)).length;
  const summary = { compares: count('compare'), byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, count('compare', c)])), unions: count('union'), rows: count('row'), tunables: count('tunable'), maps: count('map'), newMaps: newMaps.length, clamps: clamps.length, newClamps: newClamps.length, constExprs: constExprs.length, newConstExprs: newConstExprs.length, constObjects: constObjects.length, newConstObjects: newConstObjects.length, inlineNumbers: inlines.length, newInlineNumbers: newInlines.length, idTables: idTables.length, newIdTables: newIdTables.length, branchIds: branchIdSites.length, newBranchIds: newBranchIds.length };
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ...summary, sites, allowed, stale, verbs: verbSites.filter((v) => v.line), staleVerbs, allowedTunables, staleTunables, overdue, soon, clampSites: clamps, newClampSites: newClamps, loweredClamps: lowered, newMapSites: newMaps, loweredMaps, constExprSites: constExprs, constExprExcluded,newConstExprSites: newConstExprs, loweredConstExprs, constObjectSites: constObjects, newConstObjectSites: newConstObjects, loweredConstObjects, inlineNumberSites: inlines, newInlineNumberSites: newInlines, inlineGameplay: gameplayInlines.length, inlineNonGameplay: presentationInlines.length, inlineExcluded: excludedInline, loweredInlineNumbers: loweredInlines, idTableSites: idTables, newIdTableSites: newIdTables, loweredIdTables, allowedIdTables, staleIdAllow, branchIdSites, newBranchIdSites: newBranchIds, loweredBranchIds, allowedBranchIds, staleBranchAllow }));
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
    for (const c of newConstExprs) console.log(`NEW const expression ${c.file}:${c.line} ${c.text}: a tunable written as arithmetic is content in code; make it a row (or a named exempt) instead`);
    for (const c of newConstObjects) console.log(`NEW object const ${c.file}:${c.line} ${c.text}: a table of numbers in code; make it rows (or a named exempt) instead`);
    for (const c of newGameplayInlines) console.log(`NEW inline number ${c.file}:${c.line} ${c.text}: a number in game logic is a tuning in code; make it a row (or a named exempt) instead`);
    for (const c of newPresentationInlines) console.log(`new (tracked, not blocking) presentation inline number ${c.file}:${c.line} ${c.text}`);
    console.log(`as-data inline numbers: GAMEPLAY ${gameplayInlines.length} (new ${newGameplayInlines.length}, the gate, target 0) | NON-GAMEPLAY ${presentationInlines.length} (new ${newPresentationInlines.length}, tracked, not blocking)`);
    for (const c of constExprExcluded) console.log(`as-data const expressions EXCLUDED (not counted, geometry not a tunable): ${c.class}: ${c.count}`);
    for (const [cat, n] of Object.entries(excludedInline).sort((a, b) => b[1] - a[1])) console.log(`as-data inline numbers EXCLUDED (not counted, not gameplay): ${cat}: ${n}`);
    for (const s of allowedBranchIds) console.log(`allowed-branch-id ${s.file}:${s.line} ${s.text}  (${s.reason})`);
    for (const a of staleBranchAllow) console.log(`STALE branchIds entry ${a.file} ${a.literal}: no such branch any more, delete it (${a.reason})`);
    for (const c of newBranchIds) console.log(`NEW branch on a content id ${c.file}:${c.line} ${c.text}: behaviour keyed on a row id is content in code; read it from the row's data (a field, a rule row) instead`);
    for (const s of allowedIdTables) console.log(`allowed-id-table ${s.file}:${s.line} ${s.text}  (${s.reason})`);
    for (const a of staleIdAllow) console.log(`STALE idTables entry ${a.file} ${a.id}: no such table any more, delete it (${a.reason})`);
    for (const c of newIdTables) console.log(`NEW id table ${c.file}:${c.line} ${c.text}: rows kept as an array literal in TypeScript; make them a JSON rows file with a manifest and a *-rows.ts reader instead`);
    for (const [name, list] of [['const-expr', loweredConstExprs], ['const-object', loweredConstObjects], ['inline-number', loweredInlines], ['id-table', loweredIdTables], ['branch-id', loweredBranchIds]] as const) for (const l of list) console.log(`STALE ${name} baseline ${l.file} ${l.literal}: ${l.baseline} -> ${l.now}; lower it in the same PR (node scripts/as-data/check.ts --write-${name}-baseline)`);
    for (const l of loweredMaps) console.log(`STALE map baseline ${l.file} ${l.literal}: ${l.baseline} -> ${l.now}; lower it in the same PR (node scripts/as-data/check.ts --write-map-baseline)`);
    console.log(`as-data: compares ${summary.compares} (${CATEGORIES.map((c) => `${c} ${summary.byCategory[c]}`).join(', ')}), closed unions ${summary.unions}, content rows in code ${summary.rows}, tunables ${summary.tunables}, label maps ${summary.maps} (new ${summary.newMaps}; the rest are the known backlog in map-baseline.json), inline clamps ${summary.clamps} (new ${summary.newClamps}; the rest are the known backlog in clamp-baseline.json), const expressions ${summary.constExprs} (new ${summary.newConstExprs}; const-expr-baseline.json), object consts ${summary.constObjects} (new ${summary.newConstObjects}; const-object-baseline.json), inline numbers in game logic ${summary.inlineNumbers} (new ${summary.newInlineNumbers}; inline-number-baseline.json), id tables in code ${summary.idTables} (new ${summary.newIdTables}; id-table-baseline.json), branches on other content ids ${summary.branchIds} (new ${summary.newBranchIds}; branch-id-baseline.json)`);
  }
  if (stale.length || staleVerbs.length || staleTunables.length || lowered.length || loweredMaps.length || loweredConstExprs.length || loweredConstObjects.length || loweredInlines.length || loweredIdTables.length || loweredBranchIds.length || staleIdAllow.length || staleBranchAllow.length) process.exitCode = 3;   // a rotted allow-list or a clamp baseline above the tree is a list-integrity failure, not a count
  else if (process.argv.includes('--gate') && (summary.compares || summary.unions || summary.rows || summary.tunables || overdue.length || newClamps.length || newMaps.length || newConstExprs.length || newConstObjects.length || newGameplayInlines.length || newIdTables.length || newBranchIds.length)) process.exitCode = 1;   // --gate (CI): any new compare, closed union, content row, tunable, label map or inline clamp literal in code, or a debt past its sunset, is red
} finally { rmSync(dir, { recursive: true, force: true }); }
