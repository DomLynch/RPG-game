// The brick catalogue (top-30 row 4, data half): every root the 700 spell rows name is a brick row; costs are signed; the success table is ordered; each root is an FX template the special rows use.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import BRICKS from '../src/fight/brick-defs.json' with { type: 'json' };
import MANIFEST from '../src/fight/brick-defs.manifest.json' with { type: 'json' };
import SCHOOLS from '../src/fight/school-defs.json' with { type: 'json' };
import SCHOOL_MANIFEST from '../src/fight/school-defs.manifest.json' with { type: 'json' };
import SPECIALS from '../src/fight/special-defs.json' with { type: 'json' };

type Spell = { id: string; bricks: { root: string; modifiers: string[]; suffix: string | null } };
const REGIONS = ['ash-frontier', 'black-sand', 'jade-reach', 'marble-shore', 'red-hollow', 'sun-court', 'thorn-steppe'];
const spells = REGIONS.flatMap((r) => (JSON.parse(readFileSync(new URL(`../src/fight/spells-${r}.json`, import.meta.url), 'utf8')) as { spells: Spell[] }).spells);
const bricks = BRICKS.bricks;

test('bricks: the table loads against the school table', () => {
  assert.doesNotThrow(() => loadRegistry([tableFromFile(SCHOOL_MANIFEST.tables[0] as Manifest, SCHOOLS), tableFromFile(MANIFEST.tables[0] as Manifest, BRICKS)]));
});

test('bricks: every brick the 700 spell rows name exists, and every root row is used', () => {
  assert.equal(spells.length, 700);
  const ids = new Set(bricks.map((b) => b.id));
  for (const s of spells) for (const id of [s.bricks.root, ...s.bricks.modifiers, ...(s.bricks.suffix ? [s.bricks.suffix] : [])]) assert.ok(ids.has(id), `${s.id} names brick ${id}`);
  assert.deepEqual([...new Set(spells.map((s) => s.bricks.root))].sort(), bricks.filter((b) => b.kind === 'root').map((b) => b.id).sort());
});

test('bricks: each root is an FX template of the special rows; success bands ascend; cost is signed and non-zero', () => {
  const templates = new Set(SPECIALS.specials.map((s) => s.template));
  for (const b of bricks) {
    assert.ok(templates.has(b.template), `${b.id} template ${b.template}`);
    const s = b.success;
    assert.ok(s.critFailBelow < s.failBelow && s.failBelow < s.partialBelow && s.partialBelow < s.critFrom, `${b.id} bands ascend`);
    assert.ok(Math.abs(s.critFailBelow) <= 50 && s.critFrom <= 50, `${b.id} bands sit inside the ±50 relative-level clip`);
    assert.ok(b.cost !== 0 && b.costPerLevel !== 0);
  }
});
