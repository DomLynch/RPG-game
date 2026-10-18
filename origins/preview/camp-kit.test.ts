// The camp kit is a row (camp-kit.json, World's frontier-camp.ts reads it): every value equals the literal it replaced, and the manifest accepts the row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import ROWS from './camp-kit.json' with { type: 'json' };
import MANIFEST from './camp-kit.manifest.json' with { type: 'json' };
import { CAMP_KIT } from './frontier-camp.ts';

test('the camp kit row equals the literal it replaced', () => {
  assert.deepEqual(CAMP_KIT, {
    id: 'camp-kit', radius: 6,
    fire: { stones: 9, ring: 1.0, stone: [0.32, 0.3, 0.42], coal: [0.8, 0.16], logs: 4 },
    seat: { ring: 2.9, log: [1.9, 0.5, 0.55], standOut: 4.6 },
    bedroll: [1.0, 0.2, 2.3], crate: [1.0, 0.9, 1.0], barrel: [0.48, 1.1],
    glow: { radius: 6.5, color: '#ff8a3a', opacity: 0.65 },
  });
});

test('the registry loader accepts the row and refuses a missing field', () => {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, ROWS, 'camp-kit.json')]);
  const broken = { ...ROWS.campKit[0]!, glow: undefined };
  assert.throws(() => loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, { campKit: [broken] }, 'camp-kit.json')]));
});
