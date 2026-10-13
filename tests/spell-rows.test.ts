// Grimoire cast + per-legend kill provenance (Lead's queue 2026-10-13). A spell is a row that casts through a special row; a kill names the legend fought.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS, loadSpellDefs, spellCast, spellsOf, type SpellRow } from '../src/fight/spell-rows.ts';
import { SPECIALS } from '../src/fight/special-rows.ts';
import SPELL_MANIFEST from '../src/fight/spell-defs.manifest.json' with { type: 'json' };
import type { Manifest } from '../src/core/registry.ts';
import { PORTRAIT_KEYS, legendAt } from '../src/legends.ts';
import { cleanProvenance, decline, killAt, store } from '../src/core/loot.ts';

const manifest = SPELL_MANIFEST.tables[0] as Manifest;
const row = (over: Partial<SpellRow>) => ({ spells: [{ ...SPELLS[0]!, ...over }] });

test('a spell casts through its special row: same family, template, cast and params, with the spell\'s overrides and its own id', () => {
  for (const s of SPELLS) {
    const base = SPECIALS.find((r) => r.id === s.special)!, cast = spellCast(s);
    assert.equal(cast.id, s.id);
    assert.deepEqual({ ...cast, id: base.id, params: base.params }, base, 'only the id and the overridden params differ from the special');
    for (const [k, v] of Object.entries(s.params)) assert.equal(cast.params[k], v, `${s.id}.${k} is the spell's number`);
    assert.notDeepEqual(cast.params, base.params, 'a spell with overrides is not the bare special');
  }
});

test('the spell rows load through the shared loader: an unknown special, school or legend, and a stray param, are refused with file:row:id', () => {
  assert.equal(loadSpellDefs(row({}), manifest).length, 1);
  assert.throws(() => loadSpellDefs(row({ special: 'nope' }), manifest), /special/);
  assert.throws(() => loadSpellDefs(row({ school: 'nope' }), manifest), /school/);
  assert.throws(() => loadSpellDefs(row({ legendId: 'pitborn-11' }), manifest), /is not a legend/);
  assert.throws(() => loadSpellDefs(row({ params: { nope: 1 } }), manifest), /not a parameter of the surtr special/);
  for (const s of SPELLS) assert.ok(PORTRAIT_KEYS.includes(s.legendId), `${s.id} is taken from a real legend`);
});

test('a kill carries the legend actually fought: legendId = the skull key of the rung, a creature has none, and a spell keys on it', () => {
  const k = killAt('pitborn', 41, 1, 10, '2026-10-13');   // level 41 is the Surtr rung
  assert.equal(k.legendId, `pitborn-${k.tier}`);
  assert.equal(legendAt('pitborn', k.tier!).name, 'Surtr');
  assert.deepEqual(cleanProvenance(k), k, 'survives the loader');
  assert.equal(killAt('wolf', 3, 1, 10, '2026-10-13').legendId, undefined, 'a creature is no legend');
  assert.equal(cleanProvenance({ ...k, legendId: 'pitborn-11' })?.tier, k.tier, 'a bad legendId is dropped, the kill kept');
  assert.equal(cleanProvenance({ ...k, legendId: 'pitborn-11' })?.legendId, undefined);
  assert.equal(store(undefined, 'pitborn.Body', k).taken!['pitborn.Body']!.legendId, k.legendId, 'a take keeps it');
  assert.equal(decline(undefined, k).declined![0]!.legendId, k.legendId, 'a refusal keeps it');
  assert.deepEqual(spellsOf(k.legendId!).map((s) => s.id), ['ashfall'], 'the Surtr kill takes the Ashfall spell');
});
