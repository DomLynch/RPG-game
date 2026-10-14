import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/fight/moves-tables-rows.ts';

// moves-tables's tables are rows now; each must equal, key for key, the object the code held before.
test('PROFILES rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.PROFILES_ROWS)), {"easy": {"reaction": 24, "accuracy": 0.5, "parry": 0.1, "dodge": 0.1, "aggression": 0.45, "pressure": 0, "discipline": 60, "lapse": 0.45, "read": 0.5}, "normal": {"reaction": 14, "accuracy": 0.75, "parry": 0.3, "dodge": 0.2, "aggression": 0.65, "pressure": 0, "discipline": 50, "lapse": 0.3, "read": 0.7}, "hard": {"reaction": 10, "accuracy": 0.95, "parry": 0.6, "dodge": 0.35, "aggression": 0.85, "pressure": 0.5, "discipline": 40, "lapse": 0.1, "read": 0.85}});
  assert.deepEqual(Object.keys(R.PROFILES_ROWS), ["easy", "normal", "hard"]);
});
test('OWN_KNOBS rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.OWN_KNOBS_ROWS)), {"veteran": {"tellReaction": 15, "braceHeavy": 1, "spamRun": 5}, "pitborn": {"spamRun": 6}, "dwarf": {"spamRun": 6}, "knight": {"spamRun": 5}, "shieldmaiden": {"spamRun": 5, "spamBoth": 1}});
  assert.deepEqual(Object.keys(R.OWN_KNOBS_ROWS), ["veteran", "pitborn", "dwarf", "knight", "shieldmaiden"]);
});
test('ABSENT rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.ABSENT_ROWS)), {"read": 1, "feint": 0, "guard": 1, "disengage": 0, "circle": 0, "regen": 1, "step": 0, "interrupt": 0, "kick": 0, "dash": 0, "stab": 0, "anticipate": 8, "tellReaction": 99, "braceHeavy": 0, "spamRun": 0, "spamBoth": 0});
  assert.deepEqual(Object.keys(R.ABSENT_ROWS), ["read", "feint", "guard", "disengage", "circle", "regen", "step", "interrupt", "kick", "dash", "stab", "anticipate", "tellReaction", "braceHeavy", "spamRun", "spamBoth"]);
});
test('POISE_FULL_AT rows rebuild the old object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(R.POISE_FULL_AT_ROWS)), {"pitborn": 18, "shieldmaiden": 18});
  assert.deepEqual(Object.keys(R.POISE_FULL_AT_ROWS), ["pitborn", "shieldmaiden"]);
});
