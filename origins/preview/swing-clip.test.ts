import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVES } from '../../src/moves.ts';
import { SWING_CLIPS, swingClip } from './swing-clip.ts';

test('swing clips: each Zone 1 attack plays its own Pit clip (stab = Riposte, heavy = Heavy, kick = Kick), not the one Attack clip', () => {
  assert.equal(swingClip('light_right'), 'Attack');
  assert.equal(swingClip('light_left'), 'Return');
  assert.equal(swingClip('heavy_overhead'), 'Heavy');
  assert.equal(swingClip('thrust'), 'Riposte');
  assert.equal(swingClip('kick'), 'Kick');
  assert.equal(new Set(['light_right', 'heavy_overhead', 'thrust', 'kick'].map(swingClip)).size, 4, 'four attacks, four clips');
  for (const id of Object.keys(MOVES)) assert.ok(SWING_CLIPS.includes(swingClip(id)) || swingClip(id) === 'Attack', `${id} resolves to a clip the page loads`);
});
