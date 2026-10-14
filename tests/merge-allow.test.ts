import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeAllow, serialize } from '../scripts/as-data/merge-allow.mjs';

const SCRIPT = new URL('../scripts/as-data/merge-allow.mjs', import.meta.url).pathname;
const FIX = new URL('./fixtures/allow-merge/', import.meta.url).pathname;
const ALLOW = new URL('../scripts/as-data/allow/', import.meta.url).pathname;
const entry = (file: string, name: string, extra: Record<string, unknown> = {}) => ({ file, name, kind: 'debt', reason: 'r', ...extra });
const doc = (tunables: object[], more: Record<string, unknown> = {}) => serialize({ ...more, tunables });
const names = (text: string) => (JSON.parse(text).tunables as { name: string }[]).map((e) => e.name);

test('the writer reproduces every committed allow file byte for byte (so a merge never reformats a file)', () => {
  for (const f of readdirSync(ALLOW)) { const text = readFileSync(join(ALLOW, f), 'utf8'); assert.equal(serialize(JSON.parse(text)), text, f); }
});

// Real conflicts, frozen from history: base / ours / theirs are the three versions git saw, expected is the file the person who resolved it committed.
for (const dir of readdirSync(FIX)) {
  test(`real conflict ${dir}: the resolver gives exactly the file the human resolution committed`, () => {
    const [base, ours, theirs, expected] = ['base', 'ours', 'theirs', 'expected'].map((n) => readFileSync(join(FIX, dir, `${n}.json`), 'utf8')) as [string, string, string, string];
    const r = mergeAllow(base, ours, theirs);
    assert.deepEqual(r.clashes, []);
    assert.equal(r.text, expected);
  });
}

test('two PRs adding entries side by side both survive, in order; one retiring an entry drops it', () => {
  const base = doc([entry('a.ts', 'A'), entry('b.ts', 'B'), entry('c.ts', 'C')]);
  const ours = doc([entry('a.ts', 'A'), entry('a.ts', 'A2'), entry('b.ts', 'B'), entry('c.ts', 'C')]);          // adds A2 after A
  const theirs = doc([entry('a.ts', 'A'), entry('b.ts', 'B'), entry('b.ts', 'B2'), entry('c.ts', 'C')].filter((e) => e.name !== 'C'));   // adds B2, retires C
  const r = mergeAllow(base, ours, theirs);
  assert.deepEqual(r.clashes, []);
  assert.deepEqual(names(r.text), ['A', 'A2', 'B', 'B2']);
});

test('edits to different entries merge; the same edit on both sides is kept once; a one-sided edit wins', () => {
  const base = doc([entry('a.ts', 'A', { sunset: '2026-10-24' }), entry('b.ts', 'B'), entry('c.ts', 'C')]);
  const ours = doc([entry('a.ts', 'A', { sunset: '2026-11-01' }), entry('b.ts', 'B', { reason: 'new' }), entry('c.ts', 'C')]);
  const theirs = doc([entry('a.ts', 'A', { sunset: '2026-10-24' }), entry('b.ts', 'B', { reason: 'new' }), entry('c.ts', 'C', { owner: 'World' })]);
  const r = mergeAllow(base, ours, theirs), got = JSON.parse(r.text).tunables;
  assert.deepEqual(r.clashes, []);
  assert.equal(got[0].sunset, '2026-11-01'); assert.equal(got[1].reason, 'new'); assert.equal(got[2].owner, 'World');
  assert.equal(got.length, 3);
});

test('a true clash is reported and never silently resolved: the same entry changed differently, or added differently', () => {
  const base = doc([entry('a.ts', 'A', { sunset: '2026-10-24' })]);
  const edit = mergeAllow(base, doc([entry('a.ts', 'A', { sunset: '2026-11-01' })]), doc([entry('a.ts', 'A', { sunset: '2026-12-01' })]));
  assert.equal(edit.clashes.length, 1); assert.equal(edit.clashes[0].id, 'a.ts | A');
  const added = mergeAllow(doc([]), doc([entry('n.ts', 'N', { reason: 'one' })]), doc([entry('n.ts', 'N', { reason: 'two' })]));
  assert.equal(added.clashes.length, 1);
  assert.deepEqual(mergeAllow(doc([]), doc([entry('n.ts', 'N')]), doc([entry('n.ts', 'N')])).clashes, []);   // the same addition twice is not a clash
});

test('an entry one side retired and the other edited is dropped, with a note (the debt is paid; there is no row left to edit)', () => {
  const base = doc([entry('a.ts', 'A', { sunset: '2026-10-24' }), entry('b.ts', 'B')]);
  const r = mergeAllow(base, doc([entry('b.ts', 'B')]), doc([entry('a.ts', 'A', { sunset: '2026-11-01' }), entry('b.ts', 'B')]));
  assert.deepEqual(r.clashes, []); assert.deepEqual(names(r.text), ['B']); assert.equal(r.notes.length, 1);
});

test('other sections and scalars: allow/verbs merge by their own identity; a one-sided scalar change wins; a new section carries over', () => {
  const base = serialize({ about: 'x', allow: [{ file: 'a.ts', literal: 'l', reason: 'r' }], verbs: [] });
  const ours = serialize({ about: 'y', allow: [{ file: 'a.ts', literal: 'l', reason: 'r' }, { file: 'a.ts', literal: 'm', reason: 'r' }], verbs: [] });
  const theirs = serialize({ about: 'x', allow: [{ file: 'a.ts', literal: 'l', reason: 'r' }], verbs: [{ file: 'v.ts', name: 'V', dispatch: 'd', sunset: null }], tunables: [entry('t.ts', 'T')] });
  const r = mergeAllow(base, ours, theirs), got = JSON.parse(r.text);
  assert.deepEqual(r.clashes, []);
  assert.equal(got.about, 'y'); assert.equal(got.allow.length, 2); assert.equal(got.verbs[0].name, 'V'); assert.equal(got.tunables[0].name, 'T');
  assert.equal(mergeAllow(serialize({ about: 'x' }), serialize({ about: 'y' }), serialize({ about: 'z' })).clashes.length, 1);
});

test('merging a file with itself changes nothing', () => {
  for (const f of readdirSync(ALLOW)) { const t = readFileSync(join(ALLOW, f), 'utf8'); assert.equal(mergeAllow(t, t, t).text, t, f); }
});

test('the command writes the merged file over ours and exits 0; on a clash it exits 1 and leaves ours untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-allow-')), w = (n: string, t: string) => { writeFileSync(join(dir, n), t); return join(dir, n); };
  const base = w('base', doc([entry('a.ts', 'A')])), theirs = w('theirs', doc([entry('a.ts', 'A'), entry('b.ts', 'B')])), ours = w('ours', doc([entry('a.ts', 'A'), entry('c.ts', 'C')]));
  const ok = spawnSync(process.execPath, [SCRIPT, base, ours, theirs], { encoding: 'utf8' });
  assert.equal(ok.status, 0); assert.deepEqual(names(readFileSync(ours, 'utf8')), ['A', 'B', 'C']);
  const x = w('x-ours', doc([entry('a.ts', 'A', { reason: 'one' })])), y = w('y-theirs', doc([entry('a.ts', 'A', { reason: 'two' })]));
  const before = readFileSync(x, 'utf8'), bad = spawnSync(process.execPath, [SCRIPT, base, x, y, 'scripts/as-data/allow/x.json'], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /CLASH on tunables a\.ts \| A/); assert.equal(readFileSync(x, 'utf8'), before);
});

test('git runs it as a merge driver: adjacent additions that conflict as text merge clean; without the driver the same merge conflicts', () => {
  const attr = readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8');
  assert.match(attr, /^scripts\/as-data\/allow\/\*\.json merge=as-data-allow$/m);
  const repo = mkdtempSync(join(tmpdir(), 'merge-allow-git-')), git = (...a: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const file = join(repo, 'scripts/as-data/allow/src.json');
  mkdirSync(join(repo, 'scripts/as-data/allow'), { recursive: true });
  writeFileSync(join(repo, '.gitattributes'), attr);
  const put = (rows: object[]) => writeFileSync(file, doc(rows));
  git('init', '-q', '-b', 'main'); put([entry('a.ts', 'A'), entry('z.ts', 'Z')]); git('add', '-A'); git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'other'); put([entry('a.ts', 'A'), entry('b.ts', 'B'), entry('z.ts', 'Z')]); git('commit', '-qam', 'other adds B');
  git('switch', '-q', 'main'); put([entry('a.ts', 'A'), entry('c.ts', 'C'), entry('z.ts', 'Z')]); git('commit', '-qam', 'main adds C');
  const driver = `node ${SCRIPT} %O %A %B %P`;
  writeFileSync(join(repo, '.git/info/attributes'), 'scripts/as-data/allow/*.json merge=text\n');   // outranks .gitattributes: plain text merge, the baseline
  assert.throws(() => git('merge', '--no-edit', 'other'));
  assert.ok(readFileSync(file, 'utf8').includes('<<<<<<<'), 'plain text merge leaves conflict markers');
  git('merge', '--abort'); writeFileSync(join(repo, '.git/info/attributes'), '');
  const res = git('-c', `merge.as-data-allow.driver=${driver}`, 'merge', '--no-edit', 'other');
  assert.match(res, /Merge made|Merge/i);
  const merged = readFileSync(file, 'utf8');
  assert.ok(!merged.includes('<<<<<<<'), 'no conflict markers'); assert.deepEqual(names(merged), ['A', 'B', 'C', 'Z']);
});
