// The townspeople's worn pieces are rows (cloth.json): the generator walks slot rows, so it must give EXACTLY what the old hard-coded generator gave for any seed; a named NPC's outfit lives on its
// NPC row; a new piece is one row (plus a glb node), no generator code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outfitFor, NAMED_OUTFITS } from '../preview/town-dress.ts';
import { REGION1_NPCS } from '../region1/npcs.ts';
import { CLOTH_PIECES, CLOTH_PIECE_ROWS, CLOTH_SLOTS, outfitProblems } from './cloth.ts';
import { validateNpcRows, type NpcContext, type NpcRow } from './row.ts';

// The generator as it was before the rows (origins/preview/town-dress.ts, 2026-10-12), kept here as the oracle.
const OLD_TINTS = [0x8a6f4a, 0x6b7f5e, 0x7a5c6a, 0x5f6f86, 0x9a8a6a, 0x7d6a58, 0x6a7a74, 0x8c6a52];
function oldOutfitFor(seed: string) {
  let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const bit = (n: number) => ((h >>> n) & 1) === 1, tunic = bit(3), head = [undefined, 'cap', 'hat', 'hood'][(h >>> 7) & 3];
  const pieces: string[] = [tunic ? 'tunic' : 'robe'];
  if (bit(4)) pieces.push('sleeves');
  if (bit(5)) pieces.push('belt');
  if (tunic && bit(6)) pieces.push('apron');
  if (head) pieces.push(head);
  return { pieces, tint: OLD_TINTS[h % OLD_TINTS.length]! };
}

test('the row-walking generator equals the old hard-coded one for 5000 seeds, and the rows are the eight pieces in order', () => {
  assert.deepEqual([...CLOTH_PIECES], ['robe', 'tunic', 'sleeves', 'belt', 'cap', 'apron', 'hat', 'hood']);
  for (let i = 0; i < 5000; i++) { const seed = i < 100 ? `character:npc-${i}` : `npc-${i}`; assert.deepEqual(outfitFor(seed), oldOutfitFor(seed), seed); }
  for (const seed of ['character:smith-orla', 'character:banker-exchange']) assert.deepEqual(outfitFor(seed), oldOutfitFor(seed), seed);
});

test('outfitProblems: unknown piece, two in a slot, a missing required piece; every generated outfit is valid', () => {
  assert.deepEqual(outfitProblems(['robe', 'sleeves', 'cap']), []);
  assert.deepEqual(outfitProblems(['cloak']), ['cloak is not a cloth piece']);
  assert.deepEqual(outfitProblems(['robe', 'tunic']), ['two pieces in the body slot']);
  assert.deepEqual(outfitProblems(['robe', 'apron']), ['apron needs tunic']);
  for (let i = 0; i < 500; i++) assert.deepEqual(outfitProblems(outfitFor(`npc-${i}`).pieces), [], `npc-${i}`);
});

test('the three named townspeople wear the outfits on their NPC rows (same pieces and tints as before), and a row with a bad outfit is refused by the NPC validator', () => {
  assert.deepEqual(NAMED_OUTFITS['character:banker-exchange'], { pieces: ['robe', 'sleeves', 'belt', 'cap'], tint: 0x6b7f5e });
  assert.deepEqual(NAMED_OUTFITS['character:provisioner-exchange'], { pieces: ['tunic', 'apron', 'belt', 'hat'], tint: 0x8a6f4a });
  assert.deepEqual(NAMED_OUTFITS['character:innkeeper-exchange'], { pieces: ['tunic', 'sleeves', 'apron', 'belt'], tint: 0x7a5c6a });
  assert.deepEqual(Object.keys(NAMED_OUTFITS).sort(), ['character:banker-exchange', 'character:innkeeper-exchange', 'character:provisioner-exchange']);
  const ctx: NpcContext = { character: () => true, shop: () => true, landmark: () => true };
  const base: NpcRow = { ...REGION1_NPCS[0]!, outfit: { pieces: ['robe', 'tunic'], tint: 0 } };
  assert.deepEqual(validateNpcRows([base], ctx).issues.map((i) => i.path), ['npcs[0].outfit']);
});

test('a new piece is one row: it joins its slot, the generator can wear it, no code; a slot with a new piece changes the choice count', () => {
  const pieces = CLOTH_PIECE_ROWS as Record<string, object>;
  pieces.beret = { order: 9, slot: 'head' };
  try {
    const worn = new Set<string>(); for (let i = 0; i < 2000; i++) for (const p of outfitFor(`npc-${i}`).pieces) worn.add(p);
    assert.ok(worn.has('beret'), 'a beret row is worn by someone');
    assert.deepEqual(Object.keys(CLOTH_SLOTS), ['body', 'sleeves', 'belt', 'apron', 'head']);
  } finally { delete pieces.beret; }
  const again = new Set<string>(); for (let i = 0; i < 2000; i++) for (const p of outfitFor(`npc-${i}`).pieces) again.add(p);
  assert.ok(!again.has('beret'));
});
