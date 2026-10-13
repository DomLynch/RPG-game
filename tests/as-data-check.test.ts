// The as-data checker (scripts/as-data/check.ts, `npm run check:as-data`): report-only, so these tests pin what it SEES, on a fixture tree whose answer is known, not the live repo's
// count (which only goes down as content moves into data; the live numbers are in the PR that added it and in the checker's own output). A planted compare must raise the count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Site = { file: string; line: number; kind: string; category: string; text: string };
type Report = { compares: number; byCategory: Record<string, number>; unions: number; sites: Site[]; allowed: (Site & { reason: string })[]; stale: { file: string; literal: string }[]; verbs: { file: string; name: string; line: number; dispatch: string }[]; staleVerbs: { name: string }[] };
const run = (root: string, allow?: string) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', root, ...(allow ? ['--allow', allow] : [])], { encoding: 'utf8', maxBuffer: 64 << 20 });
const EMPTY = join(mkdtempSync(join(tmpdir(), 'as-data-empty-')), 'allow.json');   // a fixture tree has none of the repo's allowed sites: it gets an empty list, not the real one (whose entries would be stale there)
writeFileSync(EMPTY, '{"allow":[]}');
const check = (root: string, allow: string = EMPTY): Report => {
  const r = run(root, allow);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout) as Report;
};
const FIXTURE = [
  "export const a = (o: string) => o === 'veteran';",                 // opponent compare
  "export const b = (o: string) => 'goblin' !== o;",                  // opponent compare, literal on the left
  "export const c = (w: string) => { switch (w) { case 'trident': return 1; default: return 0; } };",   // weapon, case
  "export const d = (w: string) => w === 'plain-text-not-an-id';",   // not an id: ignored
  "export type U = 'veteran' | 'knight' | 'goblin';",                 // a closed union of ids
  "export type V = 'left' | 'right';",                                // a union with no id: ignored
].join('\n') + '\n';

test('the checker counts compares and closed unions of content ids, by category, and lists the sites', () => {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-fixture-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'sample.ts'), FIXTURE);
    const report = check(join(dir, 'src'));
    assert.equal(report.compares, 3);
    assert.deepEqual({ opponent: report.byCategory.opponent, weapon: report.byCategory.weapon }, { opponent: 2, weapon: 1 });
    assert.equal(report.unions, 1);
    assert.ok(report.sites.every((s) => s.file.endsWith('sample.ts') && s.line >= 1));
    // a planted compare goes red: one more site, one more opponent
    writeFileSync(join(dir, 'src', 'planted.ts'), "export const e = (o: string) => o === 'knight';\n");
    const planted = check(join(dir, 'src'));
    assert.equal(planted.compares, report.compares + 1);
    assert.equal(planted.byCategory.opponent, report.byCategory.opponent! + 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the live repo scan runs and reports every category (report-only: the numbers move down as content becomes data)', () => {
  const report = check('src');
  assert.ok(report.compares >= 1 && report.sites.length >= report.compares);
  for (const c of ['opponent', 'weapon', 'skill', 'special', 'finisher']) assert.ok(c in report.byCategory, c);
});

test('the allow-list: an allowed literal is listed apart and never counted, and an entry whose site is gone is stale and fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-allow-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'sample.ts'), FIXTURE);
    const site = relative(process.cwd(), join(dir, 'src', 'sample.ts'));   // the checker prints repo-relative paths
    const allowFile = join(dir, 'allow.json');
    writeFileSync(allowFile, JSON.stringify({ allow: [{ file: site, literal: 'veteran', reason: 'a test: not content' }] }));
    const report = check(join(dir, 'src'), allowFile);
    assert.equal(report.compares, 2, 'the allowed compare is not counted');
    assert.deepEqual(report.allowed.map((s) => [s.text, s.reason]), [["'veteran'", 'a test: not content']]);
    assert.deepEqual(report.stale, []);
    writeFileSync(allowFile, JSON.stringify({ allow: [{ file: site, literal: 'veteran', reason: 'x' }, { file: site, literal: 'knight', reason: 'no such site' }] }));
    const rotted = run(join(dir, 'src'), allowFile);
    assert.equal(rotted.status, 3, 'a stale entry fails the run');
    assert.deepEqual((JSON.parse(rotted.stdout) as Report).stale.map((a) => a.literal), ['knight']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the real allow-list has no stale entry or stale verb, and the four ratified verbs are listed with a dispatch', () => {
  const r = run('src');
  assert.equal(r.status, 0, `${r.stderr}${r.stdout.slice(0, 400)}`);
  const report = JSON.parse(r.stdout) as Report;
  assert.deepEqual(report.stale, []);
  assert.deepEqual(report.staleVerbs, []);
  assert.deepEqual(report.verbs.map((v) => [v.name, v.dispatch]), [['LOCAL_NAMESPACES', 'localId'], ['TOWN_NODES', 'building()'], ['ROW_KEYS', 'zoneFromRow'], ['GRIDS', 'sizeOf and the bank custody branches (move, take, trade at 219, 259, 280, 323, 495)']]);
  assert.ok(report.verbs.every((v) => v.line >= 1));
});

test('with no --root the checker scans src AND origins (shown on a fixture tree with one compare in each root); the real tree is done: 0 compares', () => {
  // The real tree: as-data is finished (every name-switch is a row or an allowed verb), so the count is pinned to 0 and a new compare anywhere fails here. It is a gate now, not a measure.
  const real = spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  assert.equal(real.status, 0, real.stderr);
  assert.equal((JSON.parse(real.stdout) as Report).compares, 0, 'a new content-name compare in src or origins');
  // The both-roots behaviour, on a tree that has the compares: one in src, one in origins.
  const repo = mkdtempSync(join(tmpdir(), 'as-data-roots-'));
  try {
    mkdirSync(join(repo, 'src', 'fight'), { recursive: true }); mkdirSync(join(repo, 'origins'), { recursive: true });
    writeFileSync(join(repo, 'src', 'roster.ts'), "export const ROSTER = { veteran: {}, goblin: {} };\n");
    writeFileSync(join(repo, 'src', 'fight', 'moves.ts'), "export type WeaponId = 'trident';\nexport type SkillId = 'jab';\nconst SPECIAL_SETS = {\n  ash: ['ashfall'],\n} as const;\n");
    writeFileSync(join(repo, 'src', 'fight', 'finishers.ts'), "export const FINISHERS = { rows: [{ id: 'beheading' }] };\n");
    writeFileSync(join(repo, 'src', 'a.ts'), "export const a = (o: string) => o === 'veteran';\n");
    writeFileSync(join(repo, 'origins', 'b.ts'), "export const b = (o: string) => o === 'goblin';\n");
    const go = (...extra: string[]) => JSON.parse(spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--allow', EMPTY, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout) as Report;
    const both = go(), srcOnly = go('--root', 'src'), originsOnly = go('--root', 'origins');
    assert.equal(both.compares, 2, 'no --root: src AND origins'); assert.deepEqual(both.sites.map((x) => x.file), ['origins/b.ts', 'src/a.ts']);
    assert.equal(srcOnly.compares, 1); assert.equal(originsOnly.compares, 1);
  } finally { rmSync(repo, { recursive: true, force: true }); }
  const dir = mkdtempSync(join(tmpdir(), 'as-data-verb-'));
  try {
    const allowFile = join(dir, 'allow.json');
    writeFileSync(allowFile, JSON.stringify({ allow: [], verbs: [{ file: 'src/roster.ts', name: 'NO_SUCH_LIST', dispatch: 'nothing', sunset: null }] }));
    const stale = run('src', allowFile);
    assert.equal(stale.status, 3);
    assert.deepEqual((JSON.parse(stale.stdout) as Report).staleVerbs.map((v) => v.name), ['NO_SUCH_LIST']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Fail closed: a measuring stick that reads a broken tree as "0 left" reads as progress. --repo points the id lists at a fixture tree.
const fixtureRepo = (roster: string) => {
  const repo = mkdtempSync(join(tmpdir(), 'as-data-repo-'));
  mkdirSync(join(repo, 'src', 'fight'), { recursive: true });
  writeFileSync(join(repo, 'src', 'roster.ts'), roster);
  writeFileSync(join(repo, 'src', 'fight', 'moves.ts'), "export type WeaponId = 'trident';\nexport type SkillId = 'jab';\nconst SPECIAL_SETS = {\n  ash: ['ashfall'],\n} as const;\n");
  writeFileSync(join(repo, 'src', 'fight', 'finishers.ts'), "export const FINISHERS = { rows: [{ id: 'beheading' }] };\n");
  return repo;
};
const runRepo = (repo: string) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--root', 'src', '--allow', EMPTY], { encoding: 'utf8', maxBuffer: 64 << 20 });

test('fail closed: a healthy fixture repo exits 0, and a roster whose import throws exits 2 naming the file, with no report', () => {
  const good = fixtureRepo("export const ROSTER = { veteran: {} };\n");
  const broken = fixtureRepo("import './no-such-module.ts';\nexport const ROSTER = { veteran: {} };\n");
  try {
    const ok = runRepo(good);
    assert.equal(ok.status, 0, ok.stderr);
    const bad = runRepo(broken);
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /cannot import src\/roster\.ts/);
    assert.equal(bad.stdout, '', 'no count is printed for a broken tree');
  } finally { rmSync(good, { recursive: true, force: true }); rmSync(broken, { recursive: true, force: true }); }
});

test('fail closed: an empty id list exits 2 naming the category', () => {
  const repo = fixtureRepo("export const ROSTER = {};\n");
  try {
    const r = runRepo(repo);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /the opponent id list is empty/);
    assert.equal(r.stdout, '');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('content rows built in code are counted: a record-kind literal in origins counts, in tests and fixtures it does not, and the real tree is at 0', () => {
  const real = spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  assert.equal(real.status, 0, real.stderr);
  assert.equal((JSON.parse(real.stdout) as { rows: number }).rows, 0, 'a foe, encounter, Bounty or rift record built in TypeScript: add it to origins/region1/progression.json');
  const repo = mkdtempSync(join(tmpdir(), 'as-data-rows-'));
  try {
    mkdirSync(join(repo, 'src', 'fight'), { recursive: true }); mkdirSync(join(repo, 'origins', 'x'), { recursive: true });
    writeFileSync(join(repo, 'src', 'roster.ts'), "export const ROSTER = { veteran: {}, goblin: {} };\n");
    writeFileSync(join(repo, 'src', 'fight', 'moves.ts'), "export type WeaponId = 'trident';\nexport type SkillId = 'jab';\nconst SPECIAL_SETS = {\n  ash: ['ashfall'],\n} as const;\n");
    writeFileSync(join(repo, 'src', 'fight', 'finishers.ts'), "export const FINISHERS = { rows: [{ id: 'beheading' }] };\n");
    writeFileSync(join(repo, 'origins', 'x', 'a.ts'), "export const a = { kind: 'bounty-definition', id: 'bounty:x' };\nexport const b = { kind: 'item-definition' };\n");
    writeFileSync(join(repo, 'origins', 'x', 'a.test.ts'), "export const t = { kind: 'bounty-definition' };\n");
    writeFileSync(join(repo, 'origins', 'x', 'fixtures.ts'), "export const f = { kind: 'rift-site' };\n");
    const out = JSON.parse(spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--allow', EMPTY], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout) as { rows: number; sites: { kind: string; file: string }[] };
    assert.equal(out.rows, 1);
    assert.deepEqual(out.sites.filter((x) => x.kind === 'row').map((x) => x.file), ['origins/x/a.ts']);
    const gated = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--allow', EMPTY, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 }).status;
    assert.equal(gated(), 0, 'without --gate a planted row only reports');
    assert.equal(gated('--gate'), 1, 'under --gate a planted row exits 1');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('a tuning number kept as a named constant in a moved file is counted; the moved feuds.ts has none', () => {
  const repo = mkdtempSync(join(tmpdir(), 'as-data-consts-'));
  try {
    mkdirSync(join(repo, 'src', 'fight'), { recursive: true }); mkdirSync(join(repo, 'origins', 'feuds'), { recursive: true }); mkdirSync(join(repo, 'origins', 'patrons'), { recursive: true }); mkdirSync(join(repo, 'origins', 'preview'), { recursive: true });
    writeFileSync(join(repo, 'origins', 'preview', 'play.ts'), "export const START_LEVEL = 16;\nexport const WORLD_TUNING = { reach: 3, far: 40 };\nexport const FROM_ROW = START.startLevel;\n");
    writeFileSync(join(repo, 'origins', 'patrons', 'patrons.ts'), "export const RULES = { switchBronze: 2000, wait: 28 * 86400 } as const;\nexport const CLEAN = { points: 0, at: 0 };\n");
    writeFileSync(join(repo, 'src', 'roster.ts'), "export const ROSTER = { veteran: {}, goblin: {} };\n");
    writeFileSync(join(repo, 'src', 'fight', 'moves.ts'), "export type WeaponId = 'trident';\nexport type SkillId = 'jab';\nconst SPECIAL_SETS = {\n  ash: ['ashfall'],\n} as const;\n");
    writeFileSync(join(repo, 'src', 'fight', 'finishers.ts'), "export const FINISHERS = { rows: [{ id: 'beheading' }] };\n");
    writeFileSync(join(repo, 'origins', 'feuds', 'feuds.ts'), "export const JAIL_S = 600;\nexport const NEG = -5;\nexport const FROM_ROW = R.jailS;\nconst local = 3;\nexport const fn = () => { const INNER = 4; return INNER; };\n");
    const out = JSON.parse(spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--allow', EMPTY], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout) as { rows: number; sites: { kind: string; text: string }[] };
    assert.equal(out.rows, 4, 'JAIL_S, NEG, the RULES object and a play.ts START_LEVEL count (WORLD_TUNING is its own slice); a constant read from a row, a lower-case local, a constant inside a function and a zero-valued CLEAN state do not');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('tunables: a top-level numeric const in a moved file is counted (each declarator), a local or a non-number is not, an allowed one is listed apart, a stale entry fails; the real tree is at 0', () => {
  const repo = fixtureRepo("export const ROSTER = { veteran: {} };\n");
  const FILE = 'src/fight/world.ts', allowFile = join(repo, 'allow.json');
  try {
    mkdirSync(join(repo, 'src', 'fight'), { recursive: true });
    writeFileSync(join(repo, FILE), "export const ENGAGE = 4, REACH = 6, NAME = 'x';\nconst TICK = 1 / 60;\nexport function f() { const LOCAL = 3; return LOCAL; }\nexport const NEG = -2;\n");
    writeFileSync(allowFile, '{"allow":[]}');
    const go = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--allow', allowFile, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const planted = JSON.parse(go().stdout) as Report & { tunables: number };
    assert.deepEqual(planted.sites.filter((s) => s.kind === 'tunable').map((s) => s.text), ['ENGAGE = 4', 'REACH = 6', 'NEG = -2'], 'two declarators in one const, a negative; not the string, the expression or the local');
    assert.equal(planted.tunables, 3);
    writeFileSync(allowFile, JSON.stringify({ allow: [], tunables: [{ file: FILE, name: 'ENGAGE', reason: 'a test: not a rule', owner: 'Test', sunset: '2099-01-01' }] }));
    const allowed = JSON.parse(go().stdout) as Report & { tunables: number; allowedTunables: { text: string; reason: string }[] };
    assert.equal(allowed.tunables, 2); assert.deepEqual(allowed.allowedTunables.map((s) => [s.text, s.reason]), [['ENGAGE = 4', 'a test: not a rule']]);
    writeFileSync(allowFile, JSON.stringify({ allow: [], tunables: [{ file: FILE, name: 'GONE', reason: 'no such site', owner: 'Test', sunset: '2099-01-01' }] }));
    assert.equal(go().status, 3, 'a stale tunable entry fails the run');
  } finally { rmSync(repo, { recursive: true, force: true }); }
  const real = spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  assert.equal(real.status, 0, real.stderr);
  assert.equal((JSON.parse(real.stdout) as { tunables: number }).tunables, 0, 'a numeric tunable back in src/fight/world.ts or world-combat.ts');
});

test('the tunable rule covers ALL of src/ and origins/ (tests and fixtures excluded): a NEW literal anywhere goes red under --gate; a keeper needs a reason, an owner and a sunset', () => {
  const repo = fixtureRepo("export const ROSTER = { veteran: {} };\n");
  const allowFile = join(repo, 'allow.json');
  try {
    mkdirSync(join(repo, 'src', 'deep', 'er'), { recursive: true }); mkdirSync(join(repo, 'origins', 'x'), { recursive: true });
    writeFileSync(join(repo, 'src', 'deep', 'er', 'brand-new.ts'), "export const NEW_RANGE = 12;\nexport const SHAPE: Record<string, number> = { a: 40 };\n");
    writeFileSync(join(repo, 'origins', 'x', 'thing.ts'), "export const NEW_TICK = 5;\n");
    writeFileSync(join(repo, 'src', 'deep', 'er', 'brand-new.test.ts'), "export const IN_A_TEST = 99;\n");
    writeFileSync(join(repo, 'src', 'deep', 'er', 'fixtures.ts'), "export const IN_A_FIXTURE = 99;\n");
    writeFileSync(allowFile, '{"allow":[]}');
    const go = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--repo', repo, '--allow', allowFile, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const planted = JSON.parse(go().stdout) as Report & { tunables: number };
    assert.deepEqual(planted.sites.filter((x) => x.kind === 'tunable').map((x) => x.file).sort(), ['origins/x/thing.ts', 'src/deep/er/brand-new.ts', 'src/deep/er/brand-new.ts'], 'new numeric consts in any src/ or origins/ file; not the test or the fixtures');
    assert.equal(go('--gate').status, 1, 'a new literal goes red under --gate');
    const keep = (extra: object) => ({ file: 'src/deep/er/brand-new.ts', name: 'NEW_RANGE', reason: 'a test', ...extra });
    for (const bad of [{ owner: '', sunset: '2099-01-01' }, { owner: 'Test' }, { owner: 'Test', sunset: 'soon' }]) {
      writeFileSync(allowFile, JSON.stringify({ allow: [], tunables: [keep(bad)] }));
      assert.equal(go().status, 2, `an entry without a reason, owner and sunset date is refused: ${JSON.stringify(bad)}`);
    }
    writeFileSync(allowFile, JSON.stringify({ allow: [], tunables: ['NEW_RANGE', 'NEW_TICK', 'SHAPE'].map((name) => ({ file: name === 'NEW_TICK' ? 'origins/x/thing.ts' : 'src/deep/er/brand-new.ts', name, reason: 'a test', owner: 'Test', sunset: '2099-01-01' })) }));
    assert.equal(go('--gate').status, 0, 'every keeper listed with its owner and sunset: green');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
