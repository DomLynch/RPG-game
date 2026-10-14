import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/special-fx-dwarf-shield-rows.ts';

// special-fx-dwarf-shield.ts's named numbers are rows (special-fx-dwarf-shield-defs.json); the values must be exactly the literals the file held before.
test('special-fx-dwarf-shield rows give exactly the numbers special-fx-dwarf-shield.ts used to hold', () => {
  assert.deepEqual({ ...R }, {"DUST": 72, "GRIT": 48, "STRIDE": 8, "NIGHT_CAP": 0.4});
});
