// town-kit.ts: every generated piece maps to a real kit piece, deterministically, by the lot's kind and trade; the table matches Characters' manifest when the file is on disk.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { generateTown } from './town.ts';
import { KIT_NAMES, kitPiece } from './town-kit.ts';

test('every piece of every town maps to a piece the kit ships, the same way twice', () => {
  for (const seed of ['ferry', 'cinder']) for (const w of [0, 0.5, 1]) {
    const t = generateTown(seed, w);
    for (const l of t.lots) for (const p of l.pieces) { const n = kitPiece(p, l); assert.ok(KIT_NAMES.includes(n), `${n} is not in the kit`); assert.equal(kitPiece(p, l), n); }
  }
});

test('signs and counters follow the building: a smithy gets the smith sign, the bank its sign and counter, a gate the gate arch', () => {
  const t = generateTown('ferry', 1);
  const names = (kind: string, node: string) => t.lots.filter((l) => l.kind === kind).flatMap((l) => l.pieces.filter((p) => p.node === node).map((p) => kitPiece(p, l)));
  assert.deepEqual([...new Set(names('bank', 'counter'))], ['counter_bank_a']);
  assert.deepEqual([...new Set(names('bank', 'sign'))], ['sign_bank_a']);
  assert.deepEqual([...new Set(names('gate', 'arch'))], ['arch_gate_a']);
  for (const l of t.lots.filter((q) => q.trade === 'smith')) assert.ok(l.pieces.filter((p) => p.node === 'sign').every((p) => kitPiece(p, l) === 'sign_smith_a'));
  for (const l of t.lots.filter((q) => q.trade === 'inn')) assert.ok(l.pieces.filter((p) => p.node === 'sign').every((p) => kitPiece(p, l) === 'sign_tavern_a'));
});

// Characters' manifest also carries three landmark pieces (arena, pit gate, rankings stone) that the generator does not place from the building kit: the plaza boards are World's hand-placed props for now.
const LANDMARKS = ['pit_arena_a', 'pit_gate_a', 'leaderboard_stone_a'];

test('a shop front has a door, and the table matches public/world/town/buildings.json when it is there', () => {
  const t = generateTown('ferry', 0.6);
  for (const l of t.lots.filter((q) => q.kind === 'shop' || q.kind === 'house' || q.kind === 'bank')) assert.ok(l.pieces.some((p) => p.node === 'wall' && p.slot === 'door'), `${l.id} has no door`);
  const file = new URL('../../public/world/town/buildings.json', import.meta.url);
  if (!fs.existsSync(file)) return;   // lands with Characters' #1825
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { pieces: Record<string, { weight: number }> };
  assert.deepEqual([...KIT_NAMES].sort(), Object.keys(manifest.pieces).filter((n) => !n.endsWith('_end_a') && n !== 'roof_end_a' && !LANDMARKS.includes(n)).sort());
});
