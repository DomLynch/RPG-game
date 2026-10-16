import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { worldBodyUrl } from '../src/fight/catalogue-bodies.ts';

// Before this flag mobs-view held WORLD_URLS = { goblin, wolf, bear, boar } by hand: those four, and only those, draw a world body; knight, pitborn and witch (which have a world file too) keep their engine body.
const DRAWN = ['bear', 'boar', 'cave-troll', 'giant-salamander', 'goblin', 'wolf'];

test('the kinds the open world draws as world bodies are exactly the rows flagged worldBody, and a flagged row has the file', () => {
  const flagged = CATALOGUE.filter((r) => r.worldBody).map((r) => r.id).sort();
  assert.deepEqual(CATALOGUE.filter((r) => r.worldBody && !r.body).map((r) => r.id).sort(), DRAWN, 'the body kinds the world draws (mobs-view asks by body kind)');
  assert.deepEqual(flagged, [...DRAWN, 'ember-wolf'].sort(), 'a variant row carries its body row\'s flag (the variant rule)');
  assert.deepEqual(CATALOGUE.filter((r) => worldBodyUrl(r.id) !== undefined).map((r) => r.id).sort(), flagged, 'the drawn set is the flagged set');
  for (const id of DRAWN) {
    const url = worldBodyUrl(id)!;
    assert.equal(url, `/world/${id}.glb`, `${id}: the same URL the hand map held`);
    assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `${id}: public${url} exists`);
  }
  for (const id of ['knight', 'pitborn', 'witch']) assert.equal(worldBodyUrl(id), undefined, `${id} keeps its engine body`);
  assert.equal(worldBodyUrl('ember-wolf'), worldBodyUrl('wolf'), 'the variant shares its body\'s file');
  assert.equal(worldBodyUrl('no-such-row'), undefined);
});
