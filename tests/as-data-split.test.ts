// The as-data allow list is a folder (scripts/as-data/allow/<root>.json, World, Dom's data-layer day 2026-10-14): one file per root directory, so a lane's rows PRs touch only its own root file.
// This pins the shape: each tunables entry sits in the file named for its root, no (file, name) is listed twice, and the loader merges any folder the same way whatever the split.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadAllow } from '../scripts/as-data/load-allow.ts';

const DIR = 'scripts/as-data/allow';
const rootOf = (f: string): string => {
  const p = f.split('/');
  if (f.startsWith('src/fight/sound/')) return 'src-fight-sound';
  return (p[0] === 'src' || p[0] === 'origins') && p.length > 2 ? `${p[0]}-${p[1]}` : p[0]!;
};

test('every tunables entry is in the file named for its root, and none is listed twice', () => {
  const seen = new Set<string>();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    const entries = (JSON.parse(readFileSync(join(DIR, f), 'utf8')) as { tunables: { file: string; name: string }[] }).tunables;
    assert.ok(entries.length > 0, `${f} is empty: delete the file`);
    for (const e of entries) {
      assert.equal(`${rootOf(e.file)}.json`, f, `${e.file} ${e.name} belongs in ${rootOf(e.file)}.json`);
      const key = `${e.file}\t${e.name}`;
      assert.ok(!seen.has(key), `${key} is listed twice`);
      seen.add(key);
    }
  }
  assert.ok(seen.size > 0);
});
test('the folder merges into one sorted list; allow and verbs come from _lists.json in their file order', () => {
  const all = loadAllow(DIR);
  const sorted = [...all.tunables!].sort((a, b) => (a.file + '\t' + a.name < b.file + '\t' + b.name ? -1 : 1));
  assert.deepEqual(all.tunables, sorted);
  const lists = JSON.parse(readFileSync(join(DIR, '_lists.json'), 'utf8')) as { allow: unknown[]; verbs: unknown[] };
  assert.deepEqual([all.allow, all.verbs], [lists.allow, lists.verbs]);
});
test('a folder of two files merges like the one file they were cut from', () => {
  const dir = mkdtempSync(join(tmpdir(), 'allow-split-')), one = join(dir, 'one.json'), part = join(dir, 'parts');
  const a = { file: 'src/a.ts', name: 'A', kind: 'exempt', reason: 'a long enough reason' }, b = { file: 'origins/b/b.ts', name: 'B', kind: 'exempt', reason: 'a long enough reason' };
  writeFileSync(one, JSON.stringify({ allow: [], verbs: [], tunables: [b, a] }));
  mkdirSync(part);
  writeFileSync(join(part, 'src.json'), JSON.stringify({ tunables: [a] }));
  writeFileSync(join(part, 'origins-b.json'), JSON.stringify({ tunables: [b] }));
  assert.deepEqual(loadAllow(part).tunables, loadAllow(one).tunables!.slice().sort((x, y) => (x.file < y.file ? -1 : 1)));
});
