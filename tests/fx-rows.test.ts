// Boss look FX and the deflect clip's start as rows (Dom's data-layer rule): special-fx-boss.ts and characters.ts import three, so the rows are pinned here to the values they held in code.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import fxRaw from '../src/fight/boss-fx-rules.json' with { type: 'json' };
import fxMan from '../src/fight/boss-fx-rules.manifest.json' with { type: 'json' };
import charRaw from '../src/fight/characters-rules.json' with { type: 'json' };
import charMan from '../src/fight/characters-rules.manifest.json' with { type: 'json' };

test('the boss FX row keeps the numbers special-fx-boss.ts held in code', () => {
  assert.deepEqual(fxRaw.bossFxRule, [{ id: 'boss-fx', pitMist: 0.13, pitStain: 0.07, pitBreath: 0.03, mist: 64, ghost: 23, flies: 280, wisp: 30, ring: 18, veils: 6, drops: 260 }]);
});

test('the deflect clip starts at its .35 key', () => assert.deepEqual(charRaw.charactersRule, [{ id: 'characters', deflectFrom: 0.35 }]));

test('both rows files load through the registry, one row each', () => {
  for (const [raw, man, name] of [[fxRaw, fxMan, 'boss-fx-rules.json'], [charRaw, charMan, 'characters-rules.json']] as const) {
    assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, name))));
    assert.equal(Object.values(raw)[0]!.length, 1);
  }
});
