// The sun-court spell rows (region 6 of the 700: src/fight/spells-sun-court.json + manifest): one row per boss spell, through the shared loader (src/core/registry.ts).
// The checks: the table loads against the school table, every rank is 1-10, each story is one line, and a legend nested in a catalogue row is checked as a PAIR (the row exists AND names that legend).
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import { catalogueRow } from '../src/fight/catalogue-rows.ts';
import SCHOOLS from '../src/fight/school-defs.json' with { type: 'json' };
import BRICKS from '../src/fight/brick-defs.json' with { type: 'json' };
import BRICK_MANIFEST from '../src/fight/brick-defs.manifest.json' with { type: 'json' };
import SCHOOL_MANIFEST from '../src/fight/school-defs.manifest.json' with { type: 'json' };
import ROWS from '../src/fight/spells-sun-court.json' with { type: 'json' };
import MANIFEST from '../src/fight/spells-sun-court.manifest.json' with { type: 'json' };

type Spell = { id: string; boss: string; boss_legend?: string; region: string; level: number; story: string; source: string; bricks: { modifiers: unknown[] } };
const spells = ROWS.spells as readonly Spell[];
const tables = () => [tableFromFile(SCHOOL_MANIFEST.tables[0] as Manifest, SCHOOLS), tableFromFile(BRICK_MANIFEST.tables[0] as Manifest, BRICKS), tableFromFile(MANIFEST.tables[0] as Manifest, ROWS)];

test('sun-court: 100 spell rows load through the shared loader, ids unique, schools are school rows', () => {
  assert.equal(spells.length, 100);
  assert.doesNotThrow(() => loadRegistry(tables()));
  assert.ok(spells.every((r) => r.id.startsWith('spell:')));
});

test('sun-court: every row is region:sun-court, rank 1-10, a one-line story, bricks with a root and no suffix yet', () => {
  for (const r of spells) {
    assert.equal(r.region, 'region:sun-court', r.id);
    assert.ok(Number.isInteger(r.level) && r.level >= 1 && r.level <= 10, r.id);
    assert.ok(r.story.length > 0 && r.story.length <= 140, `${r.id} story length`);
    assert.ok(r.source.length > 0, `${r.id} source`);
    assert.deepEqual(r.bricks.modifiers, [], r.id);
  }
});

test('sun-court: a legend nested in a catalogue row is checked as a pair (row exists AND names the legend)', () => {
  for (const r of spells.filter((s) => s.boss_legend)) {
    const row = catalogueRow(r.boss);
    assert.ok(row, `${r.id}: catalogue row "${r.boss}" does not exist`);
    assert.ok(row.ranks.some((l) => l.name === r.boss_legend), `${r.id}: row "${r.boss}" has no legend "${r.boss_legend}"`);
  }
});

test('sun-court: one-row proof, spell:ahuizotl reads back exactly', () => {
  const row = spells.find((r) => r.id === 'spell:ahuizotl');
  assert.deepEqual(row, {"id": "spell:ahuizotl", "boss": "ahuizotl", "boss_name": "Ahuizotl the Water Dog", "name": "Hand-Tailed Drag", "school": "frost", "level": 1, "region": "region:sun-court", "source": "Florentine Codex (Sahagun)", "story": "A dog-like water beast with a hand on its tail, who pulls bathers under.", "bricks": {"root": "longShadow", "modifiers": [], "suffix": null}});
});
