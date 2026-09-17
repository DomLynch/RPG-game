import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LADDER, opponentFor, won, nextAfter } from '../src/ladder.ts';
import { OPPONENTS } from '../src/moves.ts';

test('the ladder starts at the Veteran, climbs to the Pitborn, then the Nightborn, and ends there for now', () => {
  assert.deepEqual(LADDER.map(o => o.id), ['veteran', 'pitborn', 'nightborn']);
  assert.equal(nextAfter('veteran')?.id, 'pitborn'); assert.equal(nextAfter('veteran')?.name, 'the Pitborn');
  assert.equal(nextAfter('pitborn')?.id, 'nightborn'); assert.equal(nextAfter('pitborn')?.name, 'the Nightborn');
  assert.equal(nextAfter('nightborn'), undefined, 'the last rung offers no next opponent');
  for (const rung of LADDER) assert.ok(OPPONENTS[rung.id], `${rung.id} exists in the roster`);
});

test('the opponent comes from saved progress, a URL override beats it, and anything unknown falls back to the Veteran', () => {
  assert.equal(opponentFor(undefined).id, 'veteran');
  assert.equal(opponentFor('pitborn').id, 'pitborn');
  assert.equal(opponentFor('pitborn', 'veteran').id, 'veteran', 'URL override wins');
  assert.equal(opponentFor('veteran', 'pitborn').id, 'pitborn');
  for (const junk of ['', 'cyclops', '__proto__', 'constructor', 'toString']) assert.equal(opponentFor(junk).id, 'veteran', `junk rung ${JSON.stringify(junk)}`);
  assert.equal(opponentFor('pitborn', 'nobody').id, 'veteran', 'a junk override never crashes and never exposes a prototype');
});

test('only a clean win over the opponent counts as climbing', () => {
  assert.equal(won(null), false);
  assert.equal(won({ victim: 1, location: 'torso', move: 'light_right', heading: 0 }), true);
  assert.equal(won({ victim: 0, location: 'torso', move: 'light_right', heading: 0 }), false, 'the player fell');
  assert.equal(won({ victim: 1, location: 'torso', move: 'light_right', heading: 0, draw: true }), false, 'a draw is not a win');
});
