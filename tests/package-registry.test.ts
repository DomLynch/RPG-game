// The zone package folders are the one source of truth (docs/specs/zone-package.md, step 2): the shared tables and a package's zone row are BUILD OUTPUT of scripts/gen-packages.mjs, so a hand edit of one fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, loadRules, NAMED_RULES, readPackages, writeGenerated } from '../scripts/gen-packages.mjs';
import { roundTrip } from '../scripts/zone-package.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

test('every committed generated file is what the package folders generate (npm run packages writes them)', () => {
  const out = generate() as Record<string, string>;
  assert.ok(Object.keys(out).length >= 5, 'the shared tables and each package zone row');
  for (const [file, text] of Object.entries(out)) assert.equal(readFileSync(join(ROOT, file), 'utf8'), text, `stale or hand-edited ${file}: run \`npm run packages\``);
});

test('a hand edit of a generated file is caught, and regenerating repairs it', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'pkgs-'));
  try {
    for (const d of ['origins/packages', 'origins/zones', 'origins/zone-rows', 'public/world/kit']) { mkdirSync(join(scratch, d), { recursive: true }); cpSync(join(ROOT, d), join(scratch, d), { recursive: true }); }
    writeGenerated(scratch);
    const file = join(scratch, 'origins/zones/exit-rows.json'), good = readFileSync(file, 'utf8');
    writeFileSync(file, good.replace('"radiusM": 2.5', '"radiusM": 9'));
    assert.notEqual(readFileSync(file, 'utf8'), (generate(scratch) as Record<string, string>)['origins/zones/exit-rows.json'], 'the edit differs from a fresh generation');
    writeGenerated(scratch);
    assert.equal(readFileSync(file, 'utf8'), good, 'regenerating puts it back');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
});

test('the packages here are bone-hollow (zone 5) and crypt-sample (zone 6); a theme two dungeons share is carried once', () => {
  const pkgs = readPackages() as { id: string; files: Record<string, string> }[];
  assert.deepEqual(pkgs.map((p) => p.id), ['bone-hollow', 'crypt-sample']);
  const carried = pkgs.flatMap((p) => (p.files['theme.row.json'] ? [(JSON.parse(p.files['theme.row.json']) as { id: string }).id] : []));
  assert.deepEqual(carried, [...new Set(carried)], 'no theme row is carried twice');
});

test('both packages still round-trip through export and import', () => { for (const n of ['5', '6']) assert.deepEqual(roundTrip(n).problems, [], `zone ${n}`); });

test('every bound is a named, counted row: no unnamed bound, no missing one, none zero', () => {
  const rows = (JSON.parse(readFileSync(join(ROOT, 'origins/zones/package-rules.json'), 'utf8')) as { rules: { id: string; value: number }[] }).rules;
  assert.equal(NAMED_RULES.length, 6); assert.equal(rows.length, NAMED_RULES.length, 'the rows file holds exactly the named rules');   // +6: the import tool's bounds (maxFiles, maxFileBytes, maxExits, maxWarps, maxCreatures, maxRooms), World, deliberate
  assert.deepEqual(Object.keys(loadRules()).sort(), [...NAMED_RULES].sort());
  assert.throws(() => loadRules({ rules: rows.filter((r) => r.id !== 'maxFiles') }), /"maxFiles" rule by name/);
  assert.throws(() => loadRules({ rules: [...rows, { id: 'maxAnything', value: 1 }] }), /not a named rule/);
  assert.throws(() => loadRules({ rules: rows.map((r) => (r.id === 'maxRooms' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadRules({ rules: [...rows, rows[0]] }), /twice/);
});
