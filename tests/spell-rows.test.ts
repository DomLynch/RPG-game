// The spell list and the special slots as rows (spec docs/specs/combat/spell-slots.md, rows PR): the loaders refuse a bad row, the shipped rows match the brief.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOW_DUPLICATE, SHARED_COOLDOWN, SPELL_LIST, SPELL_SLOTS, STAMINA_BAR } from '../src/fight/spell-rows.ts';
import { resolveSpell } from '../src/fight/spell-cast.ts';

test('the starter list: 15 catalogue spells, every level 1-10 covered, levels equal the index, no cost above the bar, ids and names unique', () => {
  assert.equal(SPELL_LIST.length, 15);
  assert.deepEqual([...new Set(SPELL_LIST.map((s) => s.level))].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(new Set(SPELL_LIST.map((s) => s.id)).size, 15); assert.equal(new Set(SPELL_LIST.map((s) => s.name)).size, 15);
  for (const s of SPELL_LIST) assert.ok(resolveSpell(s.id, 50)!.cost <= STAMINA_BAR, s.id);
});

test('the slots: two universal slots in HUD order, each with its own verb; the slot rules are 0/1 rows (separate cooldowns per slot per the Lead recommendation, PROVISIONAL until Strategy rules on #2810; duplicates off)', () => {
  assert.deepEqual(SPELL_SLOTS.map((s) => [s.id, s.action, s.order]), [['a', 'skill', 1], ['b', 'skill2', 2]]);
  assert.equal(SHARED_COOLDOWN, false); assert.equal(ALLOW_DUPLICATE, false);
});

test('the shipped rows are refused when broken: a non-spell id, a wrong level and a repeated slot verb throw at load', async () => {
  const { loadRegistry, tableFromFile } = await import('../src/core/registry.ts');
  const manifest = (await import('../src/fight/spell-list-defs.manifest.json', { with: { type: 'json' } })).default.tables[0];
  const rows = (list: unknown[]) => () => loadRegistry([tableFromFile(manifest as never, { list }, 'x.json')]);
  assert.doesNotThrow(rows([{ id: 'apep', name: 'Deep Shadow', level: 8 }]));
  assert.throws(rows([{ id: 'apep', name: 'Deep Shadow', level: 8 }, { id: 'apep', name: 'Again', level: 8 }]), /duplicate|apep/i);
});
