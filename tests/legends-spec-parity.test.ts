// Legends parity (Lead, 2026-09-27): GAME_SPEC.md's legends table is the owner-facing copy of src/legends.ts. Every opponent row,
// every rung header and every "Name (source)" cell must match the code exactly and in order, so a text swap that edits one side
// and not the other fails here instead of drifting.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TIERS } from '../src/grades.ts';
import { LEGEND_OPPONENTS, LEGENDS } from '../src/legends.ts';

const spec = readFileSync(new URL('../GAME_SPEC.md', import.meta.url), 'utf8');
const section = spec.slice(spec.indexOf('### Legends')).split(/\n#{2,3} /)[0]!;
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
const table = section.split('\n').filter((line) => line.startsWith('|')).map(cells);

test('legends: GAME_SPEC.md legends table matches src/legends.ts — rung headers, opponents, names and sources in order', () => {
  const [header, rule, ...rows] = table;
  assert.ok(header && rule, 'GAME_SPEC.md has a legends table under "### Legends"');
  assert.deepEqual(header, ['Opponent', ...TIERS.map((tier, i) => `${i + 1} ${tier}`)], 'rung headers are the ten tiers in order');
  assert.deepEqual(rows.map((row) => row[0]), [...LEGEND_OPPONENTS], 'one row per legend opponent, in LEGEND_OPPONENTS order');
  for (const row of rows) {
    const id = row[0] as (typeof LEGEND_OPPONENTS)[number];
    assert.deepEqual(row.slice(1), LEGENDS[id].map((legend) => `${legend.name} (${legend.source})`), `${id}: GAME_SPEC.md cells vs src/legends.ts`);
  }
});

// The portrait prompt files (docs/character-references/legend-portraits/<opponent>.json, scripts/character/legend_portraits.py) name
// the legend each rung's face is painted from, so a swap in src/legends.ts must reach them too (Lead, 2026-09-29, after the four swaps
// and Vlad). PORTRAIT_KNOWN_STALE lists the rows already behind the code; it can only shrink: a new drift fails, and so does a fixed
// row still on the list.
const PORTRAIT_KNOWN_STALE: string[] = [];

test('legends: portrait prompt files name the rung legends of src/legends.ts, ten rungs each', () => {
  const stale: string[] = [];
  for (const id of LEGEND_OPPONENTS) {
    const rows = (JSON.parse(readFileSync(new URL(`../docs/character-references/legend-portraits/${id}.json`, import.meta.url), 'utf8')) as { legends: { tier: number; name: string }[] }).legends;
    assert.deepEqual(rows.map((row) => row.tier), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `${id}: one prompt per rung, in order`);
    for (const row of rows) if (row.name !== LEGENDS[id][row.tier - 1]!.name) stale.push(`${id} ${row.tier}`);
  }
  assert.deepEqual(stale.filter((key) => !PORTRAIT_KNOWN_STALE.includes(key)), [], 'portrait prompts that no longer match src/legends.ts');
  assert.deepEqual(PORTRAIT_KNOWN_STALE.filter((key) => !stale.includes(key)), [], 'fixed: remove these from PORTRAIT_KNOWN_STALE');
});
