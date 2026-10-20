import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTOPSY_CAUSE } from '../scripts/lib/autopsy-cause.mjs';

test('autopsy cause line: plain moves, breaks and a special\'s name all name the cause', () => {
  for (const line of ['Your posture broke.', 'Your guard broke.', 'You were out of stamina.', 'The thrust landed on your head.', 'The riposte landed on your legs.',
    'The Scutum Shove landed on your torso.', 'The Power Shot landed on your head.'])
    assert.match(line, AUTOPSY_CAUSE, line);
});

test('autopsy cause line: prose that names no cause still fails', () => {
  for (const line of ['You lost.', 'The Scutum Shove landed.', 'The Scutum Shove landed on your elbow.', 'the scutum shove landed on your torso.', 'The  landed on your head.'])
    assert.doesNotMatch(line, AUTOPSY_CAUSE, line);
});
