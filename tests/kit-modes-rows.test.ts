import assert from 'node:assert/strict';
import test from 'node:test';
import { MODE, MODES } from '../src/core/world/kits.ts';

// The mob modes (shy, bold, ambusher) are rows (mob-kits.json `modes`). Pinned, byte for byte (JSON text, so key order counts), to the literal they replaced; tests/kit-version.test.ts pins the kit hash that reads them.
test('the mode deltas equal the literal they replaced', () => {
  assert.deepEqual([...MODES], ['shy', 'bold', 'ambusher']);
  assert.equal(JSON.stringify(MODE), JSON.stringify({
    shy: { aggression: -0.2, disengage: 0.2, dash: -0.3 },
    bold: { aggression: 0.1, pressure: 0.1, disengage: -0.2 },
    ambusher: { dash: 0.4, lapse: -0.1, interrupt: 0.2 },
  }));
});
