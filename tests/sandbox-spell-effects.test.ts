// sandbox-mech: spell effects (Dom 2026-10-16: every spell plays its designed effect). sandbox/spell-fx.json carries one `spellEffect` row per catalogue spell { id, fx } (authored by sandbox/spell-fx-gen.mjs from the ladder rule). This is the audit: every spell has a real effect, a ladder legend's spell plays exactly its family's effect at its rank, every other spell stays inside its own level band, and all 50 designed effects are used. Trunk ships the family empty.
import test from 'node:test';
import assert from 'node:assert/strict';
import DEFS from '../src/fight/sandbox-rules-defs.json' with { type: 'json' };
import EFFECTS from '../sandbox/spell-fx.json' with { type: 'json' };
import FAMILIES from '../src/fight/legend-families.json' with { type: 'json' };
import { SPELL_INFO } from '../src/fight/spell-catalogue.ts';
import { classSpecialFor } from '../src/fight/class-special-identity.ts';
import { bossSpecialFor } from '../src/fight/special-identity.ts';
import { SPECIAL_MODES } from '../src/fight/special-modes.ts';
import { SPECIAL_TESTS } from '../src/fight/special-look.ts';

type Row = { id: string; fx: string };
const rows = (EFFECTS as unknown as { spellEffect: Row[] }).spellEffect, byId = new Map(rows.map((r) => [r.id, r.fx]));
const fxFor = (opponent: string, rank: number) => (rank >= 8 ? bossSpecialFor(opponent as never, 5 * rank - 4) : classSpecialFor(opponent as never, 5 * rank - 4));
const bandOf = (rank: number) => (rank <= 3 ? 'A' : rank <= 7 ? 'B' : String(rank));
const opponents = (FAMILIES as unknown as { families: { opponent: string; legends: { legendId: string; rank: number }[] }[] }).families;
const pool = (band: string) => new Set(opponents.flatMap((f) => [1, 4, 8, 9, 10].filter((r) => bandOf(r) === band).map((r) => fxFor(f.opponent, r))).filter(Boolean));

test('trunk ships spellEffect empty; the sandbox file is the only author', () => {
  assert.deepEqual((DEFS as unknown as { spellEffect: unknown[] }).spellEffect, []);
});
test('one effect row for every catalogue spell, and none for an unknown one', () => {
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'no spell has two rows');
  assert.deepEqual(rows.map((r) => r.id).sort(), Object.keys(SPELL_INFO).sort());
});
test('every row names a real designed effect: it has a mode and a look-test preview', () => {
  for (const r of rows) { assert.ok(SPECIAL_MODES[r.fx], `${r.id}: no mode for ${r.fx}`); assert.ok(SPECIAL_TESTS[r.fx], `${r.id}: no preview for ${r.fx}`); }
});
test('a ladder legend\'s spell plays exactly its family\'s effect at its rank (class A 1-3, B 4-7, the boss special 8-10)', () => {
  let checked = 0;
  for (const f of opponents) for (const l of f.legends) { const info = SPELL_INFO[l.legendId]; if (!info) continue; assert.equal(byId.get(l.legendId), fxFor(f.opponent, info.level), `${l.legendId} (${f.opponent} L${info.level})`); checked++; }
  assert.equal(checked, 48, 'the 48 ladder legends that have a spell');
});
test('every other spell stays inside its own level band: A for 1-3, B for 4-7, its own rank for 8, 9, 10', () => {
  for (const [id, info] of Object.entries(SPELL_INFO)) assert.ok(pool(bandOf(info.level)).has(byId.get(id)!), `${id} L${info.level} plays ${byId.get(id)}, not an effect of band ${bandOf(info.level)}`);
});
test('all 50 designed effects are used: the 10 families x (class A, class B, boss 8, 9, 10)', () => {
  assert.equal(new Set(rows.map((r) => r.fx)).size, 50);
});
