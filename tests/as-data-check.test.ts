// The as-data checker (scripts/as-data/check.ts, `npm run check:as-data`): report-only, so these tests pin what it SEES, on a fixture tree whose answer is known, not the live repo's
// count (which only goes down as content moves into data; the live numbers are in the PR that added it and in the checker's own output). A planted compare must raise the count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Site = { file: string; line: number; kind: string; category: string; text: string };
type Report = { compares: number; byCategory: Record<string, number>; unions: number; sites: Site[]; allowed: (Site & { reason: string })[]; stale: { file: string; literal: string }[] };
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

test('the real allow-list has no stale entry', () => {
  const r = run('src');
  assert.equal(r.status, 0, `${r.stderr}${r.stdout.slice(0, 400)}`);
  assert.deepEqual((JSON.parse(r.stdout) as Report).stale, []);
  assert.ok((JSON.parse(r.stdout) as Report).allowed.length >= 1);
});
