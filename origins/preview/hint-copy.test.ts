// The first-load hint is chosen by what a zone is (its spawn rows), not by which zone it is; a zone's own row wins; the dismiss time is a row (Dom 2026-10-22: the town said "walk up to a creature").
import assert from 'node:assert/strict';
import test from 'node:test';
import COPY from './hint-copy.json' with { type: 'json' };
import { hintDismissSec, hintLine, hintTrait } from './hint-copy.ts';
import { zoneHint } from './legend-copy.ts';
import { listedZone, listedZoneIds } from '../zones/listed.ts';

test('a zone is classified by its spawn rows: the town has none, the Frontier has some', () => {
  for (const id of listedZoneIds()) assert.equal(hintTrait(listedZone(id)), listedZone(id).spawns.rows.length ? 'creatures' : 'noCreatures', id);
  assert.equal(hintTrait({ spawns: { rows: [] } }), 'noCreatures');
  assert.equal(hintTrait({ spawns: { rows: [{}] } }), 'creatures');
});

test('a creatureless zone never tells the player to walk up to a creature', () => {
  const empty = { spawns: { rows: [] } };
  for (const which of ['walk', 'watch'] as const) assert.doesNotMatch(hintLine('no-such-zone', empty, which), /creature|opponent|STRIKE|fight/i, which);
  for (const [trait, h] of Object.entries(COPY.traits)) if (trait === 'noCreatures') for (const t of Object.values(h)) assert.doesNotMatch(t, /creature|opponent|STRIKE|fight/i, t);
});

test('a zone with creatures keeps the words it always had, and a zone override row wins over the trait', () => {
  const some = { spawns: { rows: [{}] } };
  assert.equal(hintLine('no-such-zone', some, 'watch'), 'Left stick walks. Push to the edge to run. Creatures stop and watch when you come near.');
  assert.match(hintLine('no-such-zone', some, 'walk'), /Walk up to a creature and tap STRIKE/);
  const own = zoneHint('7', 'walk'); assert.ok(own, 'zone 7 has its own row');
  assert.equal(hintLine('7', some, 'walk'), own);
});

test('the dismiss time is a positive row', () => {
  assert.ok(hintDismissSec() > 0 && Number.isFinite(hintDismissSec()));
});
