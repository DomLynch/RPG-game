// K11 slice 1: the catalogue resolves a character's look for one meeting, and says what the old tables say (origins/preview/mob-looks.ts scale, src/rank-look.ts look files).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { catalogueLook } from '../src/fight/catalogue-look.ts';
import { MOB_LOOKS } from '../origins/preview/mob-looks.ts';
import { rankLookFor } from '../src/rank-look.ts';
import { MAX_LEVEL } from '../src/career.ts';

const file = (url: string) => new URL(`../public${url}`, import.meta.url);

test('a mob look body draws at the scale the catalogue says (the beasts at the size they are met walking)', () => {
  for (const [id, look] of Object.entries(MOB_LOOKS)) {
    const row = CATALOGUE.find((r) => r.id === look.opponent);
    if (!row) continue;   // a held body the catalogue does not carry
    if (row.shape === 'quadruped') assert.equal(look.scale, catalogueLook(look.opponent, 1)!.scale, `${id}: a beast's mob look is its catalogue scale`);
    assert.equal(catalogueLook(look.opponent, 1)!.scale, row.render.scale);
  }
  assert.deepEqual(['wolf', 'boar', 'bear'].map((id) => catalogueLook(id, 5)!.scale), [2, 1.8, 2.2]);
});

test('the rank look: the rung it is met at, the file that rung ships, phone LOD only where it exists', () => {
  assert.equal(catalogueLook('goblin', 1)!.rankLook, undefined, 'the goblin ships no Recruit look');
  assert.equal(catalogueLook('goblin', 6)!.rung, 2);
  assert.equal(catalogueLook('goblin', 6)!.rankLook, '/looks/goblin-L2.glb');
  assert.equal(catalogueLook('goblin', 6, true)!.rankLook, '/looks/goblin-L2.glb', 'no phone LOD for the goblin');
  assert.equal(catalogueLook('knight', 1, true)!.rankLook, '/looks/knight-L1-phone.glb');
  for (const row of CATALOGUE) for (let level = 1; level <= MAX_LEVEL; level++) for (const phone of [false, true]) {
    const look = catalogueLook(row.id, level, phone)!;
    assert.equal(look.rankLook, look.rung === null ? undefined : rankLookFor(row.id, look.rung, phone), `${row.id} L${level}: the catalogue agrees with rank-look.ts`);
    if (look.rankLook) assert.ok(existsSync(file(look.rankLook)), `${row.id} L${level}: ${look.rankLook} is a shipped file`);
  }
});

test('a creature has no rung and no rank look; an unknown id has no look at all; tint follows armour + ranks', () => {
  for (const id of ['wolf', 'boar', 'bear']) assert.deepEqual(catalogueLook(id, 9), { scale: catalogueLook(id, 1)!.scale, rung: null, rankLook: undefined, tint: false });
  assert.equal(catalogueLook('dragon', 1), null);
  assert.equal(catalogueLook('knight', 10)!.tint, true);
});
