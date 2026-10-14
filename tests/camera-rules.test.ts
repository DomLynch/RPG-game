// The camera and stage-timing numbers are rows (src/fight/camera-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMERA_RULES, cameraRule, loadCameraRules } from '../src/fight/camera-rules.ts';
import { TOUR } from '../src/fight/camera.ts';
import DEFS from '../src/fight/camera-rules-defs.json' with { type: 'json' };

test('every camera rule equals the literal it replaced', () => {
  assert.deepEqual(TOUR, { delay: 5, afterSettle: 3, blendIn: 3, lap: 40, breathe: 25, rise: 30, radius: 5.2, breath: 1.3, lookY: 0.7, lookYPortrait: 1.3 });
  assert.deepEqual(['aimPerShrink', 'lowSide', 'lowLift', 'tallBack', 'tallLift', 'shoulder', 'sideClear', 'shortFade', 'followAhead', 'followLookY', 'compileBoundMs', 'lookBakeMs'].map((id) => cameraRule(id as never)), [1.4, 0.5, 0.8, 2.4, 1.6, 1.5, 1.2, 1, 3, 1.5, 6000, 6]);
  assert.equal(CAMERA_RULES.length, 22);
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadCameraRules({ rules: rows.filter((r) => r.id !== 'shoulder') }), /"shoulder" rule by name/);
  assert.throws(() => loadCameraRules({ rules: rows.map((r) => (r.id === 'tourLap' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadCameraRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadCameraRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 23);
});
