// The per-opponent loot is ROWS (src/core/loot-pieces.json): a new piece is one slot in a row and no code. loot.ts builds LOOT, NOT_WORN and NOT_WORN_AT from them.
import assert from 'node:assert/strict';
import test from 'node:test';
import PIECES from '../src/core/loot-pieces.json' with { type: 'json' };
import MANIFEST from '../src/core/loot-pieces.manifest.json' with { type: 'json' };
import { LOOT, LOOT_SLOTS, kitWorn } from '../src/core/loot.ts';
import { buildTables, checkTables, type Manifest } from '../src/core/registry.ts';
import { isOpponentId } from '../src/roster.ts';

test('LOOT is exactly the lootPiece rows: <opponent>.<slot>, in the row order, for an opponent that exists', () => {
  assert.equal(PIECES.lootPiece.length, 10);
  assert.deepEqual(Object.keys(LOOT), PIECES.lootPiece.map((r) => r.id), 'the opponents keep their order');
  for (const r of PIECES.lootPiece) {
    assert.ok(isOpponentId(r.id), r.id);
    assert.deepEqual(LOOT[r.id as keyof typeof LOOT], r.slots.map((s) => `${r.id}.${s}`), r.id);
    for (const s of r.slots) assert.ok((LOOT_SLOTS as readonly string[]).includes(s), `${r.id}.${s}`);
  }
});

test('the not-worn rows still take effect: the Dwarf and Executioner keep no greaves or boots on, the Knight no helmet, the Pitborn no helmet at Recruit only', () => {
  const worn = (o: string, tier?: string) => kitWorn(o as never, false, tier as never).map((id) => id.split('.')[1]);
  assert.ok(!worn('dwarf').includes('Greaves') && !worn('dwarf').includes('Boots') && worn('dwarf').includes('Helmet'));
  assert.ok(!worn('executioner').includes('Greaves') && !worn('executioner').includes('Boots') && worn('executioner').includes('Helmet'));
  assert.ok(!worn('knight').includes('Helmet') && worn('knight').includes('Greaves'));
  assert.ok(!worn('pitborn', 'Recruit').includes('Helmet') && worn('pitborn').includes('Helmet'), 'Recruit only (NOT_WORN_AT)');
});

test('the registry gate accepts the rows and rejects a duplicate opponent, a missing slots list and a wrong type', () => {
  const tables = (rows: unknown) => buildTables((MANIFEST.tables as unknown as Manifest[]).map((m) => ({ manifest: m, parsed: rows, file: 'loot-pieces.json' })));
  assert.deepEqual(checkTables(tables(PIECES)).problems, []);
  const dup = { ...PIECES, lootPiece: [...PIECES.lootPiece, PIECES.lootPiece[0]!] };
  assert.ok(checkTables(tables(dup)).problems.some((p) => p.rule === 'duplicate-id'));
  const noSlots = { ...PIECES, lootPiece: [{ id: 'veteran' }] };
  assert.ok(checkTables(tables(noSlots)).problems.some((p) => p.rule === 'missing-field'));
  const wrong = { ...PIECES, lootPiece: [{ id: 'veteran', slots: 'Helmet' }] };
  assert.ok(checkTables(tables(wrong)).problems.some((p) => p.rule === 'wrong-type'));
});
