// The camera and stage-timing numbers are rows (src/fight/camera-rules-defs.json): every default equals the literal it replaced, the loader refuses a broken table.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMERA_RULES, cameraRule, loadCameraRules } from '../src/fight/camera-rules.ts';
import { INTRO, TOUR } from '../src/fight/camera.ts';
import DEFS from '../src/fight/camera-rules-defs.json' with { type: 'json' };

test('every camera rule equals the literal it replaced', () => {
  assert.deepEqual(TOUR, { delay: 5, afterSettle: 3, blendIn: 3, lap: 40, breathe: 25, rise: 30, radius: 5.2, breath: 1.3, lookY: 0.7, lookYPortrait: 1.3 });
  assert.deepEqual(['aimPerShrink', 'lowSide', 'lowLift', 'tallBack', 'tallLift', 'shoulder', 'sideClear', 'shortFade', 'followAhead', 'followLookY', 'compileBoundMs', 'lookBakeMs'].map((id) => cameraRule(id as never)), [1.4, 0.5, 0.8, 2.4, 1.6, 1.5, 1.2, 1, 3, 1.5, 6000, 6]);
  assert.deepEqual(INTRO, { lap: 52, radius: 5.6, breath: 0.5, breathe: 19, height: 1.9, rise: 0.7, riseEvery: 26, lookY: 1, lookYPortrait: 1.3, blendIn: 2.5, blendOut: 1.5 });   // the first-visit intro orbit (Web's overlay): 45-60 s lap
  assert.equal(cameraRule('arenaClamp'), 11.5);   // the four camera clamps (lock, follow pose, finisher, tours) read this one row
  assert.deepEqual(['worldGapFloor', 'worldSideMax', 'worldSideBase', 'worldSideLow', 'worldSideRef'].map((id) => cameraRule(id as 'lowSide')), [0.8, 1.1, 0.7, 0.4, 4], 'the world fight camera side step');
  assert.deepEqual(['lockBackFloor', 'lockLiftFloor', 'lockGapFloor'].map((id) => cameraRule(id as 'lowSide')), [4.2, 3.2, 0.8], 'the lock camera floors');
  assert.equal(CAMERA_RULES.length, 42);
});
test('the loader refuses a missing named rule, a non-positive value and a duplicate id; a new row is one entry', () => {
  const rows = DEFS.rules;
  assert.throws(() => loadCameraRules({ rules: rows.filter((r) => r.id !== 'shoulder') }), /"shoulder" rule by name/);
  assert.throws(() => loadCameraRules({ rules: rows.map((r) => (r.id === 'tourLap' ? { ...r, value: 0 } : r)) }), /value is a number > 0/);
  assert.throws(() => loadCameraRules({ rules: [...rows, rows[0]!] }), /duplicate|twice|unique/i);
  assert.equal(loadCameraRules({ rules: [...rows, { id: 'extra', value: 2, unit: 'm' }] }).length, 43);
});
