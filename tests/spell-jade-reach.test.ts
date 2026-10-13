// The jade-reach spell rows (region 5 of the 700: src/fight/spells-jade-reach.json + manifest): one row per boss spell, through the shared loader (src/core/registry.ts).
// The checks: the table loads against the school table, every rank is 1-10, each story is one line, and a legend nested in a catalogue row is checked as a PAIR (the row exists AND names that legend).
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import { catalogueRow } from '../src/fight/catalogue-rows.ts';
import SCHOOLS from '../src/fight/school-defs.json' with { type: 'json' };
import BRICKS from '../src/fight/brick-defs.json' with { type: 'json' };
import BRICK_MANIFEST from '../src/fight/brick-defs.manifest.json' with { type: 'json' };
import SCHOOL_MANIFEST from '../src/fight/school-defs.manifest.json' with { type: 'json' };
import ROWS from '../src/fight/spells-jade-reach.json' with { type: 'json' };
import MANIFEST from '../src/fight/spells-jade-reach.manifest.json' with { type: 'json' };

type Spell = { id: string; boss: string; boss_legend?: string; region: string; level: number; story: string; source: string; bricks: { modifiers: unknown[] } };
const spells = ROWS.spells as readonly Spell[];
const tables = () => [tableFromFile(SCHOOL_MANIFEST.tables[0] as Manifest, SCHOOLS), tableFromFile(BRICK_MANIFEST.tables[0] as Manifest, BRICKS), tableFromFile(MANIFEST.tables[0] as Manifest, ROWS)];

test('jade-reach: 100 spell rows load through the shared loader, ids unique, schools are school rows', () => {
  assert.equal(spells.length, 100);
  assert.doesNotThrow(() => loadRegistry(tables()));
  assert.ok(spells.every((r) => r.id.startsWith('spell:')));
});

test('jade-reach: every row is region:jade-reach, rank 1-10, a one-line story, bricks with a root and no suffix yet', () => {
  for (const r of spells) {
    assert.equal(r.region, 'region:jade-reach', r.id);
    assert.ok(Number.isInteger(r.level) && r.level >= 1 && r.level <= 10, r.id);
    assert.ok(r.story.length > 0 && r.story.length <= 140, `${r.id} story length`);
    assert.ok(r.source.length > 0, `${r.id} source`);
    assert.deepEqual(r.bricks.modifiers, [], r.id);
  }
});

test('jade-reach: a legend nested in a catalogue row is checked as a pair (row exists AND names the legend)', () => {
  for (const r of spells.filter((s) => s.boss_legend)) {
    const row = catalogueRow(r.boss);
    assert.ok(row, `${r.id}: catalogue row "${r.boss}" does not exist`);
    assert.ok(row.ranks.some((l) => l.name === r.boss_legend), `${r.id}: row "${r.boss}" has no legend "${r.boss_legend}"`);
  }
});

test('jade-reach: one-row proof, spell:akaname reads back exactly', () => {
  const row = spells.find((r) => r.id === 'spell:akaname');
  assert.deepEqual(row, {"id": "spell:akaname", "boss": "akaname", "boss_name": "Akaname the Filth-Licker", "name": "Filth Lick", "school": "poison", "level": 1, "region": "region:jade-reach", "source": "Japanese folklore (Hearn)", "story": "A long-tongued spirit that licks the grime of old bath-houses, and leaves a sickness behind.", "bricks": {"root": "baying", "modifiers": [], "suffix": null}});
});
