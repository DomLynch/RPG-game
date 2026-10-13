// Legend families: the tables load through the shared loader, the default rows equal the catalogue's ranks, and the picker is a pure function of (family, rank, seed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { LEGEND_FAMILIES, candidatesAt, familyOf, legendText, pickLegend, type LegendFamily } from '../src/fight/legend-families.ts';
import { loadRegistry, tableFromFile } from '../src/core/registry.ts';
import LEGENDS_MANIFEST from '../src/fight/legend-families.manifest.json' with { type: 'json' };
import { LEGEND_OPPONENTS, legendForFight, legendForLevel } from '../src/legends.ts';

test('legend families: one family per ranked opponent, ten ranks each, every legendId resolves', () => {
  assert.deepEqual(LEGEND_FAMILIES.map((f) => f.opponent).sort(), [...LEGEND_OPPONENTS].sort());
  for (const f of LEGEND_FAMILIES) {
    assert.match(f.region, /^region:/);
    for (let rank = 1; rank <= 10; rank++) assert.ok(candidatesAt(f, rank).length >= 1, `${f.id} rank ${rank} has a legend`);
    for (const e of f.legends) assert.ok(legendText(e.legendId), `${e.legendId} resolves`);
  }
});

test('legend families: the default legend at each rank is the catalogue row\'s rank legend (no drift between the two copies)', () => {
  for (const row of CATALOGUE.filter((r) => r.ranks.length)) {
    const f = familyOf(row.id)!;
    row.ranks.forEach((r, i) => assert.deepEqual(legendText(candidatesAt(f, i + 1)[0]!), { name: r.name, source: r.source, backstory: r.backstory }, `${row.id} rank ${i + 1}`));
  }
});

test('legend families: the picker is seeded, covers every candidate, and one candidate ignores the seed', () => {
  const f: LegendFamily = { id: 'family:t', opponent: 't', region: 'region:t', legends: [{ legendId: 'a', rank: 1 }, { legendId: 'b', rank: 1 }, { legendId: 'c', rank: 1 }, { legendId: 'z', rank: 2 }] };
  assert.equal(pickLegend(f, 1, 7), pickLegend(f, 1, 7));
  assert.deepEqual(new Set(Array.from({ length: 200 }, (_, s) => pickLegend(f, 1, s))), new Set(['a', 'b', 'c']));
  for (let s = 0; s < 50; s++) assert.equal(pickLegend(f, 2, s), 'z');
  assert.equal(pickLegend(f, 3, 1), null);
});

test('legend families: a legendId outside the legend table is refused at load', () => {
  const legend = { ...JSON.parse(JSON.stringify(LEGENDS_MANIFEST.tables[0])) }, family = JSON.parse(JSON.stringify(LEGENDS_MANIFEST.tables[1]));
  const bad = { families: [{ id: 'family:x', opponent: 'x', region: 'region:x', legends: [{ legendId: 'legend:nope', rank: 1 }] }] };
  assert.throws(() => loadRegistry([tableFromFile(legend as never, { legends: [] }, 'l.json'), tableFromFile(family as never, bad, 'f.json')]));
});

test('legend families: legendForFight is the level\'s rung legend while each rank has one candidate', () => {
  for (const id of LEGEND_OPPONENTS) for (const level of [1, 12, 30, 50]) assert.deepEqual(legendForFight(id, level, 99), legendForLevel(id, level));
});
