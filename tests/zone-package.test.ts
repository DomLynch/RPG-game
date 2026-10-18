// The zone package prototype (scripts/zone-package.mjs): a zone exports to a folder of rows and imports back with nothing lost (docs/specs/zone-package.md, Design v1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
// @ts-expect-error a plain .mjs script with no declaration file
import { exportPackage, importPackage, loadTables, roundTrip, zoneRowText } from '../scripts/zone-package.mjs';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
type Files = Record<string, string>;
for (const [n, id] of [['5', 'bone-hollow'], ['6', 'crypt-sample']] as const) {
  test(`zone ${n} (${id}) round-trips: the zone row byte-identical, the shared rows the same, the export a fixed point`, () => {
    const r = roundTrip(n);
    assert.deepEqual(r.problems, []); assert.equal(r.ok, true);
    assert.equal(r.manifest.id, id);
    assert.ok(r.manifest.owns.exits.length >= 1 && r.manifest.inbound.exits.length >= 1, 'it owns an exit out and has an exit in from another zone');
  });
}
test('the manifest hashes every other file, so a changed or extra file is caught', () => {
  const pkg = exportPackage('5', zoneRowText('5'), loadTables()) as { files: Files; manifest: { files: Record<string, { bytes: number; sha256: string }> } };
  const listed = Object.keys(pkg.manifest.files).sort(), present = Object.keys(pkg.files).filter((f) => f !== 'package.json').sort();
  assert.deepEqual(listed, present);
  for (const f of listed) assert.equal(pkg.manifest.files[f]!.sha256, sha(pkg.files[f]!), `${f} matches its hash`);
  const tampered = { ...pkg.files, 'dungeon.row.json': pkg.files['dungeon.row.json']!.replace('Bone Hollow', 'Bone Hollo') };
  assert.notEqual(sha(tampered['dungeon.row.json']), pkg.manifest.files['dungeon.row.json']!.sha256, 'an edit changes the hash the manifest recorded');
});
test('an import replaces a row with the same id and appends a new one', () => {
  const tables = loadTables(), pkg = exportPackage('5', zoneRowText('5'), tables) as { files: Files };
  const once = importPackage(pkg.files, tables).tables, twice = importPackage(pkg.files, once).tables;
  assert.equal(once.dungeons.length, tables.dungeons.length, 'the same id replaces, it does not duplicate');
  assert.deepEqual(twice, once, 'importing twice changes nothing');
  const without = { ...tables, dungeons: tables.dungeons.filter((d: { id: string }) => d.id !== 'bone-hollow') };
  assert.equal(importPackage(pkg.files, without).tables.dungeons.length, tables.dungeons.length, 'a missing row is appended');
});
