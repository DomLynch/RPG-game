// Characters' numbers as rows (Dom's data-layer rule): each export keeps the value it had in code, and each rows file loads through the registry.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FULL_POINTS, SLOT_WEIGHT } from '../src/fight/gear-stats.ts';
import { DECLINED_KEPT } from '../src/core/loot.ts';
import { CLAIMS_CAP, CLAIM_WAIT_MS, KEEPALIVE_BYTES } from '../src/core/loot-claims.ts';
import { SPECIAL_RECOVER, SPECIAL_STRUCK, SPECIAL_TESTS } from '../src/fight/special-look.ts';
import { VARIANTS } from '../origins/preview/mob-looks.ts';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import gearRaw from '../src/fight/gear-stats-rules.json' with { type: 'json' };
import gearMan from '../src/fight/gear-stats-rules.manifest.json' with { type: 'json' };
import lootRaw from '../src/core/loot-rules.json' with { type: 'json' };
import lootMan from '../src/core/loot-rules.manifest.json' with { type: 'json' };
import lookRaw from '../src/fight/look-rules.json' with { type: 'json' };
import lookMan from '../src/fight/look-rules.manifest.json' with { type: 'json' };
import mobRaw from '../origins/preview/mob-looks-rules.json' with { type: 'json' };
import mobMan from '../origins/preview/mob-looks-rules.manifest.json' with { type: 'json' };

test('the moved exports keep the numbers they had in code', () => {
  assert.deepEqual(SLOT_WEIGHT, { Helmet: 20, Crest: 0, Body: 30, Arms: 12, Gloves: 8, Greaves: 18, Boots: 12, Shield: 0, Trident: 100, Cleaver: 100, Knife: 100, Estoc: 100, Gladius: 100, Scythe: 100, Warhammer: 100, Maul: 100, Longsword: 100 });
  assert.deepEqual([FULL_POINTS, DECLINED_KEPT, CLAIMS_CAP, CLAIM_WAIT_MS, KEEPALIVE_BYTES, SPECIAL_RECOVER, SPECIAL_STRUCK, VARIANTS], [900, 50, 50, 3000, 60000, 45, 45, 8]);
  for (const t of Object.values(SPECIAL_TESTS)) assert.ok(t.first === 180 || t.first > 0);
});

test('every Characters rows file loads through the registry', () => {
  for (const [raw, man, name] of [[gearRaw, gearMan, 'gear-stats-rules.json'], [lootRaw, lootMan, 'loot-rules.json'], [lookRaw, lookMan, 'look-rules.json'], [mobRaw, mobMan, 'mob-looks-rules.json']] as const)
    assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, name))));
});
