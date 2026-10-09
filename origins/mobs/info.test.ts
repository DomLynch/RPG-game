import test from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, bandOf, commonOf, conBand, creatureInfo, groupOf } from './info.ts';
import { loadZone } from '../zones/loader.ts';
const FRONTIER_ROWS = loadZone().spawns.rows;
import { falloffPermille } from '../progression/model.ts';
import { cardLines, nearestNoticing } from '../preview/creature-card.ts';
import type { MobRow } from './row.ts';

const row = (over: Partial<MobRow> & { behaviour?: MobRow['behaviour'] } = {}): MobRow => ({ id: 'character:x', source: { pending: 'p' }, role: 'beast', loot: 'loottable:x', level: [1, 2], behaviour: {}, ...over });

test('the danger band is the payout ladder: every gap lands on the band whose permille is falloffPermille(gap), seven bands, dash count = index', () => {
  assert.equal(BANDS.length, 7);
  for (let d = -15; d <= 8; d++) assert.equal(BANDS[bandOf(10 + d, 10)]!.permille, falloffPermille(d), `gap ${d}`);
  assert.equal(bandOf(10, 10), 4, 'even = white = 4 dashes'); assert.equal(bandOf(1, 20), 0, 'far below = grey = 0'); assert.equal(bandOf(13, 10), 6, 'three above = red = 6');
  assert.equal(conBand(1049), 4, 'an unlisted permille rounds down to the nearest listed band'); assert.equal(conBand(5000), 6);
});

test('how common comes from the row weight against the zone rows; named is unique', () => {
  assert.deepEqual(FRONTIER_ROWS.map((r) => commonOf(r, FRONTIER_ROWS)), ['Uncommon', 'Uncommon', 'Uncommon', 'Rare', 'Rare', 'Uncommon', 'Uncommon'], 'seven kinds now (the Pit goblin camp is the seventh, Characters 2026-10-09): the three equal kinds, the wolf and the Pit goblin are each about a sixth of the draw (Uncommon); the single Cinder Bear (weight .3) and the Ash Boar (weight 3) are the rare ones');
  const rows = [row({ id: 'a', weight: 80 }), row({ id: 'b', weight: 15 }), row({ id: 'c', weight: 5 })];
  assert.deepEqual(rows.map((r) => commonOf(r, rows)), ['Common', 'Uncommon', 'Rare']);
  assert.equal(commonOf(row({ named: true }), rows), 'Unique'); assert.equal(commonOf(undefined, rows), 'Unique');
  assert.equal(commonOf(row({ later: true, weight: 1000 }), [row({ weight: 10 }), row({ later: true, weight: 1000 })]), 'Common', 'a reserved row does not dilute the zone');
});

test('the group is the row camp size, never a constant', () => {
  assert.deepEqual(FRONTIER_ROWS.map(groupOf), ['Packs of 4', 'Packs of 4', 'Packs of 3', 'Alone', 'Alone', 'Packs of 2 to 3', 'Packs of 2']);
  assert.equal(groupOf(row({ behaviour: { campSize: [2, 3] } })), 'Packs of 2 to 3'); assert.equal(groupOf(row({ behaviour: { campSize: [1, 1] } })), 'Alone');
  assert.equal(groupOf(row()), 'Packs of 2 to 3', 'the row default'); assert.equal(groupOf(row({ named: true })), 'Alone'); assert.equal(groupOf(undefined), 'Alone');
});

test('the card: the nearest noticing creature, three lines, marks carry the band without colour', () => {
  const seen = [{ id: 'a', x: 0, z: 9, mode: 'aggro' }, { id: 'b', x: 0, z: 3, mode: 'wander' }, { id: 'c', x: 0, z: 5, mode: 'aggro' }];
  assert.equal(nearestNoticing(seen, { x: 0, z: 0 })?.id, 'c'); assert.equal(nearestNoticing(seen.filter((m) => m.mode !== 'aggro'), { x: 0, z: 0 }), null);
  const info = creatureInfo({ name: 'Cinder scavenger', level: 12 }, FRONTIER_ROWS[0], 16, FRONTIER_ROWS);
  assert.deepEqual(cardLines(info), ['Cinder scavenger · Lv 12', '▰▰▱▱▱▱ Comfortable', 'Uncommon · Packs of 4']);
  assert.equal(cardLines(creatureInfo({ name: 'x', level: 1 }, undefined, 30, []))[1], '▱▱▱▱▱▱ Trivial'); assert.equal(cardLines(creatureInfo({ name: 'x', level: 30 }, undefined, 1, []))[1], '▰▰▰▰▰▰ Dangerous');
});

test('while the card is up the creature\'s own name label is hidden (no overlap at 375): the card reports its creature, the view hides that label', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../preview/${f}`, import.meta.url), 'utf8');
  assert.match(read('main.ts'), /mobs\.update\(dt, state, cardId\)[\s\S]*cardId = creatureCard\.update\(/, 'main hands the card\'s creature to the view');
  assert.match(read('mobs-view.ts'), /v\.label\.visible = s\.id !== hideLabel/, 'the view hides that creature\'s label only');
});
