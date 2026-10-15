// Rule (c) of the as-data checker (scripts/as-data/map.yml + check.ts): a pair keyed by a content id whose value is a string OR an array of strings (widened 2026-10-15: CLASS_SPECIALS
// slipped past the string-only shape), held to a ratchet (map-baseline.json, per file and id key). Pinned on a fixture tree with its own baseline, never the live count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

type Site = { kind: string; file: string; line: number; text: string };
type Report = { maps: number; newMaps: number; sites: Site[]; newMapSites: Site[]; loweredMaps: { file: string; literal: string; baseline: number; now: number }[] };

const FIXTURE = [
  "export const SPECIALS = { witch: ['hex', 'curse'],",        // counted: an array of strings keyed by an opponent id
  "  knight: 'Knight' };",                                     // counted: a string, the shape the rule always had
  'export const SIZES = { witch: [1, 2], knight: [] };',       // numbers and an empty array: not this rule's
].join('\n') + '\n';

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'as-data-map-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  const file = join(dir, 'src', 'maps.ts'), key = relative(process.cwd(), file);
  writeFileSync(file, FIXTURE);
  const allow = join(dir, 'allow.json'), base = join(dir, 'map-baseline.json');
  writeFileSync(allow, '{"allow":[]}');
  writeFileSync(base, JSON.stringify({ [key]: { witch: 1, knight: 1 } }));
  const run = (...extra: string[]) => spawnSync(process.execPath, ['scripts/as-data/check.ts', '--json', '--root', join(dir, 'src'), '--allow', allow, '--map-baseline', base, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const report = (r: ReturnType<typeof run>) => JSON.parse(r.stdout.split('\n').filter((l) => l.startsWith('{')).pop()!) as Report;
  return { dir, file, key, base, run, report };
}

test('rule (c) lists string and string-array values keyed by a content id (not numbers, not an empty array), and a tree that matches its baseline is green under --gate', () => {
  const t = tree();
  try {
    const r = t.run('--gate');
    assert.equal(r.status, 0, r.stderr);
    const rep = t.report(r);
    assert.deepEqual(rep.sites.filter((s) => s.kind === 'map').map((s) => [s.line, s.text.split(':')[0]]), [[1, 'witch'], [2, 'knight']]);
    assert.equal(rep.newMaps, 0);
    assert.deepEqual(rep.loweredMaps, []);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('mutation: a NEW string-array map is refused under --gate (exit 1) and named; without --gate it is reported, not failed', () => {
  const t = tree();
  try {
    writeFileSync(t.file, FIXTURE + "export const MORE = { witch: ['brew'] };\n");
    const gated = t.run('--gate');
    assert.equal(gated.status, 1, 'a second witch map in the file is new');
    assert.deepEqual(t.report(gated).newMapSites.map((s) => [s.file, s.line]), [[t.key, 4]]);
    assert.equal(t.run().status, 0, 'report-only without --gate');
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});

test('a removed map leaves the baseline stale (exit 3); --write-map-baseline refuses while anything is new and writes the smaller tally once nothing is', () => {
  const t = tree();
  try {
    writeFileSync(t.file, FIXTURE.replace("witch: ['hex', 'curse'],", ''));
    const removed = t.run();
    assert.equal(removed.status, 3, 'a baseline above the tree is a list-integrity failure');
    assert.deepEqual(t.report(removed).loweredMaps.map((l) => [l.literal, l.baseline, l.now]), [['witch', 1, 0]]);
    const before = readFileSync(t.base, 'utf8');
    writeFileSync(t.file, FIXTURE + "export const MORE = { knight: ['brew'] };\n");
    const refused = t.run('--write-map-baseline');
    assert.equal(refused.status, 2, refused.stdout + refused.stderr);
    assert.match(refused.stderr, /the baseline only shrinks/);
    assert.equal(readFileSync(t.base, 'utf8'), before);
    writeFileSync(t.file, FIXTURE.replace("witch: ['hex', 'curse'],", ''));
    assert.equal(t.run('--write-map-baseline').status, 0);
    assert.deepEqual(JSON.parse(readFileSync(t.base, 'utf8')), { [t.key]: { knight: 1 } });
    assert.equal(t.run('--gate').status, 0);
  } finally { rmSync(t.dir, { recursive: true, force: true }); }
});
