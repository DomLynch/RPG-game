// Legend families: the tables load through the shared loader, the default rows equal the catalogue's ranks, and the picker is a pure function of (family, rank, seed).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';
import { LEGEND_FAMILIES, candidatesAt, familyOf, isSpellless, legendText, pickLegend, type LegendFamily } from '../src/fight/legend-families.ts';
import { loadRegistry, tableFromFile } from '../src/core/registry.ts';
import LEGENDS_MANIFEST from '../src/fight/legend-families.manifest.json' with { type: 'json' };
import { LEGEND_OPPONENTS, legendForFight, legendForLevel, legendKeyForFight, rungOf } from '../src/legends.ts';
import { legendIdFor } from '../src/fight/spell-legends.ts';

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

test('legend families: the legend key is the spell row id without spell: — same key legendIdFor resolves (boss + boss_legend = the rank name), spell-less legends are listed', () => {
  const spells = (['ash-frontier', 'black-sand', 'jade-reach', 'marble-shore', 'red-hollow', 'sun-court', 'thorn-steppe'] as const).flatMap((r) => (JSON.parse(readFileSync(new URL(`../src/fight/spells-${r}.json`, import.meta.url), 'utf8')) as { spells: { id: string; boss: string; boss_legend?: string }[] }).spells);
  let withSpell = 0;
  for (const row of CATALOGUE.filter((r) => r.ranks.length)) for (let rank = 1; rank <= 10; rank++) {
    const hit = spells.find((s) => s.boss === row.id && s.boss_legend === row.ranks[rank - 1]!.name);   // Combat's legendIdFor (src/fight/spell-legends.ts, #2467), same resolution
    const key = candidatesAt(familyOf(row.id)!, rank)[0]!;
    assert.equal(isSpellless(key), !hit, `${row.id} ${rank}`);
    if (hit) { withSpell++; assert.equal(key, hit.id.slice('spell:'.length)); }
  }
  assert.equal(withSpell, 48);
  for (const level of [1, 7, 20, 33, 50]) for (const id of LEGEND_OPPONENTS) assert.equal(legendKeyForFight(id, level, 5), candidatesAt(familyOf(id)!, rungOf(level))[0]);
});

test('legend families: legendKeyForFight is legendIdFor at every opponent and rung (a spell-less rank is no key on both sides)', () => {
  for (const id of LEGEND_OPPONENTS) for (let rung = 1; rung <= 10; rung++) {
    const level = Math.min(50, rung * 5), want = legendIdFor(id, rungOf(level));
    assert.equal(legendKeyForFight(id, level, 3), want ?? candidatesAt(familyOf(id)!, rungOf(level))[0], `${id} rung ${rungOf(level)}`);
    assert.equal(isSpellless(candidatesAt(familyOf(id)!, rungOf(level))[0]!), want === undefined, `${id} rung ${rungOf(level)} spell-less flag`);
  }
});

// The entry chunk's static import graph, from each root the page loads first.
const staticReach = (root: string): { seen: Set<string>; bad: string[] } => {
  const seen = new Set<string>(), bad: string[] = [], stack = [resolve(root)];
  const edge = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (/spell-legends\.ts$|spells-[a-z-]+\.json$/.test(file)) { bad.push(file); continue; }
    if (!/\.ts$/.test(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(edge)) if (m[1]!.startsWith('.')) stack.push(resolve(dirname(file), m[1]!));
  }
  return { seen, bad };
};

for (const root of ['src/legends.ts', 'src/main.ts']) test(`the entry chunk does not contain the spell catalogue: no static import path from ${root} reaches spells-*.json`, () => {
  const { seen, bad } = staticReach(root);
  assert.ok(seen.size > 10, `the walk reached the page's modules (${seen.size})`);
  assert.deepEqual(bad, [], 'a static import path reaches the spell catalogue');
});
